import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
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

  // Busca de mensagens na conversa
  @Get(':partnerId/search')
  search(
    @CurrentUser('id') userId: string,
    @Param('partnerId') partnerId: string,
    @Query('q') q: string,
  ) {
    return this.dmsService.search(userId, partnerId, q);
  }

  // Envia DM
  @Post(':receiverId/send')
  @Throttle({ default: { ttl: 10000, limit: 20 } })
  send(
    @CurrentUser('id') senderId: string,
    @Param('receiverId') receiverId: string,
    @Body('content') content: string,
  ) {
    return this.dmsService.sendMessage(senderId, receiverId, content);
  }

  // Envia arquivo, foto ou mensagem de voz
  @Post(':receiverId/attachment')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file'))
  sendAttachment(
    @CurrentUser('id') senderId: string,
    @Param('receiverId') receiverId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('content') content?: string,
  ) {
    return this.dmsService.sendAttachment(senderId, receiverId, file, content);
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

  // Reações
  @Post('messages/:id/reactions/:emoji')
  react(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Param('emoji') emoji: string,
  ) {
    return this.dmsService.addReaction(userId, messageId, emoji);
  }

  @Delete('messages/:id/reactions/:emoji')
  unreact(
    @CurrentUser('id') userId: string,
    @Param('id') messageId: string,
    @Param('emoji') emoji: string,
  ) {
    return this.dmsService.removeReaction(userId, messageId, emoji);
  }

  // Chamada 1:1
  @Post(':partnerId/call')
  @Throttle({ default: { ttl: 60000, limit: 8 } })
  startCall(@CurrentUser('id') userId: string, @Param('partnerId') partnerId: string) {
    return this.dmsService.startCall(userId, partnerId);
  }

  @Post(':partnerId/call/accept')
  acceptCall(@CurrentUser('id') userId: string, @Param('partnerId') partnerId: string) {
    return this.dmsService.acceptCall(userId, partnerId);
  }

  @Post(':partnerId/call/end')
  endCall(
    @CurrentUser('id') userId: string,
    @Param('partnerId') partnerId: string,
    @Body('reason') reason?: string,
  ) {
    return this.dmsService.endCall(userId, partnerId, reason);
  }

  // Contagem de não lidas (para badge na sidebar)
  @Get('unread/count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.dmsService.getUnreadCount(userId);
  }
}
