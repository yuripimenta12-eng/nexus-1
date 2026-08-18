import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { nanoid } from 'nanoid';
import { MemberRole } from '@prisma/client';

@Injectable()
export class InvitesService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
  ) {}

  async create(serverId: string, userId: string, opts: {
    maxUses?: number;
    expiresInHours?: number;
    guestAccess?: boolean;
  }) {
    // Apenas admins e acima podem criar convites
    await this.serversService.requireRole(serverId, userId, [
      MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR,
    ]);

    const expiresAt = opts.expiresInHours
      ? new Date(Date.now() + opts.expiresInHours * 3600 * 1000)
      : null;

    return this.prisma.invite.create({
      data: {
        serverId,
        creatorId: userId,
        code: nanoid(10),
        maxUses: opts.maxUses ?? null,
        expiresAt,
        guestAccess: opts.guestAccess ?? false,
      },
    });
  }

  async use(code: string, userId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { code } });
    if (!invite) throw new NotFoundException('Convite inválido');
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Convite expirado');
    }
    if (invite.maxUses !== null && invite.uses >= invite.maxUses) {
      throw new BadRequestException('Limite de usos atingido');
    }

    const server = await this.prisma.server.findUnique({
      where: { id: invite.serverId },
      include: { _count: { select: { members: true } } },
    });

    if (!server) throw new NotFoundException('Servidor não encontrado');
    if (server._count.members >= server.maxMembers) {
      throw new BadRequestException('Servidor cheio');
    }

    // Verifica se já é membro
    const existing = await this.serversService.checkMembership(invite.serverId, userId);
    if (existing) {
      if (existing.banned) throw new ForbiddenException('Você está banido deste servidor');
      return { server, alreadyMember: true };
    }

    await this.prisma.$transaction([
      this.prisma.serverMember.create({
        data: { serverId: invite.serverId, userId, role: MemberRole.MEMBER },
      }),
      this.prisma.invite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    return { server, alreadyMember: false };
  }

  async getForServer(serverId: string, userId: string) {
    await this.serversService.requireRole(serverId, userId, [
      MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR,
    ]);

    return this.prisma.invite.findMany({
      where: { serverId },
      include: { creator: { include: { profile: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(code: string, userId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { code } });
    if (!invite) throw new NotFoundException();

    await this.serversService.requireRole(invite.serverId, userId, [
      MemberRole.OWNER, MemberRole.ADMIN,
    ]);

    return this.prisma.invite.delete({ where: { code } });
  }
}
