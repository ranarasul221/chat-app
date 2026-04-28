import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @ApiProperty({ example: 'general' })
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{3,32}$/, { message: 'room name must be between 3 and 32 characters' })
  name!: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'hello everyone' })
  @IsString()
  content!: string;
}

export class MessageQueryDto {
  @ApiPropertyOptional({ example: 50, default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ example: 'msg_ab12cd' })
  @IsOptional()
  @IsString()
  before?: string;
}
