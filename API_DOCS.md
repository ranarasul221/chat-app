# API Docs

Base URL:

```txt
/api/v1
```

Swagger UI:

```txt
/api/docs
```

Authorization header for protected routes:

```txt
Authorization: Bearer <sessionToken>
```

## Response Envelope

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
    "message": "Human-readable description of what went wrong"
  }
}
```

## REST Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/login` | No | Login or create user |
| GET | `/rooms` | Yes | List rooms |
| POST | `/rooms` | Yes | Create room |
| GET | `/rooms/:id` | Yes | Get room details |
| DELETE | `/rooms/:id` | Yes | Delete room |
| GET | `/rooms/:id/messages` | Yes | Get message history |
| POST | `/rooms/:id/messages` | Yes | Send message |

## WebSocket

Namespace:

```txt
/chat
```

Connect URL:

```txt
ws://host/chat?token=<sessionToken>&roomId=<roomId>
```

Server events:

- `room:joined`
- `room:user_joined`
- `message:new`
- `room:user_left`
- `room:deleted`

Client event:

- `room:leave`
