# Architecture

## Overview

This application is a real-time anonymous group chat backend.

Users do not register with passwords. A user logs in with only a username. The server creates or finds that user in PostgreSQL and returns an opaque session token stored in Redis for 24 hours.

Rooms and messages are stored in PostgreSQL through Drizzle ORM. Redis is used for session storage, live active-user tracking, socket connection state, and pub/sub fan-out between REST and WebSocket layers.

```txt
Client
  |
  | REST /api/v1
  v
NestJS Controllers
  |
  | Drizzle ORM
  v
PostgreSQL

Client
  |
  | Socket.io /chat
  v
Chat Gateway
  |
  | Redis socket state + active users
  v
Redis

POST /rooms/:id/messages
  -> save message in PostgreSQL
  -> publish message:new to Redis
  -> every gateway instance receives event
  -> gateway emits to sockets in that room
```

## Components

### Auth Module

Handles `POST /api/v1/login`.

Responsibilities:

- Validate username format
- Create user when username does not exist
- Return existing user when username already exists
- Generate fresh opaque session token
- Store token in Redis for 24 hours

### Rooms Module

Handles room and message REST APIs.

Responsibilities:

- List rooms
- Create unique rooms
- Return room details
- Delete rooms only by creator
- Return paginated messages
- Save messages and publish Redis events

### Chat Gateway

Handles Socket.io `/chat` namespace.

Responsibilities:

- Validate token on connection
- Validate room existence on connection
- Join socket to Socket.io room
- Store socket state in Redis
- Track active users in Redis
- Broadcast join/leave events
- Subscribe to Redis room event channels
- Emit `message:new` and `room:deleted` to connected clients

## Session Strategy

Session tokens are opaque random strings:

```txt
sess_<random>
```

Redis key:

```txt
session:<token>
```

Value:

```json
{
  "id": "usr_xxx",
  "username": "ali_123"
}
```

TTL:

```txt
24 hours
```

When a protected REST request arrives, `SessionGuard` reads:

```txt
Authorization: Bearer <sessionToken>
```

If the Redis key does not exist, the request returns:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or expired session token"
  }
}
```

The WebSocket gateway also validates the token during connection. Invalid tokens are disconnected immediately.

## Redis Active User Strategy

Redis keys:

```txt
room:<roomId>:users
room:<roomId>:user:<username>:sockets
socket:<socketId>
```

`room:<roomId>:users` is a Redis Set containing usernames currently active in a room.

`room:<roomId>:user:<username>:sockets` is a Redis Set containing socket IDs for that username in that room. This prevents incorrect active-user cleanup when the same user opens multiple tabs.

`socket:<socketId>` is a Redis Hash containing:

```txt
userId
username
roomId
```

On disconnect:

1. Read `socket:<socketId>`.
2. Remove socket ID from the user socket set.
3. If no socket remains for that username, remove username from room active-user set.
4. Broadcast `room:user_left` only when the last socket for that username leaves.

## Redis Pub/Sub and WebSocket Fan-out

REST controllers do not emit WebSocket events directly.

For message sending:

1. REST endpoint validates room and content.
2. Message is saved in PostgreSQL.
3. Service publishes event to Redis:

```txt
room:<roomId>:events
```

Payload:

```json
{
  "event": "message:new",
  "roomId": "room_xxx",
  "payload": {
    "id": "msg_xxx",
    "username": "ali_123",
    "content": "hello everyone",
    "createdAt": "2026-04-29T10:05:22.000Z"
  }
}
```

Every running API instance has a gateway subscribed to:

```txt
room:*:events
```

When it receives an event, it emits to local sockets in that room. The Socket.io Redis adapter also allows room membership and broadcasts to work across instances.

## Single-instance Capacity Estimate

A single modest Railway instance should comfortably handle a few thousand idle WebSocket connections if CPU and memory are sufficient. Actual capacity depends on message frequency.

Estimated practical baseline:

- 1,000–3,000 connected sockets
- 50–150 messages/second for small payloads
- PostgreSQL write capacity is usually the first bottleneck for heavy message traffic
- Redis operations are lightweight and should not be the bottleneck at this scale

Reasoning:

- Active-user operations are Redis Set operations.
- Message delivery payloads are small.
- Message persistence uses one PostgreSQL insert per message.
- No expensive joins happen on live message sending.

## Scaling to 10× Load

To scale this system to 10×:

1. Run multiple API instances behind Railway/load balancer.
2. Keep Redis centralized for sessions, active users, socket state, and pub/sub.
3. Use managed PostgreSQL with higher connection limits.
4. Add PgBouncer for connection pooling.
5. Partition/archive old messages by room or time.
6. Add read replicas for message history if reads become heavy.
7. Add rate limiting per session and room.
8. Add observability: structured logs, Redis metrics, Postgres slow query logs.
9. Consider Kafka/NATS if message fan-out or persistence events become very high-volume.

## Known Limitations and Trade-offs

- Username-only identity means anyone can reuse a username if they know it. This is required by the task contract.
- Sessions are invalidated only by TTL; there is no logout endpoint.
- Redis pub/sub is fire-and-forget. If a gateway instance is down during publish, it misses that event. The message remains in PostgreSQL, so history is still correct.
- Message pagination uses message created time derived from the `before` message ID. This is simple and contract-friendly.
- Active user ordering is not guaranteed because Redis Set ordering is not stable.
