import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NexusGateway } from '../gateway/nexus.gateway';

@Injectable()
export class DmsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NexusGateway,
  ) {}

  /* ── Conversas ─────────────────────────────────────────────── */
  async getConversations(userId: string) {
    const messages = await this.prisma.directMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        deleted: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    });

    // Agrupa por par de usuários (mantém só a última mensagem por conversa)
    const seen = new Set<string>();
    const convs: any[] = [];

    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (seen.has(partnerId)) continue;
      seen.add(partnerId);

      const partner = msg.senderId === userId ? msg.receiver : msg.sender;

      const unread = await this.prisma.directMessage.count({
        where: {
          senderId: partnerId,
          receiverId: userId,
          read: false,
          deleted: false,
        },
      });

      convs.push({
        partner: {
          id: partner.id,
          username: partner.username,
          displayName: partner.profile?.displayName || partner.username,
          avatarUrl: partner.profile?.avatarUrl || null,
          status: partner.profile?.status || 'OFFLINE',
        },
        lastMessage: {
          id: msg.id,
          content: msg.content,
          createdAt: msg.createdAt,
          senderId: msg.senderId,
        },
        unreadCount: unread,
      });
    }

    return convs;
  }

  /* ── Mensagens ─────────────────────────────────────────────── */
  async getMessages(userId: string, partnerId: string, limit = 50, before?: string) {
    const cursor = before ? { id: before } : undefined;

    const msgs = await this.prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
        deleted: false,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor,
      include: {
        sender: { include: { profile: true } },
      },
    });

    // Marca como lidas
    await this.prisma.directMessage.updateMany({
      where: {
        senderId: partnerId,
        receiverId: userId,
        read: false,
        deleted: false,
      },
      data: { read: true, readAt: new Date() },
    });

    return msgs.reverse().map(m => this.formatMessage(m));
  }

  /* ── Enviar ────────────────────────────────────────────────── */
  async send(senderId: string, receiverId: string, content: string) {
    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new NotFoundException('Usuário não encontrado');

    const msg = await this.prisma.directMessage.create({
      data: { senderId, receiverId, content },
      include: { sender: { include: { profile: true } } },
    });

    const formatted = this.formatMessage(msg);

    // Emite em tempo real para destinatário e remetente
    this.gateway.emitToUser(receiverId, 'dm:new', formatted);
    this.gateway.emitToUser(senderId, 'dm:new', formatted);

    return formatted;
  }

  /* ── Editar ────────────────────────────────────────────────── */
  async update(userId: string, messageId: string, content: string) {
    const msg = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensagem não encontrada');
    if (msg.senderId !== userId) throw new ForbiddenException('Sem permissão');

    const updated = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { content, edited: true, editedAt: new Date() },
      include: { sender: { include: { profile: true } } },
    });

    const formatted = this.formatMessage(updated);

    this.gateway.emitToUser(updated.receiverId, 'dm:updated', formatted);
    this.gateway.emitToUser(userId, 'dm:updated', formatted);

    return formatted;
  }

  /* ── Deletar ───────────────────────────────────────────────── */
  async delete(userId: string, messageId: string) {
    const msg = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mensagem não encontrada');
    if (msg.senderId !== userId) throw new ForbiddenException('Sem permissão');

    await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { deleted: true },
    });

    const payload = { messageId, partnerId: msg.receiverId };
    this.gateway.emitToUser(msg.receiverId, 'dm:deleted', payload);
    this.gateway.emitToUser(userId, 'dm:deleted', payload);

    return { deleted: true };
  }

  /* ── Contagem de não lidas ─────────────────────────────────── */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.directMessage.count({
      where: { receiverId: userId, read: false, deleted: false },
    });
    return { count };
  }

  /* ── Helper ────────────────────────────────────────────────── */
  private formatMessage(msg: any) {
    return {
      id: msg.id,
      content: msg.content,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      createdAt: msg.createdAt,
      editedAt: msg.editedAt ?? null,
      edited: msg.edited ?? false,
      sender: {
        id: msg.sender.id,
        username: msg.sender.username,
        displayName: msg.sender.profile?.displayName || msg.sender.username,
        avatarUrl: msg.sender.profile?.avatarUrl || null,
      },
    };
  }
}
