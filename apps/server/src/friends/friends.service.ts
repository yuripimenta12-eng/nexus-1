import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { NexusGateway } from '../gateway/nexus.gateway';

const USER_SELECT = {
  id: true,
  username: true,
  profile: { select: { displayName: true, avatarUrl: true, customStatus: true } },
} as const;

@Injectable()
export class FriendsService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
    private gateway: NexusGateway,
  ) {}

  // ── Enviar pedido (por @username) ────────────────────────────
  async sendRequest(userId: string, username: string) {
    const alvo = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase().replace(/^@/, '') },
      select: { id: true, username: true },
    });
    if (!alvo) throw new NotFoundException('Usuário não encontrado. Confira o @nome.');
    if (alvo.id === userId) throw new BadRequestException('Você não pode adicionar a si mesmo.');

    // Bloqueio em qualquer direção impede o pedido
    const bloqueado = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: alvo.id, blockedId: userId },
          { blockerId: userId, blockedId: alvo.id },
        ],
      },
    });
    if (bloqueado) throw new ForbiddenException('Não foi possível enviar o pedido.');

    const existente = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: alvo.id },
          { requesterId: alvo.id, addresseeId: userId },
        ],
      },
    });
    if (existente) {
      if (existente.status === 'ACCEPTED') throw new BadRequestException('Vocês já são amigos!');
      // Se a outra pessoa já tinha pedido, aceita direto (match)
      if (existente.requesterId === alvo.id) return this.accept(userId, existente.id);
      throw new BadRequestException('Pedido já enviado — aguardando resposta.');
    }

    const pedido = await this.prisma.friendship.create({
      data: { requesterId: userId, addresseeId: alvo.id },
      include: { requester: { select: USER_SELECT } },
    });

    this.gateway.emitToUser(alvo.id, 'friend:request', {
      id: pedido.id,
      from: pedido.requester,
    });

    return { message: `Pedido enviado para @${alvo.username}!`, id: pedido.id };
  }

  // ── Aceitar pedido ───────────────────────────────────────────
  async accept(userId: string, requestId: string) {
    const pedido = await this.prisma.friendship.findUnique({
      where: { id: requestId },
      include: { requester: { select: USER_SELECT }, addressee: { select: USER_SELECT } },
    });
    if (!pedido || pedido.status !== 'PENDING') throw new NotFoundException('Pedido não encontrado');
    if (pedido.addresseeId !== userId) throw new ForbiddenException('Este pedido não é para você');

    await this.prisma.friendship.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED' },
    });

    this.gateway.emitToUser(pedido.requesterId, 'friend:accepted', { friend: pedido.addressee });
    return { message: `Agora vocês são amigos!`, friend: pedido.requester };
  }

  // ── Recusar / cancelar pedido ────────────────────────────────
  async removeRequest(userId: string, requestId: string) {
    const pedido = await this.prisma.friendship.findUnique({ where: { id: requestId } });
    if (!pedido || pedido.status !== 'PENDING') throw new NotFoundException('Pedido não encontrado');
    if (pedido.requesterId !== userId && pedido.addresseeId !== userId) {
      throw new ForbiddenException('Este pedido não é seu');
    }
    await this.prisma.friendship.delete({ where: { id: requestId } });
    return { message: 'Pedido removido' };
  }

  // ── Desfazer amizade ─────────────────────────────────────────
  async unfriend(userId: string, friendId: string) {
    const amizade = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });
    if (!amizade) throw new NotFoundException('Vocês não são amigos');
    await this.prisma.friendship.delete({ where: { id: amizade.id } });
    return { message: 'Amizade desfeita' };
  }

  // ── Lista de amigos (com status online) ──────────────────────
  async listFriends(userId: string) {
    const amizades = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: { requester: { select: USER_SELECT }, addressee: { select: USER_SELECT } },
      orderBy: { updatedAt: 'desc' },
    });

    const amigos = amizades.map((a) =>
      a.requesterId === userId ? a.addressee : a.requester,
    );
    const statuses = await this.presence.getBulkStatus(amigos.map((f) => f.id));

    return amigos.map((f) => ({ ...f, status: statuses[f.id] || 'offline' }));
  }

  // ── Pedidos pendentes (recebidos e enviados) ─────────────────
  async listRequests(userId: string) {
    const [recebidos, enviados] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { addresseeId: userId, status: 'PENDING' },
        include: { requester: { select: USER_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.friendship.findMany({
        where: { requesterId: userId, status: 'PENDING' },
        include: { addressee: { select: USER_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      incoming: recebidos.map((p) => ({ id: p.id, user: p.requester, createdAt: p.createdAt })),
      outgoing: enviados.map((p) => ({ id: p.id, user: p.addressee, createdAt: p.createdAt })),
    };
  }
}
