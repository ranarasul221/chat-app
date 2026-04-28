import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { RedisModule } from '../redis/redis.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [DbModule, RedisModule],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
