import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { MemberRole } from '@prisma/client';

@Injectable()
export class ModerationService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
  ) {}

  // ── Kick ──────────────────────────────────────────────────────
  async kick(serverId: string, targetUserId: string, requesterId: string, reason?: string) {
    const requester = await this.serversService.requireRole(serverId, requesterId, [
      MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR,
    ]);

    const target = await this.serversService.checkMembership(serverId, targetUserId);
    if (!target) throw new NotFoundException('Usuário não é membro');
    if (target.role === MemberRole.OWNER) throw new ForbiddenException('Não pode kickar o dono');
    if (target.role === MemberRole.ADMIN && requester.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Apenas o dono pode kickar admins');
    }

    await this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });

    await this.logAction(serverId, requesterId, 'MEMBER_KICK', 'USER', targetUserId, { reason });
  }

  // ── Ban ───────────────────────────────────────────────────────
  async ban(serverId: string, targetUserId: string, requesterId: string, reason?: string) {
    const requester = await this.serversService.requireRole(serverId, requesterId, [
      MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR,
    ]);

    const target = await this.serversService.checkMembership(serverId, targetUserId);

    if (target?.role === MemberRole.OWNER) throw new ForbiddenException('Não pode banir o dono');

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
      },
    });

    await this.logAction(serverId, requesterId, 'MEMBER_BAN', 'USER', targetUserId, { reason });
  }

  // ── Unban ─────────────────────────────────────────────────────
  async unban(serverId: string, targetUserId: string, requesterId: string) {
    await this.serversService.requireRole(serverId, requesterId, [
      MemberRole.OWNER, MemberRole.ADMIN,
    ]);

    await this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    }).catch(() => {}); // Ignora se não existir

    await this.logAction(serverId, requesterId, 'MEMBER_UNBAN', 'USER', targetUserId);
  }

  // ── Mute no servidor (silencia globalmente na voz) ────────────
  async mute(serverId: string, targetUserId: string, requesterId: string, muted: boolean) {
    await this.serversService.requireRole(serverId, requesterId, [
      MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR,
    ]);

    await this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId: targetUserId } },
      data: { mutedBy: muted },
    });

    const action = muted ? 'MEMBER_MUTE' : 'MEMBER_UNMUTE';
    await this.logAction(serverId, requesterId, action, 'USER', targetUserId);
  }

  // ── Mudar cargo ───────────────────────────────────────────────
  async setRole(serverId: string, targetUserId: string, requesterId: string, role: MemberRole) {
    await this.serversService.requireRole(serverId, requesterId, [MemberRole.OWNER]);

    if (role === MemberRole.OWNER) throw new ForbiddenException('Use a função de transferência para isso');

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
