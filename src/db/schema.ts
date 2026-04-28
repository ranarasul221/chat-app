import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    username: varchar('username', { length: 24 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    usernameUnique: uniqueIndex('users_username_unique').on(table.username),
  }),
);

export const rooms = pgTable(
  'rooms',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    name: varchar('name', { length: 32 }).notNull(),
    createdByUserId: varchar('created_by_user_id', { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameUnique: uniqueIndex('rooms_name_unique').on(table.name),
    createdByIdx: index('rooms_created_by_idx').on(table.createdByUserId),
  }),
);

export const messages = pgTable(
  'messages',
  {
    id: varchar('id', { length: 32 }).primaryKey(),
    roomId: varchar('room_id', { length: 32 })
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    roomCreatedIdx: index('messages_room_created_idx').on(table.roomId, table.createdAt),
    userIdx: index('messages_user_idx').on(table.userId),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  rooms: many(rooms),
  messages: many(messages),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  creator: one(users, {
    fields: [rooms.createdByUserId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  room: one(rooms, {
    fields: [messages.roomId],
    references: [rooms.id],
  }),
  user: one(users, {
    fields: [messages.userId],
    references: [users.id],
  }),
}));
