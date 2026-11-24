import { Injectable, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { CATALOGO } from '../loja/loja.catalogo';
import { toSafeUser } from '../common/safe-user';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_USER } from '../common/public-user';
import { BETA_CADASTROS_KEY } from '../common/beta';
import { PlanosService } from '../planos/planos.service';
import { NexusGateway } from '../gateway/nexus.gateway';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private planos: PlanosService, private gateway: NexusGateway) {}

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
      users: users.map(u => toSafeUser(u)),
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

    // O schema não tem relação owner no Server — resolve os donos à parte
    const donos = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(servers.map(s => s.ownerId))] } },
      select: { id: true, username: true, profile: { select: { displayName: true } } },
    });
    const donoPorId = new Map(donos.map(d => [d.id, d]));
    const comDono = servers.map(s => ({ ...s, owner: donoPorId.get(s.ownerId) || null }));

    return { servers: comDono, total, page, pages: Math.ceil(total / limit) };
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

  // ── Emblema BETA NEXT ───────────────────────────────────────────
  async getBeta(adminId: string) {
    await this.requireAdmin(adminId);
    const [row, total] = await Promise.all([
      this.prisma.appSetting.findUnique({ where: { key: BETA_CADASTROS_KEY } }),
      this.prisma.user.count({ where: { isBetaTester: true } }),
    ]);
    return { cadastrosGanham: row?.value !== '0', total };
  }

  // Contas novas ganham (ou não) o emblema; quem já tem continua com ele
  async setBetaCadastros(adminId: string, aberto: boolean) {
    await this.requireAdmin(adminId);
    if (typeof aberto !== 'boolean') throw new BadRequestException('Valor inválido');
    await this.prisma.appSetting.upsert({
      where: { key: BETA_CADASTROS_KEY },
      create: { key: BETA_CADASTROS_KEY, value: aberto ? '1' : '0' },
      update: { value: aberto ? '1' : '0' },
    });
    await this.prisma.auditLog.create({
      data: { actorId: adminId, action: aberto ? 'ADMIN_BETA_OPEN' : 'ADMIN_BETA_CLOSE', targetType: 'APP', targetId: BETA_CADASTROS_KEY },
    });
    return this.getBeta(adminId);
  }

  async setUserBeta(adminId: string, targetId: string, on: boolean) {
    await this.requireAdmin(adminId);
    if (typeof on !== 'boolean') throw new BadRequestException('Valor inválido');
    const alvo = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!alvo) throw new NotFoundException('Usuário não encontrado');
    await this.prisma.user.update({ where: { id: targetId }, data: { isBetaTester: on } });
    await this.prisma.auditLog.create({
      data: { actorId: adminId, action: on ? 'ADMIN_BETA_GRANT' : 'ADMIN_BETA_REVOKE', targetType: 'USER', targetId },
    });
    return { id: targetId, isBetaTester: on };
  }

  // Dar (ou tirar, com número negativo) Prisma na mão: enquanto o Pix não está ligado e para corrigir
  async setUserPrismas(adminId: string, targetId: string, quantidade: unknown) {
    await this.requireAdmin(adminId);
    if (typeof quantidade !== 'number' || !Number.isInteger(quantidade) || quantidade === 0 || Math.abs(quantidade) > 100000) {
      throw new BadRequestException('Quantidade inválida');
    }
    const q = quantidade;
    const alvo = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!alvo) throw new NotFoundException('Usuário não encontrado');
    const c = await this.prisma.$transaction(async (tx) => {
      await tx.carteira.upsert({ where: { userId: targetId }, create: { userId: targetId }, update: {} });
      const ok = await tx.carteira.updateMany({ where: { userId: targetId, ...(q < 0 ? { prismas: { gte: -q } } : {}) }, data: { prismas: { increment: q } } });
      if (ok.count !== 1) throw new BadRequestException('A pessoa não tem toda essa Prisma para tirar');
      await tx.prismaMovimento.create({ data: { userId: targetId, valor: q, motivo: q > 0 ? 'Dada pela equipe' : 'Tirada pela equipe' } });
      await tx.auditLog.create({ data: { actorId: adminId, action: q > 0 ? 'ADMIN_PRISMA_GRANT' : 'ADMIN_PRISMA_REVOKE', targetType: 'USER', targetId, meta: { quantidade: q } } });
      return tx.carteira.findUnique({ where: { userId: targetId }, select: { prismas: true } });
    });
    return { id: targetId, prismas: c!.prismas };
  }

  // Deslogar de todos os aparelhos: apaga as sessões (o login automático para de valer)
  // e avisa os aparelhos abertos para saírem na hora (sem esperar o acesso de 15 min vencer)
  async deslogarUsuario(adminId: string, targetId: string) {
    await this.requireAdmin(adminId);
    const alvo = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!alvo) throw new NotFoundException('Usuário não encontrado');
    const { count } = await this.prisma.session.deleteMany({ where: { userId: targetId } });
    await this.prisma.auditLog.create({ data: { actorId: adminId, action: 'ADMIN_FORCE_LOGOUT', targetType: 'USER', targetId, meta: { sessoes: count } } });
    this.gateway.emitToUser(targetId, 'sessao:encerrada', {});
    setTimeout(() => this.gateway.disconnectUser(targetId), 1500).unref(); // dá tempo do aviso chegar
    return { id: targetId, sessoes: count };
  }

  // Cargo Staff: ganha as molduras e o ícone da equipe. Ao tirar, sai o que era da equipe do perfil.
  async setUserStaff(adminId: string, targetId: string, on: boolean) {
    await this.requireAdmin(adminId);
    if (typeof on !== 'boolean') throw new BadRequestException('Valor inválido');
    const alvo = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true, isAdmin: true } });
    if (!alvo) throw new NotFoundException('Usuário não encontrado');
    await this.prisma.user.update({ where: { id: targetId }, data: { isStaff: on } });
    if (!on && !alvo.isAdmin) {
      const daEquipe = CATALOGO.filter(i => i.soStaff).map(i => i.id);
      await this.prisma.profile.updateMany({ where: { userId: targetId, moldura: { in: daEquipe } }, data: { moldura: null } });
      await this.prisma.profile.updateMany({ where: { userId: targetId, icone: { in: daEquipe } }, data: { icone: null } });
    }
    await this.prisma.auditLog.create({
      data: { actorId: adminId, action: on ? 'ADMIN_STAFF_GRANT' : 'ADMIN_STAFF_REVOKE', targetType: 'USER', targetId },
    });
    return { id: targetId, isStaff: on };
  }

  // Dar/tirar plano na mão (enquanto não há pagamento)
  async setUserPlano(adminId: string, targetId: string, plano: unknown, dias: unknown) {
    await this.requireAdmin(adminId);
    const r = await this.planos.definir(targetId, plano, dias);
    await this.prisma.auditLog.create({
      data: { actorId: adminId, action: `ADMIN_PLANO_${String(r.plano).toUpperCase()}`, targetType: 'USER', targetId },
    });
    // O app da pessoa guardou o plano de quando abriu: avisa para recarregar
    this.gateway.emitToUser(targetId, 'plano:atualizado', {});
    return r;
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
          reporter: ADMIN_USER,
          targetUser: ADMIN_USER,
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
        include: { actor: ADMIN_USER },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, page, pages: Math.ceil(total / limit) };
  }
}
