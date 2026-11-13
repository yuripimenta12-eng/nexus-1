import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { DIAS_POR_INDICACAO, ehPlano, estender, planoAtivo, recompensaIndicacao } from './planos.regras';

const LETRAS = 'abcdefghjkmnpqrstuvwxyz23456789'; // sem 0/o/1/l/i para não confundir
const SELECAO_MEU = { plano: true, planoAte: true, codigoIndicacao: true, diasGanhos: true } as const;

@Injectable()
export class PlanosService implements OnModuleInit, OnModuleDestroy {
  constructor(private prisma: PrismaService) {}

  private timer?: NodeJS.Timeout;

  // Plano pago vencido volta para "gratis" (assim o emblema some para os outros)
  onModuleInit() {
    const vencer = () => this.prisma.user.updateMany({
      where: { plano: { not: 'gratis' }, OR: [{ planoAte: null }, { planoAte: { lt: new Date() } }] },
      data: { plano: 'gratis', planoAte: null },
    }).catch(() => {});
    void vencer();
    this.timer = setInterval(vencer, 10 * 60_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private novoCodigo() {
    return Array.from(randomBytes(8), b => LETRAS[b % LETRAS.length]).join('');
  }

  /** Plano atual, validade e o painel de afiliado da pessoa. */
  async meu(userId: string) {
    let u = await this.prisma.user.findUnique({ where: { id: userId }, select: SELECAO_MEU });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    // O código nasce na primeira vez que a pessoa abre a página de planos
    for (let tentativa = 0; !u.codigoIndicacao && tentativa < 5; tentativa++) {
      try {
        u = await this.prisma.user.update({ where: { id: userId }, data: { codigoIndicacao: this.novoCodigo() }, select: SELECAO_MEU });
      } catch { /* código repetido: tenta outro */ }
    }
    const [indicados, convertidos] = await Promise.all([
      this.prisma.user.count({ where: { indicadoPorId: userId } }),
      this.prisma.user.count({ where: { indicadoPorId: userId, indicacaoPaga: true } }),
    ]);
    const plano = planoAtivo(u.plano, u.planoAte);
    return {
      plano,
      planoAte: plano === 'gratis' ? null : u.planoAte,
      codigo: u.codigoIndicacao,
      indicados,
      convertidos,
      diasGanhos: u.diasGanhos,
      diasPorIndicacao: DIAS_POR_INDICACAO,
    };
  }

  /** Quem indicou, pelo código do link (usado no cadastro). */
  async quemIndicou(codigo: unknown) {
    if (typeof codigo !== 'string' || !/^[a-z0-9]{4,12}$/.test(codigo)) return null;
    const u = await this.prisma.user.findUnique({ where: { codigoIndicacao: codigo }, select: { id: true } });
    return u?.id ?? null;
  }

  /**
   * O dono do Nexus dá (ou tira) um plano. Por enquanto é o único jeito de ter
   * plano pago; quando o pagamento entrar, ele chama isto mesmo.
   */
  async definir(targetId: string, plano: unknown, dias: unknown) {
    if (!ehPlano(plano)) throw new BadRequestException('Plano inválido');
    const alvo = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, plano: true, planoAte: true, indicadoPorId: true, indicacaoPaga: true },
    });
    if (!alvo) throw new NotFoundException('Usuário não encontrado');

    if (plano === 'gratis') {
      await this.prisma.user.update({ where: { id: targetId }, data: { plano: 'gratis', planoAte: null } });
      return { id: targetId, plano: 'gratis', planoAte: null };
    }
    const n = Math.round(Number(dias));
    if (!Number.isFinite(n) || n < 1 || n > 3660) throw new BadRequestException('Dias inválidos (1 a 3660)');
    // Mesmo plano ainda valendo: soma os dias; plano diferente: conta a partir de hoje
    const mesmo = planoAtivo(alvo.plano, alvo.planoAte) === plano;
    const planoAte = estender(mesmo ? alvo.planoAte : null, n);

    // Primeiro plano pago de quem veio por indicação: quem indicou ganha dias
    const pagarIndicacao = !!alvo.indicadoPorId && !alvo.indicacaoPaga;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetId },
        data: { plano, planoAte, ...(pagarIndicacao ? { indicacaoPaga: true } : {}) },
      });
      if (!pagarIndicacao) return;
      const quem = await tx.user.findUnique({ where: { id: alvo.indicadoPorId! }, select: { plano: true, planoAte: true } });
      if (!quem) return;
      await tx.user.update({
        where: { id: alvo.indicadoPorId! },
        data: { ...recompensaIndicacao(quem.plano, quem.planoAte), diasGanhos: { increment: DIAS_POR_INDICACAO } },
      });
    });
    return { id: targetId, plano, planoAte };
  }
}
