import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ali_123' })
  @IsString()
  @Matches(/^[a-zA-Z0-9_]{2,24}$/, {
    message: 'username must be between 2 and 24 characters',
  })
  username!: string;
}
