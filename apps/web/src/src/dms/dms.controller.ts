import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { DmsService } from './dms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('dms')
@UseGuards(JwtAuthGuard)
export class DmsController {
  constructor(private dmsService: DmsService) {}

  /** Lista conversas do usuário logado */
  @Get('conversations')
  getConversations(@CurrentUser('id') userId: string) {
    return this.dmsService.getConversations(userId);
  }

  /** Mensagens de uma conversa */
  @Get(':partnerId/messages')
  getMessages(
    @CurrentUser('id') userId: string,
    @Param('partnerId') partnerId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.dmsService.getMessages(userId, partnerId, limit ? +limit : 50, before);
  }

  /** Envia mensagem */
  @Post(':partnerId/send')
  send(
    @CurrentUser('id') userId: string,
    @Param('partnerId') partnerId: string,
    @Body('content') content: string,
  ) {
    return this.dmsService.send(userId, partnerId, content);
  }

  /** Edita mensagem */
  @Put('messages/:messageId')
  update(
    @CurrentUser('id') userId: string,
    @Param('messageId') messageId: string,
    @Body('content') content: string,
  ) {
    return this.dmsService.update(userId, messageId, content);
  }

  /** Deleta mensagem */
  @Delete('messages/:messageId')
  delete(
    @CurrentUser('id') userId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.dmsService.delete(userId, messageId);
  }

  /** Contagem de não lidas */
  @Get('unread/count')
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.dmsService.getUnreadCount(userId);
  }
}
