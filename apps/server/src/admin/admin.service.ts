import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private async requireAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isAdmin) throw new ForbiddenException('Acesso restrito a administradores');
  }

  async getUsers(userId: string, page = 1, limit = 50, search?: string) {
    await this.requireAdmin(userId);

    page = Number(page) || 1;   // query ausente vira NaN com enableImplicitConversion
    limit = Number(limit) || 50;
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as any } },
            { username: { contains: search, mode: 'insensitive' as any } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: { profile: true, _count: { select: { memberships: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map(u => { const { passwordHash, ...s } = u; return s; }),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async getServers(userId: string, page = 1, limit = 50) {
    await this.requireAdmin(userId);

    page = Number(page) || 1;   // query ausente vira NaN com enableImplicitConversion
    limit = Number(limit) || 50;
    const skip = (page - 1) * limit;
    const [servers, total] = await Promise.all([
      this.prisma.server.findMany({
        skip,
        take: limit,
        include: { _count: { select: { members: true, channels: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.server.count(),
    ]);

    return { servers, total, page, pages: Math.ceil(total / limit) };
  }

  async suspendUser(adminId: string, targetId: string, suspend: boolean) {
    await this.requireAdmin(adminId);

    await this.prisma.user.update({
      where: { id: targetId },
      data: { isSuspended: suspend },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: suspend ? 'ADMIN_SUSPEND_USER' : 'ADMIN_UNSUSPEND_USER',
        targetType: 'USER',
        targetId: targetId,
      },
    });
  }

  async getReports(userId: string, page = 1, limit = 50) {
    await this.requireAdmin(userId);

    page = Number(page) || 1;   // query ausente vira NaN com enableImplicitConversion
    limit = Number(limit) || 50;
    const skip = (page - 1) * limit;
    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        skip,
        take: limit,
        include: {
          reporter: { include: { profile: true } },
          targetUser: { include: { profile: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.report.count(),
    ]);

    return { reports, total, page, pages: Math.ceil(total / limit) };
  }

  async resolveReport(adminId: string, reportId: string, status: string, resolution?: string) {
    await this.requireAdmin(adminId);

    return this.prisma.report.update({
      where: { id: reportId },
      data: { status: status as any, resolvedById: adminId, resolvedAt: new Date(), resolution },
    });
  }

  async getMetrics(userId: string) {
    await this.requireAdmin(userId);

    const [users, servers, messages, activeToday] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.server.count(),
      this.prisma.message.count({ where: { deleted: false } }),
      this.prisma.user.count({
        where: { sessions: { some: { createdAt: { gte: new Date(Date.now() - 86400000) } } } },
      }),
    ]);

    // Cadastros por dia (últimos 14 dias) para o gráfico do painel
    const since = new Date(Date.now() - 14 * 86400000);
    const recentes = await this.prisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    });
    const porDia = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      porDia.set(d.toISOString().slice(0, 10), 0);
    }
    for (const u of recentes) {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (porDia.has(key)) porDia.set(key, (porDia.get(key) || 0) + 1);
    }
    const signupsByDay = [...porDia.entries()].map(([date, count]) => ({ date, count }));

    return { users, servers, messages, activeToday, signupsByDay };
  }

  async getAuditLogs(userId: string, serverId?: string, page = 1, limit = 50) {
    await this.requireAdmin(userId);

    page = Number(page) || 1;   // query ausente vira NaN com enableImplicitConversion
    limit = Number(limit) || 50;
    const skip = (page - 1) * limit;
    const where = serverId ? { serverId } : {};

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: { actor: { include: { profile: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, pages: Math.ceil(total / limit) };
  }
}
