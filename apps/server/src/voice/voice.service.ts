import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';

@Injectable()
export class VoiceService {
  private roomService: RoomServiceClient;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private serversService: ServersService,
  ) {
    this.roomService = new RoomServiceClient(
      this.config.get<string>('LIVEKIT_URL', 'ws://localhost:7880'),
      this.config.get<string>('LIVEKIT_API_KEY', 'devkey'),
      this.config.get<string>('LIVEKIT_API_SECRET', 'devsecret'),
    );
  }

  // ── Gera token LiveKit para entrar na sala ────────────────────
  async joinRoom(voiceRoomId: string, userId: string) {
    const voiceRoom = await this.prisma.voiceRoom.findUnique({
      where: { id: voiceRoomId },
      include: { server: true },
    });

    if (!voiceRoom) throw new NotFoundException('Sala de voz não encontrada');

    // Verifica se o usuário é membro do servidor
    const member = await this.serversService.checkMembership(voiceRoom.serverId, userId);
    if (!member || member.banned) throw new ForbiddenException('Sem acesso à sala');
    if (member.mutedBy) {
      // Usuário silenciado globalmente pelo admin — entra sem mic
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    // Cria sala no LiveKit se não existir
    try {
      await this.roomService.createRoom({
        name: voiceRoom.livekitRoom,
        maxParticipants: voiceRoom.maxUsers,
        emptyTimeout: 300,
      });
    } catch {
      // Sala já existe — ok
    }

    // Cria token com permissões
    const at = new AccessToken(
      this.config.get<string>('LIVEKIT_API_KEY', 'devkey'),
      this.config.get<string>('LIVEKIT_API_SECRET', 'devsecret'),
      {
        identity: userId,
        name: user?.profile?.displayName || user?.username || userId,
        ttl: '4h',
      },
    );

    at.addGrant({
      room: voiceRoom.livekitRoom,
      roomJoin: true,
      canPublish: !member.mutedBy,         // silenciado pelo admin não pode publicar
      canPublishSources: [
        TrackSource.MICROPHONE,
        TrackSource.CAMERA,
        TrackSource.SCREEN_SHARE,
        TrackSource.SCREEN_SHARE_AUDIO,
      ],
      canSubscribe: true,
    });

    // Registra sessão de chamada
    const callSession = await this.getOrCreateCallSession(voiceRoomId, userId);

    return {
      token: await at.toJwt(),
      livekitUrl: this.config.get<string>('LIVEKIT_URL', 'ws://localhost:7880'),
      roomName: voiceRoom.livekitRoom,
      voiceRoom,
      callSessionId: callSession.id,
    };
  }

  // ── Sai da sala ───────────────────────────────────────────────
  async leaveRoom(voiceRoomId: string, userId: string) {
    // Marca saída do participante
    const callSession = await this.prisma.callSession.findFirst({
      where: { voiceRoomId, endedAt: null },
    });

    if (callSession) {
      await this.prisma.callParticipant.updateMany({
        where: {
          callSessionId: callSession.id,
          userId,
          leftAt: null,
        },
        data: { leftAt: new Date() },
      });

      // Verifica se ainda há participantes
      const activeParticipants = await this.prisma.callParticipant.count({
        where: { callSessionId: callSession.id, leftAt: null },
      });

      if (activeParticipants === 0) {
        await this.prisma.callSession.update({
          where: { id: callSession.id },
          data: { endedAt: new Date() },
        });
      }
    }
  }

  // ── Cria salas de voz em um servidor ─────────────────────────
  async createVoiceRoom(serverId: string, userId: string, name: string) {
    await this.serversService.requireRole(serverId, userId, ['OWNER', 'ADMIN'] as any);

    const livekitRoom = `${serverId}-${Date.now()}`;

    return this.prisma.voiceRoom.create({
      data: {
        serverId,
        name,
        livekitRoom,
      },
    });
  }

  // ── Participantes ativos na sala ──────────────────────────────
  async getRoomParticipants(voiceRoomId: string) {
    const voiceRoom = await this.prisma.voiceRoom.findUnique({ where: { id: voiceRoomId } });
    if (!voiceRoom) throw new NotFoundException();

    try {
      const participants = await this.roomService.listParticipants(voiceRoom.livekitRoom);
      return participants;
    } catch {
      return [];
    }
  }

  // ── Kick de participante (admin) ──────────────────────────────
  async kickParticipant(voiceRoomId: string, targetUserId: string, requesterId: string) {
    const voiceRoom = await this.prisma.voiceRoom.findUnique({
      where: { id: voiceRoomId },
    });
    if (!voiceRoom) throw new NotFoundException();

    await this.serversService.requireRole(voiceRoom.serverId, requesterId, ['OWNER', 'ADMIN', 'MODERATOR'] as any);

    await this.roomService.removeParticipant(voiceRoom.livekitRoom, targetUserId);
  }

  // ── Helper: cria ou retorna sessão de chamada atual ───────────
  private async getOrCreateCallSession(voiceRoomId: string, userId: string) {
    let session = await this.prisma.callSession.findFirst({
      where: { voiceRoomId, endedAt: null },
    });

    if (!session) {
      session = await this.prisma.callSession.create({
        data: { voiceRoomId },
      });
    }

    // Registra participante
    const existing = await this.prisma.callParticipant.findFirst({
      where: { callSessionId: session.id, userId, leftAt: null },
    });

    if (!existing) {
      await this.prisma.callParticipant.create({
        data: {
          callSessionId: session.id,
          userId,
          livekitIdentity: userId,
        },
      });
    }

    return session;
  }
}
