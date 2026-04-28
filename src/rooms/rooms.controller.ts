import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionGuard } from '../common/guards/session.guard';
import { CreateRoomDto, MessageQueryDto, SendMessageDto } from './dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@ApiBearerAuth('session-token')
@UseGuards(SessionGuard)
@Controller('api/v1')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('rooms')
  @ApiOperation({ summary: 'List all rooms. activeUsers is read from Redis.' })
  listRooms() {
    return this.roomsService.listRooms();
  }

  @Post('rooms')
  @ApiOperation({ summary: 'Create a new room' })
  @ApiBody({ type: CreateRoomDto })
  createRoom(@CurrentUser() user: any, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(user, dto.name);
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'Get room details' })
  @ApiParam({ name: 'id', example: 'room_x9y8z7' })
  getRoom(@Param('id') id: string) {
    return this.roomsService.getRoom(id);
  }

  @Delete('rooms/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a room. Only the creator can delete.' })
  deleteRoom(@CurrentUser() user: any, @Param('id') id: string) {
    return this.roomsService.deleteRoom(user, id);
  }

  @Get('rooms/:id/messages')
  @ApiOperation({ summary: 'Get paginated message history' })
  getMessages(@Param('id') id: string, @Query() query: MessageQueryDto) {
    return this.roomsService.getMessages(id, query.limit, query.before);
  }

  @Post('rooms/:id/messages')
  @ApiOperation({ summary: 'Send message. Persists DB then publishes Redis event.' })
  @ApiBody({ type: SendMessageDto })
  sendMessage(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.roomsService.sendMessage(user, id, dto.content);
  }
}
