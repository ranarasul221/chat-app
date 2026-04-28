import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [RedisModule, RoomsModule],
  providers: [ChatGateway],
})
export class ChatModule {}
