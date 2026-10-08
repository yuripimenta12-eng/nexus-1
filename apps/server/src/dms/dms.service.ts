import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NexusGateway } from '../gateway/nexus.gateway';
import { PushService } from '../push/push.service';
import { UploadService } from '../upload/upload.service';
import { VoiceService } from '../voice/voice.service';

const SENDER_SELECT = {
  select: {
    id: true, username: true,
    profile: { select: { displayName: true, avatarUrl: true } },
  },
} as const;

const DM_INCLUDE = {
  sender: SENDER_SELECT,
  attachments: true,
  reactions: { select: { userId: true, emoji: true } },
} as const;

// Mesmas regras das mensagens de canal (a rota não usa DTO)
function cleanContent(raw: unknown, allowEmpty = false): string {
  if (allowEmpty && (raw == null || raw === '')) return '';
  if (typeof raw !== 'string') throw new BadRequestException('Mensagem inválida');
  const text = raw.trim();
  if (!text && allowEmpty) return '';
  if (!text) throw new BadRequestException('Mensagem vazia');
  if (text.length > 4000) throw new BadRequestException('Mensagem muito longa (máximo 4000 caracteres)');
  return text;
}

// Texto curto para a lista de conversas e a notificação quando a DM é só anexo
function previewOf(content: string, attachments: { mimeType: string; fileName: string }[] = []) {
  if (content) return content;
  const a = attachments[0];
  if (!a) return '';
  if (a.mimeType.startsWith('audio/')) return '🎤 Mensagem de voz';
  if (a.mimeType.startsWith('image/')) return '📷 Imagem';
  if (a.mimeType.startsWith('video/')) return '🎬 Vídeo';
  return `📎 ${a.fileName}`;
}

