import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { RolesService } from '../roles/roles.service';
import { MemberRole } from '@prisma/client';
import { NexusGateway } from '../gateway/nexus.gateway';
import { VoiceService } from '../voice/voice.service';

@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
    private roles: RolesService,
    private gateway: NexusGateway,
    private voice: VoiceService,
  ) {}

  // Quem pode agir sobre o alvo: o dono (por Server.ownerId, não pela linha)
  // nunca; ADMIN só pelo dono — a mesma regra que o kick já seguia
  private async assertCanTarget(serverId: string, requesterId: string, requesterRole: MemberRole, target: { role: MemberRole } | null, targetUserId: string, acao: string) {
    const server = await this.prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
    if (!server) throw new NotFoundException('Servidor não encontrado');
    if (targetUserId === server.ownerId || target?.role === MemberRole.OWNER) throw new ForbiddenException(`Não pode ${acao} o dono`);
    if (targetUserId === requesterId) throw new ForbiddenException(`Você não pode ${acao} a si mesmo`);
    const requesterIsOwner = requesterId === server.ownerId || requesterRole === MemberRole.OWNER;
    if (target?.role === MemberRole.ADMIN && !requesterIsOwner) throw new ForbiddenException(`Apenas o dono pode ${acao} admins`);
  }

  // Tira na hora das salas de tempo real e da chamada de voz do servidor
  private async removerAgora(serverId: string, userId: string) {
    await this.gateway.evictFromServer(userId, serverId).catch(() => {});
    await this.voice.disconnectFromServer(serverId, userId).catch(() => {});
  }

  // Moderador antigo (OWNER/ADMIN/MODERATOR) OU cargo com a permissão
  private async requester(serverId: string, userId: string, perm: 'kick_members' | 'ban_members' | 'mute_members', legacy: MemberRole[]) {
    await this.roles.requireAllowed(serverId, userId, perm, legacy);
    const m = await this.serversService.checkMembership(serverId, userId);
    if (!m) throw new ForbiddenException('Você não é membro deste servidor');
    return m;
  }

  // ── Kick ──────────────────────────────────────────────────────
  async kick(serverId: string, targetUserId: string, requesterId: string, reason?: string) {
    const requester = await this.requester(serverId, requesterId, 'kick_members', [
      MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR,
    ]);

    const target = await this.serversService.checkMembership(serverId, targetUserId);
    if (!target) throw new NotFoundException('Usuário não é membro');
    // Expulsar apagaria a linha do banido e desfaria o banimento
    if (target.banned) throw new ForbiddenException('Esse usuário está banido; use desbanir');
    await this.assertCanTarget(serverId, requesterId, requester.role, target, targetUserId, 'expulsar');

    await this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });
    await this.removerAgora(serverId, targetUserId);

    await this.logAction(serverId, requesterId, 'MEMBER_KICK', 'USER', targetUserId, { reason });
  }

  // ── Ban ───────────────────────────────────────────────────────
  async ban(serverId: string, targetUserId: string, requesterId: string, reason?: string) {
    const requester = await this.requester(serverId, requesterId, 'ban_members', [
      MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR,
    ]);

    const target = await this.serversService.checkMembership(serverId, targetUserId);
    await this.assertCanTarget(serverId, requesterId, requester.role, target, targetUserId, 'banir');

    await this.prisma.serverMember.upsert({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      create: {
        serverId,
        userId: targetUserId,
        role: MemberRole.MEMBER,
        banned: true,
        bannedAt: new Date(),
        bannedReason: reason,
      },
      update: {
        banned: true,
        bannedAt: new Date(),
        bannedReason: reason,
        role: MemberRole.MEMBER, // banido perde os poderes do cargo fixo
        roleAssignments: { deleteMany: {} },
      },
    });
    await this.removerAgora(serverId, targetUserId);

    await this.logAction(serverId, requesterId, 'MEMBER_BAN', 'USER', targetUserId, { reason });
  }

  // ── Unban ─────────────────────────────────────────────────────
  async unban(serverId: string, targetUserId: string, requesterId: string) {
    await this.requester(serverId, requesterId, 'ban_members', [MemberRole.OWNER, MemberRole.ADMIN]);

    // Só desfaz banimento: antes apagava qualquer membro, inclusive o dono
    const target = await this.serversService.checkMembership(serverId, targetUserId);
    if (!target?.banned) throw new NotFoundException('Esse usuário não está banido');
    await this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    await this.logAction(serverId, requesterId, 'MEMBER_UNBAN', 'USER', targetUserId);
  }

  // ── Mute no servidor (silencia globalmente na voz) ────────────
  async mute(serverId: string, targetUserId: string, requesterId: string, muted: boolean) {
    await this.requester(serverId, requesterId, 'mute_members', [
      MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR,
    ]);
    const requester = await this.serversService.checkMembership(serverId, requesterId);
    const target = await this.serversService.checkMembership(serverId, targetUserId);
    if (!target) throw new NotFoundException('Usuário não é membro');
    await this.assertCanTarget(serverId, requesterId, requester!.role, target, targetUserId, 'silenciar');

    await this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { mutedBy: muted },
    });
    // O token de voz atual foi emitido antes do silêncio: tira da call para valer na hora
    if (muted) await this.voice.disconnectFromServer(serverId, targetUserId).catch(() => {});

    const action = muted ? 'MEMBER_MUTE' : 'MEMBER_UNMUTE';
    await this.logAction(serverId, requesterId, action, 'USER', targetUserId);
  }

  // ── Mudar cargo ───────────────────────────────────────────────
  async setRole(serverId: string, targetUserId: string, requesterId: string, role: MemberRole) {
    await this.serversService.requireRole(serverId, requesterId, [MemberRole.OWNER]);

    if (role === MemberRole.OWNER) throw new ForbiddenException('Use a função de transferência para isso');
    const server = await this.prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
    if (targetUserId === server?.ownerId) throw new ForbiddenException('Não pode mudar o cargo do dono');

    await this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { role },
    });

    await this.logAction(serverId, requesterId, 'MEMBER_ROLE_CHANGE', 'USER', targetUserId, { role });
  }

  // ── Report ────────────────────────────────────────────────────
  async report(reporterId: string, dto: {
    targetUserId?: string;
    targetMessageId?: string;
    targetServerId?: string;
    reason: any;
    description?: string;
  }) {
    return this.prisma.report.create({
      data: {
        reporterId,
        targetUserId: dto.targetUserId,
        targetMessageId: dto.targetMessageId,
        targetServerId: dto.targetServerId,
        reason: dto.reason,
        description: dto.description,
      },
    });
  }

  // ── Block ─────────────────────────────────────────────────────
  async listBlocks(blockerId: string) {
    return this.prisma.block.findMany({
      where: { blockerId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async block(blockerId: string, blockedId: string) {
    return this.prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
  }

  async unblock(blockerId: string, blockedId: string) {
    return this.prisma.block.deleteMany({ where: { blockerId, blockedId } });
  }

  // ── Log ───────────────────────────────────────────────────────
  private async logAction(
    serverId: string,
    actorId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    meta?: any,
  ) {
    await this.prisma.auditLog.create({
      data: { serverId, actorId, action, targetType, targetId, meta },
    });
  }
}
