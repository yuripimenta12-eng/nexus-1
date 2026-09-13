import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { RedisService } from '../redis/redis.service';
import {
  canAccessVoiceRoom, toPublicVoiceRoom, MEMBER_WITH_ROLES_INCLUDE,
  RoomAccessInfo, MemberAccessInfo,
} from './voice-access';

@Injectable()
export class VoiceService {
  private roomService: RoomServiceClient;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private serversService: ServersService,
    private redis: RedisService,
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
      include: { server: true, allowedRoles: { select: { id: true } } },
    });

    if (!voiceRoom) throw new NotFoundException('Sala de voz não encontrada');

    // Verifica se o usuário é membro do servidor (com os cargos, para salas restritas)
    const member = await this.getMemberWithRoles(voiceRoom.serverId, userId);
    if (!member || member.banned) throw new ForbiddenException('Sem acesso à sala');
    if (!this.canAccessRoom(voiceRoom, member, voiceRoom.server.ownerId)) {
      throw new ForbiddenException('Esta sala é restrita a cargos específicos');
    }
    if (member.mutedBy) {
      // Usuário silenciado globalmente pelo admin — entra sem mic
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    // Uma pessoa só pode estar em UMA sala por vez: remove o usuário de
    // qualquer outra sala do servidor antes de entrar (evita "fantasmas"
    // aparecendo em 2-3 calls ao mesmo tempo).
    const outrasSalas = await this.prisma.voiceRoom.findMany({
      where: { serverId: voiceRoom.serverId, id: { not: voiceRoomId } },
    });
    await Promise.all(outrasSalas.map(async (sala) => {
      try {
        await this.roomService.removeParticipant(sala.livekitRoom, userId);
      } catch {
        // não estava nessa sala — ok
      }
    }));

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
  async createVoiceRoom(serverId: string, userId: string, name: string, allowedRoleIds: string[] = []) {
    await this.serversService.requireRole(serverId, userId, ['OWNER', 'ADMIN'] as any);

    const livekitRoom = `${serverId}-${Date.now()}`;
    const roleIds = await this.validRoleIds(serverId, allowedRoleIds);

    const room = await this.prisma.voiceRoom.create({
      data: {
        serverId,
        name: name.trim().slice(0, 64),
        livekitRoom,
        allowedRoles: { connect: roleIds.map(id => ({ id })) },
      },
      include: { allowedRoles: { select: { id: true } } },
    });
    return this.publicRoom(room);
  }

  // ── Editar sala (nome / cargos que podem entrar) — dono/admin ──
  async updateVoiceRoom(
    voiceRoomId: string,
    userId: string,
    dto: { name?: string; allowedRoleIds?: string[] },
  ) {
    const room = await this.prisma.voiceRoom.findUnique({ where: { id: voiceRoomId } });
    if (!room) throw new NotFoundException('Sala de voz não encontrada');
    await this.serversService.requireRole(room.serverId, userId, ['OWNER', 'ADMIN'] as any);

    const data: any = {};
    if (typeof dto.name === 'string' && dto.name.trim()) data.name = dto.name.trim().slice(0, 64);
    if (Array.isArray(dto.allowedRoleIds)) {
      const roleIds = await this.validRoleIds(room.serverId, dto.allowedRoleIds);
      data.allowedRoles = { set: roleIds.map(id => ({ id })) };
    }
    const updated = await this.prisma.voiceRoom.update({
      where: { id: voiceRoomId },
      data,
      include: { allowedRoles: { select: { id: true } } },
    });

    // Quem perdeu o acesso e está dentro da sala é removido na hora
    if (data.allowedRoles) {
      try {
        const participants = await this.roomService.listParticipants(updated.livekitRoom);
        const server = await this.prisma.server.findUnique({ where: { id: room.serverId }, select: { ownerId: true } });
        await Promise.all(participants.map(async (p) => {
          if (p.identity === 'dj-nexus') return;
          const m = await this.getMemberWithRoles(room.serverId, p.identity);
          if (!m || !this.canAccessRoom(updated, m, server?.ownerId ?? '')) {
            await this.roomService.removeParticipant(updated.livekitRoom, p.identity).catch(() => {});
          }
        }));
      } catch { /* sala vazia ou LiveKit indisponível */ }
    }
    return this.publicRoom(updated);
  }

  async deleteVoiceRoom(voiceRoomId: string, userId: string) {
    const room = await this.prisma.voiceRoom.findUnique({ where: { id: voiceRoomId } });
    if (!room) throw new NotFoundException('Sala de voz não encontrada');
    await this.serversService.requireRole(room.serverId, userId, ['OWNER', 'ADMIN'] as any);
    try { await this.roomService.deleteRoom(room.livekitRoom); } catch { /* sala não existia no LiveKit */ }
    await this.prisma.voiceRoom.delete({ where: { id: voiceRoomId } });
    return { ok: true };
  }

  // ── Acesso a salas restritas ──────────────────────────────────
  // Regra: sem cargos configurados = aberta; dono/admin sempre entram;
  // senão precisa ter pelo menos um dos cargos permitidos (ou "administrator").
  canAccessRoom(room: RoomAccessInfo, member: MemberAccessInfo, ownerId: string): boolean {
    return canAccessVoiceRoom(room, member, ownerId);
  }

  async getMemberWithRoles(serverId: string, userId: string) {
    return this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
      include: MEMBER_WITH_ROLES_INCLUDE,
    });
  }

  // Só aceita cargos que existem neste servidor (e nunca o @everyone)
  private async validRoleIds(serverId: string, ids: string[]) {
    const wanted = [...new Set((ids || []).filter(id => typeof id === 'string'))];
    if (!wanted.length) return [];
    const roles = await this.prisma.role.findMany({
      where: { serverId, id: { in: wanted }, isDefault: false },
      select: { id: true },
    });
    return roles.map(r => r.id);
  }

  publicRoom<T extends { allowedRoles?: { id: string }[] }>(room: T) {
    return toPublicVoiceRoom(room);
  }

  // ── Participantes ativos na sala ──────────────────────────────
  async getRoomParticipants(voiceRoomId: string, userId?: string) {
    const voiceRoom = await this.prisma.voiceRoom.findUnique({
      where: { id: voiceRoomId },
      include: { server: { select: { ownerId: true } }, allowedRoles: { select: { id: true } } },
    });
    if (!voiceRoom) throw new NotFoundException();
    if (userId) {
      const member = await this.getMemberWithRoles(voiceRoom.serverId, userId);
      if (!member || member.banned || !this.canAccessRoom(voiceRoom, member, voiceRoom.server.ownerId)) {
        throw new ForbiddenException('Sem acesso à sala');
      }
    }

    try {
      const participants = await this.roomService.listParticipants(voiceRoom.livekitRoom);
      return participants;
    } catch {
      return [];
    }
  }

  // ── Presença: quem está em cada sala do servidor ──────────────
  async getServerVoicePresence(serverId: string, userId: string) {
    const member = await this.getMemberWithRoles(serverId, userId);
    if (!member || member.banned) throw new ForbiddenException('Sem acesso ao servidor');

    const server = await this.prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
    const allRooms = await this.prisma.voiceRoom.findMany({
      where: { serverId },
      include: { allowedRoles: { select: { id: true } } },
    });
    // Salas restritas só aparecem (com quem está nelas) para quem pode entrar
    const rooms = allRooms.filter(r => this.canAccessRoom(r, member, server?.ownerId ?? ''));

    const roomParticipants = await Promise.all(
      rooms.map(async (room) => {
        try {
          const participants = await this.roomService.listParticipants(room.livekitRoom);
          // "live" = está transmitindo a tela (track SCREEN_SHARE publicada)
          const sharing = new Set(
            participants
              .filter(p => p.tracks?.some(t => t.source === TrackSource.SCREEN_SHARE))
              .map(p => p.identity),
          );
          // Microfone mutado (ou nem publicado) — o LiveKit é a fonte da verdade
          const muted = new Set(
            participants
              .filter(p => {
                const mic = p.tracks?.find(t => t.source === TrackSource.MICROPHONE);
                return !mic || mic.muted;
              })
              .map(p => p.identity),
          );
          return { roomId: room.id, identities: participants.map(p => p.identity), sharing, muted };
        } catch {
          return { roomId: room.id, identities: [] as string[], sharing: new Set<string>(), muted: new Set<string>() };
        }
      }),
    );

    const allIds = [...new Set(roomParticipants.flatMap(r => r.identities))];
    const users = allIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: allIds } },
          include: { profile: true },
        })
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));
    // Fones mutados (ensurdecidos) — estado guardado no Redis via gateway
    const deafenedSet = await this.redis.getVoiceDeafened(allIds).catch(() => new Set<string>());

    const presence: Record<string, { id: string; username: string; displayName: string; avatarUrl: string | null; live: boolean; micMuted: boolean; deafened: boolean }[]> = {};
    for (const { roomId, identities, sharing, muted } of roomParticipants) {
      presence[roomId] = identities
        .map(id => userMap.get(id))
        .filter((u): u is NonNullable<typeof u> => u != null)
        .map(u => ({
          id: u.id,
          username: u.username,
          displayName: u.profile?.displayName || u.username,
          avatarUrl: u.profile?.avatarUrl ?? null,
          live: sharing.has(u.id),
          micMuted: muted.has(u.id) || deafenedSet.has(u.id),
          deafened: deafenedSet.has(u.id),
        }));
    }
    return presence;
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
