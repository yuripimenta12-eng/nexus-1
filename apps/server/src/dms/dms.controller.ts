import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { DmsService } from './dms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('dms')
@UseGuards(JwtAuthGuard)
export class DmsController {
  constructor(private dmsService: DmsService) {}

  // Lista conversas (sidebar)
  @Get('conversations')
  getConversations(@CurrentUser('id') userId: string) {
    return this.dmsService.getConversations(userId);
  }

  // Mensagens com um usuário específico
  @Get(':partnerId/messages')
  getMessages(
    @CurrentUser('id') userId: string,
    @Param('partnerId') partnerId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.dmsService.getMessages(userId, partnerId, limit ? +limit : 50, before);
  }

  // Envia DM
  @Post(':receiverId/send')
  send(
    @CurrentUser('id') senderId: string,
    @Param('receiverId') receiverId: string,
    @Body('content') content: string,
  ) {
    return this.dmsService.sendMessage(senderId, receiverId, content);
  }

  // Edita DM
  @Put('messages/:id')
  edit(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Body('content') content: string,
  ) {
    return this.dmsService.editMessage(userId, messageId, content);
  }

  // Deleta DM
  @Delete('messages/:id')
  delete(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
  ) {
    return this.dmsService.deleteMessage(userId, messageId);
  }

  // Contagem de não lidas (para badge na sidebar)
  @Get('unread/count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.dmsService.getUnreadCount(userId);
  }
}
