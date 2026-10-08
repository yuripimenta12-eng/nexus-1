import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MemberRole } from '@prisma/client';
import { PushService } from '../push/push.service';
import { RolesService } from '../roles/roles.service';

// Mesmas regras do DTO, valendo também para o tempo real (socket não passa pelo ValidationPipe)
function cleanContent(raw: unknown, allowEmpty = false): string {
  if (allowEmpty && (raw == null || raw === '')) return '';
  if (typeof raw !== 'string') throw new BadRequestException('Mensagem inválida');
  const text = raw.trim();
  if (!text && allowEmpty) return '';
  if (!text) throw new BadRequestException('Mensagem vazia');
  if (text.length > 4000) throw new BadRequestException('Mensagem muito longa (máximo 4000 caracteres)');
  return text;
}

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private serversService: ServersService,
    private push: PushService,
    private roles: RolesService,
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

  // Checagem antes de subir um anexo (para não gravar arquivo de quem não pode)
  async assertCanAttach(channelId: string, userId: string) {
    const channel = await this.findChannelAndCheckAccess(channelId, userId);
    await this.roles.requirePermission(channel.serverId, userId, 'send_messages', 'Seu cargo não pode enviar mensagens neste servidor');
    await this.roles.requirePermission(channel.serverId, userId, 'attach_files', 'Seu cargo não pode enviar arquivos neste servidor');
    return channel;
  }

  // opts.allowEmpty: mensagem só com anexo (texto pode ficar vazio)
  async create(channelId: string, userId: string, dto: CreateMessageDto, opts: { allowEmpty?: boolean } = {}) {
    const channel = await this.findChannelAndCheckAccess(channelId, userId);
    await this.roles.requirePermission(channel.serverId, userId, 'send_messages', 'Seu cargo não pode enviar mensagens neste servidor');
    const content = cleanContent(dto.content, opts.allowEmpty);

    // Resposta só pode apontar para mensagem do MESMO canal
    let replyToId: string | undefined;
    if (dto.replyToId) {
      if (typeof dto.replyToId !== 'string') throw new BadRequestException('Resposta inválida');
      const parent = await this.prisma.message.findUnique({ where: { id: dto.replyToId }, select: { channelId: true } });
      if (!parent || parent.channelId !== channelId) throw new BadRequestException('A mensagem respondida não está neste canal');
      replyToId = dto.replyToId;
    }

    const message = await this.prisma.message.create({
      data: {
        channelId,
        authorId: userId,
        content,
        replyToId,
      },
      include: {
        author: { include: { profile: true } },
        reactions: true,
        attachments: true,
        replyTo: {
          include: { author: { include: { profile: true } } },
        },
        // serverId para o gateway avisar a sidebar (badges de não-lidas)
        channel: { select: { serverId: true } },
      },
    });

    // Quem foi mencionado (@usuario ou @Nome) e está com o Nexus fechado
    // recebe notificação no celular. Não atrasa o envio da mensagem.
    if (message.content.includes('@')) {
      void this.notifyMentions(channel, message).catch(() => { /* push é opcional */ });
    }

    return message;
  }

  // Mesma regra do front (mentionsMe): o texto contém "@" + username ou nome de exibição
  private async notifyMentions(
    channel: { id: string; name: string; serverId: string },
    message: { authorId: string; content: string; author: any },
  ) {
    const low = message.content.toLowerCase();
    const members = await this.prisma.serverMember.findMany({
      where: { serverId: channel.serverId, banned: false, userId: { not: message.authorId } },
      select: {
        userId: true,
        user: { select: { username: true, profile: { select: { displayName: true } } } },
      },
    });
    const mentioned = members.filter(m => {
      const names = [m.user.username, m.user.profile?.displayName]
        .filter(Boolean)
        .map(n => (n as string).toLowerCase());
      return names.some(n => low.includes('@' + n));
    });
    if (!mentioned.length) return;

    const author = message.author?.profile?.displayName || message.author?.username || 'Alguém';
    this.push.notifyUsers(mentioned.map(m => m.userId), {
      title: `${author} mencionou você em #${channel.name}`,
      body: message.content,
      url: `/app/servers/${channel.serverId}/channels/${channel.id}`,
      tag: `channel:${channel.id}`,
    });
  }

  async update(messageId: string, userId: string, content: string) {
    const message = await this.findMessageAndCheckOwnership(messageId, userId);
    if (message.deleted) throw new ForbiddenException('Mensagem apagada não pode ser editada');

    return this.prisma.message.update({
      where: { id: messageId },
      data: { content: cleanContent(content), edited: true, editedAt: new Date() },
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

    // Pode deletar: o próprio autor, ou moderador/admin/cargo com "Gerenciar mensagens"
    if (message.authorId !== userId) {
      const channel = await this.prisma.channel.findUnique({ where: { id: message.channelId } });
      if (!channel) throw new NotFoundException();
      await this.roles.requireAllowed(channel.serverId, userId, 'manage_messages',
        [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR], 'Você não pode apagar mensagens de outras pessoas');
    }

    // Soft delete para preservar contexto de respostas (e sai das fixadas)
    return this.prisma.message.update({
      where: { id: messageId },
      data: { deleted: true, deletedAt: new Date(), content: '[mensagem excluída]', pinned: false, pinnedAt: null, pinnedById: null },
    });
  }

  // Devolve o canal REAL da mensagem (o gateway transmite para ele, não para o informado)
  async addReaction(messageId: string, userId: string, emoji: string) {
    const msg = await this.messageInMyServer(messageId, userId);
    await this.roles.requirePermission(msg.channel.serverId, userId, 'add_reactions', 'Seu cargo não pode reagir neste servidor');
    if (typeof emoji !== 'string' || !emoji || emoji.length > 64) throw new BadRequestException('Reação inválida');
    // Upsert: não duplica se já reagiu com o mesmo emoji
    await this.prisma.reaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    });
    return { channelId: msg.channelId };
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    const msg = await this.messageInMyServer(messageId, userId);
    await this.prisma.reaction.deleteMany({ where: { messageId, userId, emoji } });
    return { channelId: msg.channelId };
  }

  // ── Fixar mensagens ───────────────────────────────────────────
  async setPinned(messageId: string, userId: string, pinned: boolean) {
    const msg = await this.messageInMyServer(messageId, userId);
    if (msg.deleted) throw new ForbiddenException('Mensagem apagada não pode ser fixada');
    const legacy = [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR];
    const can = (await this.roles.allowed(msg.channel.serverId, userId, 'pin_messages', legacy))
      || (await this.roles.hasPermission(msg.channel.serverId, userId, 'manage_messages'));
    if (!can) throw new ForbiddenException('Seu cargo não pode fixar mensagens');
    if (pinned && !msg.pinned) {
      const count = await this.prisma.message.count({ where: { channelId: msg.channelId, pinned: true } });
      if (count >= 50) throw new ForbiddenException('Este canal já tem 50 mensagens fixadas. Desafixe alguma antes.');
    }
    await this.prisma.message.update({
      where: { id: messageId },
      data: pinned ? { pinned: true, pinnedAt: new Date(), pinnedById: userId } : { pinned: false, pinnedAt: null, pinnedById: null },
    });
    return { channelId: msg.channelId, messageId, pinned };
  }

  async getPinned(channelId: string, userId: string) {
    await this.findChannelAndCheckAccess(channelId, userId);
    return this.prisma.message.findMany({
      where: { channelId, pinned: true, deleted: false },
      orderBy: { pinnedAt: 'desc' },
      take: 50,
      include: { author: { include: { profile: true } }, attachments: true },
    });
  }

  private async messageInMyServer(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId }, include: { channel: { select: { serverId: true } } } });
    if (!msg) throw new NotFoundException('Mensagem não encontrada');
    const member = await this.serversService.checkMembership(msg.channel.serverId, userId);
    if (!member || (member as any).banned) throw new ForbiddenException('Sem acesso a esta mensagem');
    return msg;
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
