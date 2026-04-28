import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { DbService } from '../db/db.service';
import { users } from '../db/schema';
import { RedisService } from '../redis/redis.service';
import { AppException } from '../common/errors/app.exception';

const nanoid = () => randomBytes(6).toString('hex');
const SESSION_TTL_SECONDS = 60 * 60 * 24;

@Injectable()
export class AuthService {
  constructor(
    private readonly dbService: DbService,
    private readonly redisService: RedisService,
  ) {}

  async login(username: string) {
    if (!/^[a-zA-Z0-9_]{2,24}$/.test(username)) {
      throw new AppException(400, 'VALIDATION_ERROR', 'username must be between 2 and 24 characters');
    }

    let user = await this.dbService.db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      const [created] = await this.dbService.db
        .insert(users)
        .values({ id: `usr_${nanoid()}`, username })
        .returning();
      user = created;
    }

    const sessionToken = `sess_${nanoid()}${nanoid()}`;

    await this.redisService.client.set(
      this.redisService.sessionKey(sessionToken),
      JSON.stringify({ id: user.id, username: user.username }),
      'EX',
      SESSION_TTL_SECONDS,
    );

    return {
      sessionToken,
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }
}
