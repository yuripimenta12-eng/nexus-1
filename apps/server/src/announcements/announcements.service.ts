import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NexusGateway } from '../gateway/nexus.gateway';
import { PushService } from '../push/push.service';

const TITULO_MAX = 100;
const TEXTO_MAX = 2000;

// Comunicados do dono do Nexus para todos os usuários: aparecem em destaque
// até a pessoa clicar em "Entendi", chegam como notificação para quem está
// com o Nexus fechado e ficam guardados na lista de comunicados.
@Injectable()
export class AnnouncementsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NexusGateway,
    private push: PushService,
  ) {}

  private async requireAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
    if (!user?.isAdmin) throw new ForbiddenException('Só o dono do Nexus pode enviar comunicados');
  }

  // Os 30 mais recentes, com "lido" desta pessoa. "pendente" = ainda não lido
  // e enviado depois que a conta foi criada (conta nova não recebe aviso velho).
  async list(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    const items = await this.prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { reads: { where: { userId }, select: { readAt: true } } },
    });
    return items.map(a => ({
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt,
      read: a.reads.length > 0,
      pending: a.reads.length === 0 && !!user && a.createdAt >= user.createdAt,
    }));
  }

  async markRead(userId: string, id: string) {
    const exists = await this.prisma.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Comunicado não encontrado');
    await this.prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId } },
      create: { announcementId: id, userId },
      update: {},
    });
    return { ok: true };
  }

  async create(userId: string, dto: { title?: unknown; body?: unknown }) {
    await this.requireAdmin(userId);
    const title = typeof dto.title === 'string' ? dto.title.trim() : '';
    const body = typeof dto.body === 'string' ? dto.body.trim() : '';
    if (!title || title.length > TITULO_MAX) throw new BadRequestException(`O título precisa ter de 1 a ${TITULO_MAX} caracteres`);
    if (!body || body.length > TEXTO_MAX) throw new BadRequestException(`O texto precisa ter de 1 a ${TEXTO_MAX} caracteres`);

    const a = await this.prisma.announcement.create({ data: { title, body, authorId: userId } });
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'ANNOUNCEMENT_CREATE', targetType: 'ANNOUNCEMENT', targetId: a.id, meta: { title } },
    }).catch(() => { /* auditoria não impede o envio */ });

    const item = { id: a.id, title: a.title, body: a.body, createdAt: a.createdAt, read: false, pending: true };
    // Quem está com o Nexus aberto vê na hora; quem está fechado recebe notificação
    this.gateway.emitToAll('announcement:new', item);
    const users = await this.prisma.user.findMany({ where: { isSuspended: false, id: { not: userId } }, select: { id: true } });
    this.push.notifyUsers(users.map(u => u.id), {
      title: `📢 ${title}`,
      body,
      url: '/app',
      tag: `announcement:${a.id}`,
    });
    return item;
  }

  // Painel do dono: enviados, com quantas pessoas já leram
  async adminList(userId: string) {
    await this.requireAdmin(userId);
    const [items, total] = await Promise.all([
      this.prisma.announcement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { _count: { select: { reads: true } } },
      }),
      this.prisma.user.count({ where: { isSuspended: false } }),
    ]);
    return {
      totalUsers: total,
      items: items.map(a => ({ id: a.id, title: a.title, body: a.body, createdAt: a.createdAt, reads: a._count.reads })),
    };
  }

  async remove(userId: string, id: string) {
    await this.requireAdmin(userId);
    const a = await this.prisma.announcement.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!a) throw new NotFoundException('Comunicado não encontrado');
    await this.prisma.announcement.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'ANNOUNCEMENT_DELETE', targetType: 'ANNOUNCEMENT', targetId: id, meta: { title: a.title } },
    }).catch(() => {});
    this.gateway.emitToAll('announcement:deleted', { id });
    return { ok: true };
  }
}
