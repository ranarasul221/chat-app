import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { AppException } from '../errors/app.exception';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly redisService: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new AppException(401, 'UNAUTHORIZED', 'Missing or expired session token');
    }

    const token = authorization.replace('Bearer ', '').trim();
    const session = await this.redisService.client.get(this.redisService.sessionKey(token));

    if (!session) {
      throw new AppException(401, 'UNAUTHORIZED', 'Missing or expired session token');
    }

    request.user = JSON.parse(session);
    request.sessionToken = token;
    return true;
  }
}
