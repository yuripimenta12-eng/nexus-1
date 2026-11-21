import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { planoAtivo } from '../planos/planos.regras';
import { CATALOGO, CAMPO_PERFIL, itemPorId, type TipoItem } from './loja.catalogo';

const TIPOS: TipoItem[] = ['moldura', 'icone', 'placa', 'som'];
const valido = (p: { expiraEm: Date | null }) => !p.expiraEm || p.expiraEm.getTime() > Date.now();

@Injectable()
export class LojaService {
  constructor(private prisma: PrismaService) {}

  /** Vitrine: catálogo com o que a pessoa já tem e o que está usando. */
  async listar(userId: string) {
    const [carteira, posses, perfil, user] = await Promise.all([
      this.prisma.carteira.findUnique({ where: { userId }, select: { saldo: true } }),
      this.prisma.itemPosse.findMany({ where: { userId }, select: { itemId: true, expiraEm: true } }),
      this.prisma.profile.findUnique({ where: { userId }, select: { moldura: true, icone: true, placa: true, somEntrada: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { plano: true, planoAte: true } }),
    ]);
    const tem = new Map(posses.filter(valido).map(p => [p.itemId, p.expiraEm]));
    return {
      saldo: carteira?.saldo ?? 0,
      plano: planoAtivo(user?.plano, user?.planoAte),
      equipados: { moldura: perfil?.moldura ?? null, icone: perfil?.icone ?? null, placa: perfil?.placa ?? null, som: perfil?.somEntrada ?? null },
      itens: CATALOGO.map(i => ({ ...i, possui: tem.has(i.id), expiraEm: tem.get(i.id) ?? null })),
    };
  }

  /** Compra com Nex. O desconto do saldo só acontece se ele cobrir o preço (condição no banco). */
  async comprar(userId: string, itemId: string) {
    const item = itemPorId(itemId);
    if (!item) throw new NotFoundException('Item não encontrado');
    if (item.preco === null) throw new BadRequestException('Esse item não é vendido na loja');
    if (item.soPro) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { plano: true, planoAte: true } });
      if (planoAtivo(u?.plano, u?.planoAte) !== 'pro') throw new ForbiddenException('Item exclusivo de quem tem o Nexus Pro');
    }
    const ja = await this.prisma.itemPosse.findUnique({ where: { userId_itemId: { userId, itemId } } });
    if (ja && valido(ja)) throw new ConflictException('Você já tem esse item');
    const preco = item.preco;
    const r = await this.prisma.$transaction(async (tx) => {
      const ok = await tx.carteira.updateMany({ where: { userId, saldo: { gte: preco } }, data: { saldo: { decrement: preco } } });
      if (ok.count !== 1) throw new BadRequestException('Nex insuficiente para esse item');
      await tx.itemPosse.upsert({
        where: { userId_itemId: { userId, itemId } },
        create: { userId, itemId, origem: 'loja' },
        update: { origem: 'loja', expiraEm: null },
      });
      await tx.nexMovimento.create({ data: { userId, valor: -preco, motivo: `Loja: ${item.nome}`.slice(0, 48) } });
      return tx.carteira.findUnique({ where: { userId }, select: { saldo: true } });
    });
    return { itemId, saldo: r!.saldo };
  }

  /** Equipa (ou tira, com itemId null) um item que a pessoa tem. */
  async equipar(userId: string, tipo: unknown, itemId: unknown) {
    if (!TIPOS.includes(tipo as TipoItem)) throw new BadRequestException('Tipo inválido');
    const t = tipo as TipoItem;
    const campo = CAMPO_PERFIL[t];
    if (itemId === null) {
      await this.prisma.profile.update({ where: { userId }, data: { [campo]: null } });
      return { tipo: t, itemId: null };
    }
    const item = typeof itemId === 'string' ? itemPorId(itemId) : undefined;
    if (!item || item.tipo !== t) throw new BadRequestException('Item inválido para esse lugar');
    const posse = await this.prisma.itemPosse.findUnique({ where: { userId_itemId: { userId, itemId: item.id } } });
    if (!posse || !valido(posse)) throw new ForbiddenException('Você não tem esse item');
    await this.prisma.profile.update({ where: { userId }, data: { [campo]: item.id } });
    return { tipo: t, itemId: item.id };
  }
}
