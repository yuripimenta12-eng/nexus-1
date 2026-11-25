import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BENEFICIOS, DIAS_POR_INDICACAO, ehPlano, estender, planoAtivo, planoCobre, recompensaIndicacao } from './planos.regras';
import { itemPorId } from '../loja/loja.catalogo';

const LETRAS = 'abcdefghjkmnpqrstuvwxyz23456789'; // sem 0/o/1/l/i para não confundir
const SELECAO_MEU = { plano: true, planoAte: true, codigoIndicacao: true, diasGanhos: true } as const;

@Injectable()
export class PlanosService implements OnModuleInit, OnModuleDestroy {
  constructor(private prisma: PrismaService) {}

  private timer?: NodeJS.Timeout;

  // Plano pago vencido volta para "gratis" (assim o emblema some para os outros)
  onModuleInit() {
    const vencer = async () => {
      try {
        const where = { plano: { not: 'gratis' }, OR: [{ planoAte: null }, { planoAte: { lt: new Date() } }] };
        const vencidos = await this.prisma.user.findMany({ where, select: { id: true } });
        if (!vencidos.length) return;
        await this.prisma.user.updateMany({ where: { id: { in: vencidos.map(v => v.id) } }, data: { plano: 'gratis', planoAte: null } });
        await this.ajustarPerfil(vencidos.map(v => v.id));
      } catch { /* tenta de novo na próxima volta */ }
      await this.contarDiaAssinante().catch(() => { /* tenta de novo na próxima volta */ });
    };
    void vencer();
    this.timer = setInterval(vencer, 10 * 60_000);
    this.timer.unref?.();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  // Conquista Assinante: cada dia (de Brasília) com Nexus+ ou Pro ativo soma 1, uma vez por dia
  async contarDiaAssinante(agora = new Date()) {
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora); // AAAA-MM-DD
    await this.prisma.$executeRaw`
      UPDATE "users" SET "diasAssinante" = "diasAssinante" + 1, "assinanteDia" = ${hoje},
        "assinanteDesde" = COALESCE("assinanteDesde", ${agora})
      WHERE "plano" <> 'gratis' AND "planoAte" > ${agora} AND ("assinanteDia" IS NULL OR "assinanteDia" <> ${hoje})`;
  }

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

  /** Tira do perfil o que o plano atual não cobre: cor do nome, moldura do plano e foto/capa animada. */
  async ajustarPerfil(userIds: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, plano: true, planoAte: true, profile: { select: { corNome: true, moldura: true, efeitoPerfil: true, avatarUrl: true, bannerUrl: true } } },
    });
    // Foto animada enviada com plano tem uma cópia parada ao lado (ver UploadService)
    const parar = (url: string | null) => (url && /-anim\.gif$/.test(url) ? url.replace(/-anim\.gif$/, '-anim-estatico.webp') : undefined);
    for (const u of users) {
      const p = u.profile;
      if (!p) continue;
      const plano = planoAtivo(u.plano, u.planoAte);
      const b = BENEFICIOS[plano];
      const data: { corNome?: null; moldura?: null; efeitoPerfil?: null; avatarUrl?: string; bannerUrl?: string } = {};
      if (!b.corNome && p.corNome) data.corNome = null;
      const m = p.moldura ? itemPorId(p.moldura) : undefined;
      if (m?.incluiPlano && !planoCobre(plano, m.incluiPlano)) data.moldura = null;
      const e = p.efeitoPerfil ? itemPorId(p.efeitoPerfil) : undefined;
      if (e?.incluiPlano && !planoCobre(plano, e.incluiPlano)) data.efeitoPerfil = null;
      if (!b.avatarAnimado) {
        const a = parar(p.avatarUrl); if (a) data.avatarUrl = a;
        const c = parar(p.bannerUrl); if (c) data.bannerUrl = c;
      }
      if (Object.keys(data).length) await this.prisma.profile.update({ where: { userId: u.id }, data });
    }
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
      await this.ajustarPerfil([targetId]);
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
    await this.ajustarPerfil([targetId]); // de Pro para Nexus+: sai a moldura do Pro
    return { id: targetId, plano, planoAte };
  }
}
