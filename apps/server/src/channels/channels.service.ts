import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { MemberRole } from '@prisma/client';

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
  ) {}

  async create(serverId: string, userId: string, dto: CreateChannelDto) {
    await this.serversService.requireRole(serverId, userId, [
      MemberRole.OWNER, MemberRole.ADMIN,
    ]);

    return this.prisma.channel.create({
      data: {
        serverId,
        name: dto.name.toLowerCase().replace(/\s+/g, '-'),
        type: dto.type ?? 'TEXT',
        description: dto.description,
        position: dto.position ?? 99,
      },
    });
  }

  async findById(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Canal não encontrado');

    await this.verifyAccess(channel.serverId, userId);
    return channel;
  }

  async delete(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException();

    await this.serversService.requireRole(channel.serverId, userId, [
      MemberRole.OWNER, MemberRole.ADMIN,
    ]);

    return this.prisma.channel.delete({ where: { id: channelId } });
  }

  private async verifyAccess(serverId: string, userId: string) {
    const member = await this.serversService.checkMembership(serverId, userId);
    if (!member || member.banned) throw new ForbiddenException('Acesso negado');
  }
}
