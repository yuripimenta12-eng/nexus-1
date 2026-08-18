import { Controller, Post, Delete, Get, Param, Body, UseGuards } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(private voiceService: VoiceService) {}

  // Gera token para entrar na sala de voz
  @Post('rooms/:roomId/join')
  join(@Param('roomId') roomId: string, @CurrentUser('id') userId: string) {
    return this.voiceService.joinRoom(roomId, userId);
  }

  // Registra saída
  @Post('rooms/:roomId/leave')
  leave(@Param('roomId') roomId: string, @CurrentUser('id') userId: string) {
    return this.voiceService.leaveRoom(roomId, userId);
  }

  // Lista participantes ativos
  @Get('rooms/:roomId/participants')
  participants(@Param('roomId') roomId: string) {
    return this.voiceService.getRoomParticipants(roomId);
  }

  // Criar nova sala de voz (admin)
  @Post('servers/:serverId/rooms')
  createRoom(
    @Param('serverId') serverId: string,
    @CurrentUser('id') userId: string,
    @Body('name') name: string,
  ) {
    return this.voiceService.createVoiceRoom(serverId, userId, name);
  }

  // Kick de participante (admin)
  @Post('rooms/:roomId/kick/:targetUserId')
  kick(
    @Param('roomId') roomId: string,
    @Param('targetUserId') targetUserId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.voiceService.kickParticipant(roomId, targetUserId, requesterId);
  }
}
