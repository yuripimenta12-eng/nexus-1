import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { planoAtivo, type Plano } from '../planos/planos.regras';
import {
  PRESENCA, ROLETA, GIROS_POR_DIA, BONUS, MISSOES, comBonus,
  diaBR, inicioDoDiaBR, proximoDiaPresenca, premioDaRoleta,
} from './nex.regras';

const SEIS_HORAS = 6 * 3_600_000;

@Injectable()
export class NexService {
  constructor(private prisma: PrismaService) {}

  private async carteira(userId: string) {
    return this.prisma.carteira.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  private async plano(userId: string): Promise<Plano> {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { plano: true, planoAte: true } });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return planoAtivo(u.plano, u.planoAte);
  }

  /** Minutos em call hoje (sessões abertas há mais de 6 h não contam: ficaram presas). */
  private async minutosEmCallHoje(userId: string) {
    const inicio = inicioDoDiaBR();
    const agora = Date.now();
    const sessoes = await this.prisma.callParticipant.findMany({
      where: { userId, OR: [{ leftAt: null }, { leftAt: { gte: inicio } }], joinedAt: { lte: new Date(agora) } },
      select: { joinedAt: true, leftAt: true },
      take: 200,
    });
    let ms = 0;
    for (const s of sessoes) {
      if (!s.leftAt && agora - s.joinedAt.getTime() > SEIS_HORAS) continue;
      const fim = s.leftAt ? s.leftAt.getTime() : agora;
      const ini = Math.max(s.joinedAt.getTime(), inicio.getTime());
      if (fim > ini) ms += fim - ini;
    }
    return Math.floor(ms / 60_000);
  }

  /** Progresso de cada missão, calculado dos dados reais (nada vem do navegador). */
  private async progresso(userId: string, c: { presencaMelhor: number; unidosVitorias: number; unidosData: string | null; unidosHoje: number }) {
    const inicio = inicioDoDiaBR();
    const hoje = diaBR();
    const [minutos, msgs, dms, perfil, amigos, servidores, calls, segundos] = await Promise.all([
      this.minutosEmCallHoje(userId),
      this.prisma.message.count({ where: { authorId: userId, createdAt: { gte: inicio }, deleted: false } }),
      this.prisma.directMessage.count({ where: { senderId: userId, createdAt: { gte: inicio } } }),
      this.prisma.profile.findUnique({ where: { userId }, select: { avatarUrl: true } }),
      this.prisma.friendship.count({ where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
      this.prisma.serverMember.count({ where: { userId, banned: false } }),
      this.prisma.callParticipant.count({ where: { userId } }),
      this.prisma.callStat.aggregate({ where: { userId }, _sum: { segundosCall: true } }),
    ]);
    return {
      'call-1h': minutos,
      'chat-10': msgs + dms,
      'unidos-dia': c.unidosData === hoje ? c.unidosHoje : 0,
      'foto': perfil?.avatarUrl ? 1 : 0,
      'amigo': amigos > 0 ? 1 : 0,
      'servidor': servidores > 0 ? 1 : 0,
      'primeira-call': calls > 0 ? 1 : 0,
      'presenca-7': c.presencaMelhor,
      'unidos-10': c.unidosVitorias,
      'maratona': Math.floor((segundos._sum.segundosCall || 0) / 3600),
    } as Record<string, number>;
  }

  /** Tudo da central de recompensas numa chamada só. */
  async resumo(userId: string) {
    const [c, plano] = await Promise.all([this.carteira(userId), this.plano(userId)]);
    const hoje = diaBR();
    const proximo = proximoDiaPresenca(c.presencaDia, c.presencaData);
    const diaAtual = proximo ?? c.presencaDia; // pegou hoje: mostra o dia que pegou
    const prog = await this.progresso(userId, c);
    const resgates = await this.prisma.missaoResgate.findMany({
      where: { userId, OR: [{ periodo: 'sempre' }, { periodo: hoje }] },
      select: { missao: true, periodo: true },
    });
    const resgatou = (id: string, tipo: string) => resgates.some(r => r.missao === id && r.periodo === (tipo === 'sempre' ? 'sempre' : hoje));
    const giros = GIROS_POR_DIA[plano];
    const usados = c.roletaData === hoje ? c.roletaGiros : 0;
    return {
      saldo: c.saldo,
      plano,
      bonus: BONUS[plano],
      presenca: {
        dia: diaAtual,
        pegouHoje: proximo === null,
        valores: PRESENCA.map(v => comBonus(v, plano)),
        sequencia: proximo === null ? c.presencaDia : proximo - 1,
      },
      roleta: { girosRestantes: Math.max(0, giros - usados), giros, premios: ROLETA.map(p => ({ nex: p.nex, chance: p.peso })) },
      missoes: MISSOES.map(m => ({
        id: m.id, tipo: m.tipo, titulo: m.titulo, desc: m.desc, icone: m.icone, meta: m.meta,
        nex: comBonus(m.nex, plano),
        progresso: Math.min(prog[m.id] ?? 0, m.meta),
        resgatada: resgatou(m.id, m.tipo),
      })),
    };
  }

  /** Pega a Presença de hoje. Pegar duas vezes no mesmo dia é impossível (condição no banco). */
  async pegarPresenca(userId: string) {
    const [c, plano] = await Promise.all([this.carteira(userId), this.plano(userId)]);
    const dia = proximoDiaPresenca(c.presencaDia, c.presencaData);
    if (dia === null) throw new ConflictException('Você já pegou a presença de hoje. Volte amanhã!');
    const hoje = diaBR();
    const ganho = comBonus(PRESENCA[dia - 1], plano);
    const r = await this.prisma.$transaction(async (tx) => {
      const ok = await tx.carteira.updateMany({
        where: { userId, OR: [{ presencaData: null }, { presencaData: { not: hoje } }] },
        data: {
          presencaDia: dia, presencaData: hoje,
          presencaMelhor: Math.max(c.presencaMelhor, dia),
          saldo: { increment: ganho }, totalGanho: { increment: ganho },
        },
      });
      if (ok.count !== 1) throw new ConflictException('Você já pegou a presença de hoje. Volte amanhã!');
      await tx.nexMovimento.create({ data: { userId, valor: ganho, motivo: `Presença dia ${dia}` } });
      return tx.carteira.findUnique({ where: { userId }, select: { saldo: true } });
    });
    return { dia, ganhou: ganho, saldo: r!.saldo };
  }

  /** Gira a roleta do dia. O sorteio é no servidor; o navegador só anima até o prêmio. */
  async girarRoleta(userId: string) {
    const [c, plano] = await Promise.all([this.carteira(userId), this.plano(userId)]);
    const hoje = diaBR();
    const max = GIROS_POR_DIA[plano];
    const usados = c.roletaData === hoje ? c.roletaGiros : 0;
    if (usados >= max) throw new ConflictException('Os giros de hoje acabaram. Volte amanhã!');
    const indice = premioDaRoleta(randomInt(0, 100));
    const ganho = ROLETA[indice].nex;
    const r = await this.prisma.$transaction(async (tx) => {
      const ok = c.roletaData === hoje
        ? await tx.carteira.updateMany({
            where: { userId, roletaData: hoje, roletaGiros: { lt: max } },
            data: { roletaGiros: { increment: 1 }, saldo: { increment: ganho }, totalGanho: { increment: ganho } },
          })
        : await tx.carteira.updateMany({
            where: { userId, OR: [{ roletaData: null }, { roletaData: { not: hoje } }] },
            data: { roletaData: hoje, roletaGiros: 1, saldo: { increment: ganho }, totalGanho: { increment: ganho } },
          });
      if (ok.count !== 1) throw new ConflictException('Os giros de hoje acabaram. Volte amanhã!');
      await tx.nexMovimento.create({ data: { userId, valor: ganho, motivo: 'Roleta do dia' } });
      return tx.carteira.findUnique({ where: { userId }, select: { saldo: true, roletaGiros: true } });
    });
    return { indice, ganhou: ganho, saldo: r!.saldo, girosRestantes: Math.max(0, max - r!.roletaGiros) };
  }

  /** Resgata uma missão cumprida. A chave do banco impede resgatar duas vezes. */
  async resgatarMissao(userId: string, id: string) {
    const m = MISSOES.find(x => x.id === id);
    if (!m) throw new BadRequestException('Missão não encontrada');
    const [c, plano] = await Promise.all([this.carteira(userId), this.plano(userId)]);
    const prog = await this.progresso(userId, c);
    if ((prog[m.id] ?? 0) < m.meta) throw new BadRequestException('Essa missão ainda não foi cumprida');
    const periodo = m.tipo === 'sempre' ? 'sempre' : diaBR();
    const ganho = comBonus(m.nex, plano);
    try {
      const r = await this.prisma.$transaction(async (tx) => {
        await tx.missaoResgate.create({ data: { userId, missao: m.id, periodo } });
        const cart = await tx.carteira.update({
          where: { userId }, data: { saldo: { increment: ganho }, totalGanho: { increment: ganho } }, select: { saldo: true },
        });
        await tx.nexMovimento.create({ data: { userId, valor: ganho, motivo: `Missão: ${m.titulo}`.slice(0, 48) } });
        return cart;
      });
      return { ganhou: ganho, saldo: r.saldo };
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Você já resgatou essa missão');
      throw e;
    }
  }

  async extrato(userId: string) {
    return this.prisma.nexMovimento.findMany({
      where: { userId }, orderBy: { criadoEm: 'desc' }, take: 30, select: { valor: true, motivo: true, criadoEm: true },
    });
  }

  /**
   * Vitória no UNidos (chamado pelo jogo). Só conta partida de verdade:
   * 2+ jogadores e pelo menos 1 minuto de jogo, para não virar fábrica de Nex.
   */
  async registrarVitoriaUnidos(userId: string, jogadores: number, duracaoMs: number) {
    if (jogadores < 2 || duracaoMs < 60_000) return;
    const hoje = diaBR();
    const c = await this.carteira(userId);
    await this.prisma.carteira.update({
      where: { userId },
      data: {
        unidosVitorias: { increment: 1 },
        unidosData: hoje,
        unidosHoje: c.unidosData === hoje ? { increment: 1 } : 1,
      },
    });
  }
}
