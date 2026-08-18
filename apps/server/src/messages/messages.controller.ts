import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('channels/:channelId/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get()
  getMessages(
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.messagesService.getMessages(channelId, userId, cursor, limit);
  }

  @Post()
  create(
    @Param('channelId') channelId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.messagesService.create(channelId, userId, dto);
  }

  @Patch(':messageId')
  update(
    @Param('messageId') messageId: string,
    @CurrentUser('id') userId: string,
    @Body('content') content: string,
  ) {
    return this.messagesService.update(messageId, userId, content);
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('messageId') messageId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.messagesService.delete(messageId, userId);
  }

  @Post(':messageId/reactions/:emoji')
  addReaction(
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.messagesService.addReaction(messageId, userId, emoji);
  }

  @Delete(':messageId/reactions/:emoji')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeReaction(
    @Param('messageId') messageId: string,
    @Param('emoji') emoji: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.messagesService.removeReaction(messageId, userId, emoji);
  }
}
