import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NexusGateway } from '../gateway/nexus.gateway';

@Injectable()
export class DmsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NexusGateway,
  ) {}

  // ── Helper: formata DM para o cliente ───────────────────────
  private formatDm(dm: any) {
    return {
      id:         dm.id,
      content:    dm.content,
      senderId:   dm.senderId,
      receiverId: dm.receiverId,
      createdAt:  dm.createdAt instanceof Date ? dm.createdAt.toISOString() : dm.createdAt,
      editedAt:   dm.editedAt instanceof Date ? dm.editedAt.toISOString() : dm.editedAt ?? null,
      edited:     dm.edited ?? false,
      deleted:    dm.deleted ?? false,
      sender: {
        id:          dm.sender?.id,
        username:    dm.sender?.username,
        displayName: dm.sender?.profile?.displayName ?? dm.sender?.username,
        avatarUrl:   dm.sender?.profile?.avatarUrl ?? null,
      },
    };
  }

  // ── Lista todas as conversas do usuário ─────────────────────
  async getConversations(userId: string) {
    const dms = await this.prisma.directMessage.findMany({
      where: {
        deleted: false,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender:   { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true, status: true } } } },
        receiver: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true, status: true } } } },
      },
    });

    // Agrega por parceiro de conversa
    const convMap = new Map<string, {
      partner: any;
      lastMessage: { content: string; createdAt: string; fromSelf: boolean };
      unread: number;
    }>();

    for (const dm of dms) {
      const partnerId = dm.senderId === userId ? dm.receiverId : dm.senderId;
      const partnerRaw = dm.senderId === userId ? dm.receiver : dm.sender;
      const partner = {
        id:       partnerRaw.id,
        username: partnerRaw.username,
        profile:  partnerRaw.profile,
      };

      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, {
          partner,
          lastMessage: {
            content:   dm.content,
            createdAt: dm.createdAt.toISOString(),
            fromSelf:  dm.senderId === userId,
          },
          unread: !dm.read && dm.receiverId === userId ? 1 : 0,
        });
      } else {
        if (!dm.read && dm.receiverId === userId) {
          convMap.get(partnerId)!.unread++;
        }
      }
    }

    return Array.from(convMap.values());
  }

  // ── Mensagens de uma conversa ───────────────────────────────
  async getMessages(userId: string, partnerId: string, limit = 50, before?: string) {
    const partner = await this.prisma.user.findUnique({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Usuário não encontrado');

    const messages = await this.prisma.directMessage.findMany({
      where: {
        deleted: false,
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: {
            id: true, username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    // Marca como lido
    await this.prisma.directMessage.updateMany({
      where: { senderId: partnerId, receiverId: userId, read: false },
      data: { read: true, readAt: new Date() },
    });

    return messages.reverse().map(m => this.formatDm(m));
  }

  // ── Envia DM ────────────────────────────────────────────────
  async sendMessage(senderId: string, receiverId: string, content: string) {
    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new NotFoundException('Usuário não encontrado');

    const dm = await this.prisma.directMessage.create({
      data: { senderId, receiverId, content },
      include: {
        sender: {
          select: {
            id: true, username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    const formatted = this.formatDm(dm);

    // Emite em tempo real para remetente e destinatário
    this.gateway.emitToUser(receiverId, 'dm:new', formatted);
    this.gateway.emitToUser(senderId,   'dm:new', formatted);

    return formatted;
  }

  // ── Edita DM ────────────────────────────────────────────────
  async editMessage(userId: string, messageId: string, content: string) {
    const dm = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!dm) throw new NotFoundException();
    if (dm.senderId !== userId) throw new ForbiddenException('Não autorizado');

    const updated = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { content, edited: true, editedAt: new Date() },
      include: {
        sender: {
          select: {
            id: true, username: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    const formatted = this.formatDm(updated);

    // Notifica ambos os lados da conversa
    this.gateway.emitToUser(dm.senderId,   'dm:updated', formatted);
    this.gateway.emitToUser(dm.receiverId, 'dm:updated', formatted);

    return formatted;
  }

  // ── Deleta DM (soft delete) ──────────────────────────────────
  async deleteMessage(userId: string, messageId: string) {
    const dm = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!dm) throw new NotFoundException();
    if (dm.senderId !== userId) throw new ForbiddenException('Não autorizado');

    await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { deleted: true },
    });

    const payload = { messageId, partnerId: dm.receiverId };

    // Notifica ambos os lados
    this.gateway.emitToUser(dm.senderId,   'dm:deleted', payload);
    this.gateway.emitToUser(dm.receiverId, 'dm:deleted', payload);

    return payload;
  }

  // ── Contagem de não lidas ────────────────────────────────────
  async getUnreadCount(userId: string) {
    return this.prisma.directMessage.count({
      where: { receiverId: userId, read: false, deleted: false },
    });
  }
}