@Injectable()
export class DmsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NexusGateway,
    private push: PushService,
    private upload: UploadService,
    private voice: VoiceService,
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
      attachments: (dm.attachments || []).map((a: any) => ({
        id: a.id, url: a.url, fileName: a.fileName, fileSize: a.fileSize, mimeType: a.mimeType,
      })),
      reactions: (dm.reactions || []).map((r: any) => ({ userId: r.userId, emoji: r.emoji })),
    };
  }

  // Pode conversar? Destinatário existe, não é conta removida e ninguém bloqueou ninguém
  private async assertCanMessage(senderId: string, receiverId: string) {
    if (typeof receiverId !== 'string' || !receiverId) throw new BadRequestException('Destinatário inválido');
    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId }, select: { id: true, isSuspended: true } });
    if (!receiver) throw new NotFoundException('Usuário não encontrado');
    if (receiver.isSuspended) throw new ForbiddenException('Esta conta não recebe mensagens');
    if (senderId !== receiverId) {
      const block = await this.prisma.block.findFirst({
        where: {
          OR: [
            { blockerId: receiverId, blockedId: senderId },
            { blockerId: senderId, blockedId: receiverId },
          ],
        },
        select: { blockerId: true },
      });
      if (block) {
        throw new ForbiddenException(block.blockerId === senderId
          ? 'Você bloqueou esta pessoa. Desbloqueie para conversar.'
          : 'Não é possível enviar mensagem para esta pessoa.');
      }
    }
    return receiver;
  }

  // A DM é desta conversa (sou remetente ou destinatário)?
  private async myDm(messageId: string, userId: string) {
    const dm = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!dm || (dm.senderId !== userId && dm.receiverId !== userId)) throw new NotFoundException('Mensagem não encontrada');
    return dm;
  }

  // ── Lista todas as conversas do usuário ─────────────────────
  async getConversations(userId: string) {
    const dms = await this.prisma.directMessage.findMany({
      where: {
        deleted: false,
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
      include: {
        sender:   { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true, status: true } } } },
        receiver: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true, status: true } } } },
        attachments: { select: { mimeType: true, fileName: true }, take: 1 },
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
            content:   previewOf(dm.content, dm.attachments),
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
    const take = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 50;
    const beforeDate = before ? new Date(before) : null;
    if (beforeDate && isNaN(beforeDate.getTime())) throw new BadRequestException('Data inválida');

    const messages = await this.prisma.directMessage.findMany({
      where: {
        deleted: false,
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
        ...(beforeDate && { createdAt: { lt: beforeDate } }),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: DM_INCLUDE,
    });

    // Marca como lido
    await this.prisma.directMessage.updateMany({
      where: { senderId: partnerId, receiverId: userId, read: false },
      data: { read: true, readAt: new Date() },
    });

    return messages.reverse().map(m => this.formatDm(m));
  }

  // ── Busca dentro da conversa ────────────────────────────────
  async search(userId: string, partnerId: string, q: string) {
    const term = typeof q === 'string' ? q.trim().slice(0, 100) : '';
    if (term.length < 2) throw new BadRequestException('Digite pelo menos 2 letras');
    const messages = await this.prisma.directMessage.findMany({
      where: {
        deleted: false,
        content: { contains: term, mode: 'insensitive' },
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: DM_INCLUDE,
    });
    return messages.map(m => this.formatDm(m));
  }

  // ── Envia DM ────────────────────────────────────────────────
  async sendMessage(senderId: string, receiverId: string, rawContent: unknown) {
    await this.assertCanMessage(senderId, receiverId);
    const content = cleanContent(rawContent);
    const dm = await this.prisma.directMessage.create({
      data: { senderId, receiverId, content },
      include: DM_INCLUDE,
    });
    return this.deliver(dm);
  }

  // ── Envia arquivo / mensagem de voz na DM ───────────────────
  async sendAttachment(senderId: string, receiverId: string, file: Express.Multer.File, rawContent: unknown) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    await this.assertCanMessage(senderId, receiverId);
    const content = cleanContent(rawContent, true);
    const { url } = await this.upload.uploadFile(file, 'attachments');
    const dm = await this.prisma.directMessage.create({
      data: {
        senderId, receiverId, content,
        attachments: {
          create: { url, fileName: (file.originalname || 'arquivo').slice(0, 200), fileSize: file.size, mimeType: file.mimetype },
        },
      },
      include: DM_INCLUDE,
    });
    return this.deliver(dm);
  }

  // Tempo real para os dois lados + notificação no celular do destinatário
  private deliver(dm: any) {
    const formatted = this.formatDm(dm);
    this.gateway.emitToUser(dm.receiverId, 'dm:new', formatted);
    this.gateway.emitToUser(dm.senderId,   'dm:new', formatted);

    if (dm.receiverId !== dm.senderId) {
      this.push.notifyUsers([dm.receiverId], {
        title: formatted.sender.displayName || 'Nova mensagem',
        body: previewOf(formatted.content, formatted.attachments),
        url: `/app/dms/${dm.senderId}`,
        tag: `dm:${dm.senderId}`,
        icon: formatted.sender.avatarUrl || undefined,
      });
    }
    return formatted;
  }

  // ── Edita DM ────────────────────────────────────────────────
  async editMessage(userId: string, messageId: string, rawContent: unknown) {
    const dm = await this.prisma.directMessage.findUnique({ where: { id: messageId } });
    if (!dm) throw new NotFoundException();
    if (dm.senderId !== userId) throw new ForbiddenException('Não autorizado');
    if (dm.deleted) throw new ForbiddenException('Mensagem apagada não pode ser editada');
    const content = cleanContent(rawContent);

    const updated = await this.prisma.directMessage.update({
      where: { id: messageId },
      data: { content, edited: true, editedAt: new Date() },
      include: DM_INCLUDE,
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

  // ── Reações ──────────────────────────────────────────────────
  async addReaction(userId: string, messageId: string, emoji: string) {
    const dm = await this.myDm(messageId, userId);
    if (dm.deleted) throw new ForbiddenException('Mensagem apagada');
    if (typeof emoji !== 'string' || !emoji || emoji.length > 64) throw new BadRequestException('Reação inválida');
    const partnerId = dm.senderId === userId ? dm.receiverId : dm.senderId;
    await this.assertCanMessage(userId, partnerId);
    await this.prisma.directMessageReaction.upsert({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
      create: { messageId, userId, emoji },
      update: {},
    });
    const payload = { messageId, userId, emoji, added: true };
    this.gateway.emitToUser(dm.senderId,   'dm:reaction', payload);
    this.gateway.emitToUser(dm.receiverId, 'dm:reaction', payload);
    return payload;
  }

  async removeReaction(userId: string, messageId: string, emoji: string) {
    const dm = await this.myDm(messageId, userId);
    await this.prisma.directMessageReaction.deleteMany({ where: { messageId, userId, emoji } });
    const payload = { messageId, userId, emoji, added: false };
    this.gateway.emitToUser(dm.senderId,   'dm:reaction', payload);
    this.gateway.emitToUser(dm.receiverId, 'dm:reaction', payload);
    return payload;
  }

  // ── Chamada 1:1 ──────────────────────────────────────────────
  // Ligar: gera o token de quem liga e toca no aparelho do outro.
  async startCall(userId: string, partnerId: string) {
    if (userId === partnerId) throw new BadRequestException('Não dá para ligar para você mesmo');
    await this.assertCanMessage(userId, partnerId);
    const call = await this.voice.dmCallToken(userId, partnerId);
    const me = await this.prisma.user.findUnique({ where: { id: userId }, select: SENDER_SELECT.select });
    this.gateway.emitToUser(partnerId, 'dm:call:ring', {
      from: {
        id: userId,
        username: me?.username,
        displayName: me?.profile?.displayName || me?.username,
        avatarUrl: me?.profile?.avatarUrl ?? null,
      },
    });
    return call;
  }

  // Atender: token de quem atende e aviso para quem ligou
  async acceptCall(userId: string, partnerId: string) {
    await this.assertCanMessage(userId, partnerId);
    const call = await this.voice.dmCallToken(userId, partnerId);
    this.gateway.emitToUser(partnerId, 'dm:call:accepted', { by: userId });
    // Os outros aparelhos de quem atendeu param de tocar
    this.gateway.emitToUser(userId, 'dm:call:handled', { partnerId });
    return call;
  }

  // Recusar, cancelar ou desligar
  async endCall(userId: string, partnerId: string, reason?: string) {
    if (typeof partnerId !== 'string' || !partnerId) throw new BadRequestException('Contato inválido');
    const why = ['declined', 'cancelled', 'ended', 'busy', 'timeout'].includes(reason || '') ? reason : 'ended';
    this.gateway.emitToUser(partnerId, 'dm:call:ended', { from: userId, reason: why });
    this.gateway.emitToUser(userId, 'dm:call:handled', { partnerId });
    return { ok: true };
  }

  // ── Contagem de não lidas ────────────────────────────────────
  async getUnreadCount(userId: string) {
    return this.prisma.directMessage.count({
      where: { receiverId: userId, read: false, deleted: false },
    });
  }
}
