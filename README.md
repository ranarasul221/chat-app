# Anonymous Chat API

Real-time anonymous group chat API using NestJS, PostgreSQL, Drizzle ORM, Redis, and Socket.io.

## Features

- Username-only login, no password or registration
- 24-hour session tokens stored in Redis
- Create, list, view, and delete rooms
- Persist message history in PostgreSQL through Drizzle ORM
- Live room active-user count from Redis
- Socket.io `/chat` namespace
- Redis pub/sub fan-out for multi-instance WebSocket scaling
- Swagger API docs at `/api/docs`
- Railway deployment ready

## Tech Stack

- NestJS
- PostgreSQL
- Drizzle ORM
- Redis
- Socket.io
- TypeScript

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 3. Create `.env`

```bash
cp .env.example .env
```

Default local values:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/anonymous_chat
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=*
```

### 4. Push database schema

```bash
npm run db:migrate
```

This uses Drizzle Kit push to sync the schema.

### 5. Run app

```bash
npm run start:dev
```

API base URL:

```txt
http://localhost:3000/api/v1
```

Swagger docs:

```txt
http://localhost:3000/api/docs
```

Socket namespace:

```txt
ws://localhost:3000/chat?token=<sessionToken>&roomId=<roomId>
```

## API Contract

All responses use this envelope.

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

All routes except `POST /api/v1/login` require:

```txt
Authorization: Bearer <sessionToken>
```

## REST API Docs

### POST `/api/v1/login`

Request:

```json
{
  "username": "ali_123"
}
```

Rules:

- 2–24 characters
- alphanumeric and underscore only
- idempotent by username
- returns fresh session token every login

Response:

```json
{
  "success": true,
  "data": {
    "sessionToken": "sess_xxx",
    "user": {
      "id": "usr_xxx",
      "username": "ali_123",
      "createdAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

### GET `/api/v1/rooms`

Response:

```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "id": "room_xxx",
        "name": "general",
        "createdBy": "ali_123",
        "activeUsers": 2,
        "createdAt": "2026-04-29T10:00:00.000Z"
      }
    ]
  }
}
```

### POST `/api/v1/rooms`

Request:

```json
{
  "name": "general"
}
```

Rules:

- 3–32 characters
- alphanumeric and hyphen only
- unique room name

Response status: `201`

```json
{
  "success": true,
  "data": {
    "id": "room_xxx",
    "name": "general",
    "createdBy": "ali_123",
    "createdAt": "2026-04-29T10:00:00.000Z"
  }
}
```

### GET `/api/v1/rooms/:id`

Response:

```json
{
  "success": true,
  "data": {
    "id": "room_xxx",
    "name": "general",
    "createdBy": "ali_123",
    "activeUsers": 2,
    "createdAt": "2026-04-29T10:00:00.000Z"
  }
}
```

### DELETE `/api/v1/rooms/:id`

Only the room creator can delete.

Before deleting, server publishes `room:deleted` to Redis and the gateway emits it to clients.

Response:

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

### GET `/api/v1/rooms/:id/messages`

Query params:

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `limit` | number | 50 | Max 100 |
| `before` | string | optional | Message ID cursor |

Response:

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_xxx",
        "roomId": "room_xxx",
        "username": "ali_123",
        "content": "hello everyone",
        "createdAt": "2026-04-29T10:05:22.000Z"
      }
    ],
    "hasMore": false,
    "nextCursor": null
  }
}
```

### POST `/api/v1/rooms/:id/messages`

Request:

```json
{
  "content": "hello everyone"
}
```

Rules:

- server trims content
- 1–1000 characters
- persists to PostgreSQL first
- then publishes `message:new` to Redis
- REST controller does not emit directly to socket

Response status: `201`

```json
{
  "success": true,
  "data": {
    "id": "msg_xxx",
    "roomId": "room_xxx",
    "username": "ali_123",
    "content": "hello everyone",
    "createdAt": "2026-04-29T10:05:22.000Z"
  }
}
```

## WebSocket Docs

Connect:

```txt
ws://host/chat?token=<sessionToken>&roomId=<roomId>
```

### Server → Client Events

#### `room:joined`

Sent only to connecting client.

```json
{ "activeUsers": ["ali_123", "sara_x"] }
```

#### `room:user_joined`

Sent to all other clients in room.

```json
{ "username": "sara_x", "activeUsers": ["ali_123", "sara_x"] }
```

#### `message:new`

Sent to all clients in room after `POST /rooms/:id/messages`.

```json
{
  "id": "msg_xxx",
  "username": "ali_123",
  "content": "hello everyone",
  "createdAt": "2026-04-29T10:05:22.000Z"
}
```

#### `room:user_left`

```json
{ "username": "sara_x", "activeUsers": ["ali_123"] }
```

#### `room:deleted`

```json
{ "roomId": "room_xxx" }
```

### Client → Server Events

#### `room:leave`

No payload. Server removes the socket state from Redis and disconnects the socket.

## Test Flow

```bash
# login
curl -X POST http://localhost:3000/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ali_123"}'

# create room
curl -X POST http://localhost:3000/api/v1/rooms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <sessionToken>" \
  -d '{"name":"general"}'

# send message
curl -X POST http://localhost:3000/api/v1/rooms/<roomId>/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <sessionToken>" \
  -d '{"content":"hello everyone"}'
```

## Railway Deployment

### 1. Push project to GitHub

```bash
git init
git add .
git commit -m "anonymous chat api"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Create Railway project

Create a new Railway project from the GitHub repo.

### 3. Add services

Add these Railway services:

- PostgreSQL
- Redis

### 4. Set environment variables

Railway usually exposes database URLs automatically. Add or confirm these variables in your API service:

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CORS_ORIGIN=*
```

### 5. Deploy

Railway will use `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm run db:migrate && npm run start:prod"
  }
}
```

After deploy:

```txt
https://your-service.up.railway.app/api/docs
https://your-service.up.railway.app/api/v1/login
wss://your-service.up.railway.app/chat?token=<sessionToken>&roomId=<roomId>
```

## Notes

- `activeUsers` is counted from Redis, not PostgreSQL.
- Session tokens expire after 24 hours.
- Socket connection state is stored in Redis, not JS memory.
- Multiple tabs for the same username are handled by tracking socket IDs per user in Redis.
