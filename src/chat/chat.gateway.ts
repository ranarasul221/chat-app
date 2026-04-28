import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server, Socket } from "socket.io";
import { RedisService } from "../redis/redis.service";
import { RoomsService } from "../rooms/rooms.service";

@WebSocketGateway({ namespace: "/chat", cors: { origin: "*" } })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly redisService: RedisService,
    private readonly roomsService: RoomsService,
  ) {}

async afterInit(server: any) {
  const namespace = server;
  const ioServer = server.server ?? server;

  ioServer.adapter(
    createAdapter(this.redisService.adapterPub, this.redisService.adapterSub),
  );

  await this.redisService.eventSub.psubscribe('chat:room:*:events');

  this.redisService.eventSub.on('pmessage', (_pattern, _channel, raw) => {
    const message = JSON.parse(raw);

    if (message.event === 'message:new') {
      namespace.to(message.roomId).emit('message:new', message.payload);
    }

    if (message.event === 'room:deleted') {
      namespace.to(message.roomId).emit('room:deleted', message.payload);
    }
  });
}
  async handleConnection(socket: Socket) {
    const token = String(socket.handshake.query.token ?? "");
    const roomId = String(socket.handshake.query.roomId ?? "");

    const sessionRaw = await this.redisService.client.get(
      this.redisService.sessionKey(token),
    );

    if (!sessionRaw) {
      socket.emit("error", {
        code: 401,
        message: "Missing or expired session token",
      });
      socket.disconnect(true);
      return;
    }

    try {
      await this.roomsService.ensureRoom(roomId);
    } catch {
      socket.emit("error", {
        code: 404,
        message: `Room with id ${roomId} does not exist`,
      });
      socket.disconnect(true);
      return;
    }

    const user = JSON.parse(sessionRaw);

    await this.redisService.client.hset(
      this.redisService.socketKey(socket.id),
      {
        userId: user.id,
        username: user.username,
        roomId,
      },
    );

    await this.redisService.client.sadd(
      this.redisService.userSocketsKey(roomId, user.username),
      socket.id,
    );

    await this.redisService.client.sadd(
      this.redisService.roomUsersKey(roomId),
      user.username,
    );

    await socket.join(roomId);

    const activeUsers = await this.redisService.client.smembers(
      this.redisService.roomUsersKey(roomId),
    );

    socket.emit("room:joined", { activeUsers });

    socket.to(roomId).emit("room:user_joined", {
      username: user.username,
      activeUsers,
    });
  }

  async handleDisconnect(socket: Socket) {
    await this.cleanupSocket(socket);
  }

  @SubscribeMessage("room:leave")
  async handleLeave(@ConnectedSocket() socket: Socket) {
    await this.cleanupSocket(socket);
    socket.disconnect(true);
  }

  private async cleanupSocket(socket: Socket) {
    const state = await this.redisService.client.hgetall(
      this.redisService.socketKey(socket.id),
    );

    if (!state?.roomId || !state?.username) return;

    const userSocketsKey = this.redisService.userSocketsKey(
      state.roomId,
      state.username,
    );

    await this.redisService.client.srem(userSocketsKey, socket.id);

    const remaining = await this.redisService.client.scard(userSocketsKey);

    if (remaining === 0) {
      await this.redisService.client.del(userSocketsKey);

      await this.redisService.client.srem(
        this.redisService.roomUsersKey(state.roomId),
        state.username,
      );
    }

    await this.redisService.client.del(this.redisService.socketKey(socket.id));

    const activeUsers = await this.redisService.client.smembers(
      this.redisService.roomUsersKey(state.roomId),
    );

    if (remaining === 0) {
      socket.to(state.roomId).emit("room:user_left", {
        username: state.username,
        activeUsers,
      });
    }
  }
}
