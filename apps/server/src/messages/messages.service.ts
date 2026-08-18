import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MemberRole } from '@prisma/client';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
  ) {}

  async getMessages(channelId: string, userId: string, cursor?: string, limit?: number) {
    const take = Number.isFinite(limit) && (limit as number) > 0 ? Math.floor(limit as number) : 50;
    const channel = await this.findChannelAndCheckAccess(channelId, userId);

    const messages = await this.prisma.message.findMany({
      where: { channelId, deleted: false },
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        author: { include: { profile: true } },
        reactions: {
          include: { user: { include: { profile: true } } },
        },
        attachments: true,
        replyTo: {
          include: { author: { include: { profile: true } } },
        },
      },
    });

    return {
      messages: messages.reverse(),
      nextCursor: messages.length === take ? messages[0].id : null,
    };
  }

  async create(channelId: string, userId: string, dto: CreateMessageDto) {
    const channel = await this.findChannelAndCheckAccess(channelId, userId);

    const message = await this.prisma.message.create({
      data: {
        channelId,
        authorId: userId,
        content: dto.content.trim(),
        replyToId: dto.replyToId,
      },
      include: {
        author: { include: { profile: true } },
        reactions: true,
        attachments: true,
        replyTo: {
          include: { author: { include: { profile: true } } },
        },
      },
    });

    return message;
  }

  async update(messageId: string, userId: string, content: string) {
    const message = await this.findMessageAndCheckOwnership(messageId, userId);

    return this.prisma.message.update({
      where: { id: messageId },
      data: { content: content.trim(), edited: true, editedAt: new Date() },
      include: {
        author: { include: { profile: true } },
        reactions: true,
        attachments: true,
      },
    });
  }

  async delete(messageId: string, userId: string, serverId?: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { author: true },
    });
    if (!message) throw new NotFoundException();

    // Pode deletar: o próprio autor, ou moderador/admin do servidor
    if (message.authorId !== userId && serverId) {
      const channel = await this.prisma.channel.findUnique({ where: { id: message.channelId } });
      await this.serversService.requireRole(channel!.serverId, userId, [
        MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR,
      ]);
    } else if (message.authorId !== userId) {
      throw new ForbiddenException('Sem permissão');
    }

    // Soft delete para preservar contexto de respostas
    return this.prisma.message.update({
      where: { id: messageId },
      data: { deleted: true, deletedAt: new Date(), content: '[mensagem excluída]' },
    });
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    // Upsert: não duplica se já reagiu com o mesmo emoji
    return this.prisma.reaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    });
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    return this.prisma.reaction.deleteMany({
      where: { messageId, userId, emoji },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  private async findChannelAndCheckAccess(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) throw new NotFoundException('Canal não encontrado');

    const member = await this.serversService.checkMembership(channel.serverId, userId);
    if (!member || member.banned) throw new ForbiddenException('Sem acesso a este canal');

    return channel;
  }

  private async findMessageAndCheckOwnership(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException();
    if (message.authorId !== userId) throw new ForbiddenException('Sem permissão');
    return message;
  }
}
