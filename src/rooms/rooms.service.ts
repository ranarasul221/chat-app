import { Injectable } from "@nestjs/common";
import { and, desc, eq, lt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { AppException } from "../common/errors/app.exception";
import { DbService } from "../db/db.service";
import { messages, rooms, users } from "../db/schema";
import { RedisService } from "../redis/redis.service";

const nanoid = () => randomBytes(6).toString("hex");
type SessionUser = { id: string; username: string };

@Injectable()
export class RoomsService {
  constructor(
    private readonly dbService: DbService,
    private readonly redisService: RedisService,
  ) {}

  async listRooms() {
    const rows = await this.dbService.db
      .select({
        id: rooms.id,
        name: rooms.name,
        createdBy: users.username,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .innerJoin(users, eq(rooms.createdByUserId, users.id));
    const data = await Promise.all(
      rows.map(async (room) => ({
        id: room.id,
        name: room.name,
        createdBy: room.createdBy,
        activeUsers: await this.redisService.client.scard(
          this.redisService.roomUsersKey(room.id),
        ),
        createdAt: room.createdAt.toISOString(),
      })),
    );
    return { rooms: data };
  }

  async createRoom(user: SessionUser, name: string) {
    if (!/^[a-zA-Z0-9-]{3,32}$/.test(name))
      throw new AppException(
        400,
        "VALIDATION_ERROR",
        "room name must be between 3 and 32 characters",
      );
    const existing = await this.dbService.db.query.rooms.findFirst({
      where: eq(rooms.name, name),
    });
    if (existing)
      throw new AppException(
        409,
        "ROOM_NAME_TAKEN",
        "A room with this name already exists",
      );
    const [room] = await this.dbService.db
      .insert(rooms)
      .values({ id: `room_${nanoid()}`, name, createdByUserId: user.id })
      .returning();
    return {
      id: room.id,
      name: room.name,
      createdBy: user.username,
      createdAt: room.createdAt.toISOString(),
    };
  }

  async getRoom(id: string) {
    const [room] = await this.dbService.db
      .select({
        id: rooms.id,
        name: rooms.name,
        createdBy: users.username,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .innerJoin(users, eq(rooms.createdByUserId, users.id))
      .where(eq(rooms.id, id))
      .limit(1);
    if (!room)
      throw new AppException(
        404,
        "ROOM_NOT_FOUND",
        `Room with id ${id} does not exist`,
      );
    return {
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      activeUsers: await this.redisService.client.scard(
        this.redisService.roomUsersKey(id),
      ),
      createdAt: room.createdAt.toISOString(),
    };
  }

  async deleteRoom(user: SessionUser, id: string) {
    const room = await this.ensureRoom(id);
    if (room.createdByUserId !== user.id)
      throw new AppException(
        403,
        "FORBIDDEN",
        "Only the room creator can delete this room",
      );
    await this.redisService.eventPub.publish(
      this.redisService.roomChannel(id),
      JSON.stringify({
        event: "room:deleted",
        roomId: id,
        payload: { roomId: id },
      }),
    );
    await this.dbService.db.delete(rooms).where(eq(rooms.id, id));
    await this.redisService.client.del(this.redisService.roomUsersKey(id));
    return { deleted: true };
  }

  async getMessages(roomId: string, limit = 50, before?: string) {
    await this.ensureRoom(roomId);
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    let beforeDate: Date | undefined;
    if (before) {
      const beforeMessage = await this.dbService.db.query.messages.findFirst({
        where: eq(messages.id, before),
      });
      beforeDate = beforeMessage?.createdAt;
    }
    const whereClause = beforeDate
      ? and(eq(messages.roomId, roomId), lt(messages.createdAt, beforeDate))
      : eq(messages.roomId, roomId);
    const rows = await this.dbService.db
      .select({
        id: messages.id,
        roomId: messages.roomId,
        username: users.username,
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.userId, users.id))
      .where(whereClause)
      .orderBy(desc(messages.createdAt))
      .limit(take + 1);
    const hasMore = rows.length > take;
    const pageRows = rows.slice(0, take);
    return {
      messages: pageRows.map((m) => ({
        id: m.id,
        roomId: m.roomId,
        username: m.username,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor:
        hasMore && pageRows.length ? pageRows[pageRows.length - 1].id : null,
    };
  }

  async sendMessage(user: SessionUser, roomId: string, content: string) {
    await this.ensureRoom(roomId);
    const trimmed = String(content ?? "").trim();
    if (!trimmed)
      throw new AppException(
        422,
        "MESSAGE_EMPTY",
        "Message content must not be empty",
      );
    if (trimmed.length > 1000)
      throw new AppException(
        422,
        "MESSAGE_TOO_LONG",
        "Message content must not exceed 1000 characters",
      );
    const [message] = await this.dbService.db
      .insert(messages)
      .values({
        id: `msg_${nanoid()}`,
        roomId,
        userId: user.id,
        content: trimmed,
      })
      .returning();
    const restPayload = {
      id: message.id,
      roomId: message.roomId,
      username: user.username,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
    await this.redisService.eventPub.publish(
      this.redisService.roomChannel(roomId),
      JSON.stringify({
        event: "message:new",
        roomId,
        payload: {
          id: restPayload.id,
          username: restPayload.username,
          content: restPayload.content,
          createdAt: restPayload.createdAt,
        },
      }),
    );
    return restPayload;
  }

  async ensureRoom(roomId: string) {
    const room = await this.dbService.db.query.rooms.findFirst({
      where: eq(rooms.id, roomId),
    });
    if (!room)
      throw new AppException(
        404,
        "ROOM_NOT_FOUND",
        `Room with id ${roomId} does not exist`,
      );
    return room;
  }
}
