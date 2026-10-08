import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Silenciar servidor ou canal: some o som, o aviso no celular e o destaque
// de não-lidas daquele lugar (menções também ficam quietas).
@Injectable()
export class MutesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.notificationMute.findMany({
      where: { userId },
      select: { serverId: true, channelId: true },
    });
  }

  async set(userId: string, dto: { serverId?: string; channelId?: string; muted?: boolean }) {
    const { serverId, channelId } = dto || {};
    const muted = dto?.muted !== false;
    if ((!serverId && !channelId) || (serverId && channelId)) {
      throw new BadRequestException('Informe um servidor OU um canal');
    }
    if (typeof (serverId ?? channelId) !== 'string') throw new BadRequestException('Identificador inválido');

    // Só silencia o que a pessoa participa
    let sid = serverId;
    if (channelId) {
      const ch = await this.prisma.channel.findUnique({ where: { id: channelId }, select: { serverId: true } });
      if (!ch) throw new NotFoundException('Canal não encontrado');
      sid = ch.serverId;
    }
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId: sid!, userId } }, select: { banned: true },
    });
    if (!member || member.banned) throw new ForbiddenException('Sem acesso');

    if (serverId) {
      if (muted) {
        await this.prisma.notificationMute.upsert({
          where: { userId_serverId: { userId, serverId } }, create: { userId, serverId }, update: {},
        });
      } else {
        await this.prisma.notificationMute.deleteMany({ where: { userId, serverId } });
      }
    } else if (muted) {
      await this.prisma.notificationMute.upsert({
        where: { userId_channelId: { userId, channelId: channelId! } }, create: { userId, channelId }, update: {},
      });
    } else {
      await this.prisma.notificationMute.deleteMany({ where: { userId, channelId } });
    }
    return { serverId: serverId ?? null, channelId: channelId ?? null, muted };
  }

  // Quem destes usuários silenciou este servidor ou este canal
  async mutedAmong(userIds: string[], serverId: string, channelId: string) {
    if (!userIds.length) return new Set<string>();
    const rows = await this.prisma.notificationMute.findMany({
      where: { userId: { in: userIds }, OR: [{ serverId }, { channelId }] },
      select: { userId: true },
    });
    return new Set(rows.map(r => r.userId));
  }
}
