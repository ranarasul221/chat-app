CREATE TABLE IF NOT EXISTS "users" (
  "id" varchar(32) PRIMARY KEY NOT NULL,
  "username" varchar(24) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "rooms" (
  "id" varchar(32) PRIMARY KEY NOT NULL,
  "name" varchar(32) NOT NULL,
  "created_by_user_id" varchar(32) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
  "id" varchar(32) PRIMARY KEY NOT NULL,
  "room_id" varchar(32) NOT NULL,
  "user_id" varchar(32) NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "rooms_name_unique" ON "rooms" ("name");
CREATE INDEX IF NOT EXISTS "rooms_created_by_idx" ON "rooms" ("created_by_user_id");
CREATE INDEX IF NOT EXISTS "messages_room_created_idx" ON "messages" ("room_id", "created_at");
CREATE INDEX IF NOT EXISTS "messages_user_idx" ON "messages" ("user_id");
