import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  public readonly client = new Redis(process.env.REDIS_URL!);

  // Socket.io adapter only
  public readonly adapterPub = new Redis(process.env.REDIS_URL!);
  public readonly adapterSub = new Redis(process.env.REDIS_URL!);

  // App custom JSON events only
  public readonly eventPub = new Redis(process.env.REDIS_URL!);
  public readonly eventSub = new Redis(process.env.REDIS_URL!);

  sessionKey(token: string) {
    return `session:${token}`;
  }

  roomUsersKey(roomId: string) {
    return `chat:room:${roomId}:users`;
  }

  userSocketsKey(roomId: string, username: string) {
    return `chat:room:${roomId}:user:${username}:sockets`;
  }

  socketKey(socketId: string) {
    return `chat:socket:${socketId}`;
  }

  roomChannel(roomId: string) {
    return `chat:room:${roomId}:events`;
  }

  async onModuleDestroy() {
    await Promise.all([
      this.client.quit(),
      this.adapterPub.quit(),
      this.adapterSub.quit(),
      this.eventPub.quit(),
      this.eventSub.quit(),
    ]);
  }
}