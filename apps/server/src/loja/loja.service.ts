import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { planoAtivo } from '../planos/planos.regras';
import { randomInt } from 'crypto';
import { CATALOGO, CAMPO_PERFIL, itemPorId, valorDoItem, type TipoPerfil } from './loja.catalogo';
import { BAUS, bauPorId, bauAtivo, sortearPremio, somaPesos } from './loja.baus';

const TIPOS: TipoPerfil[] = ['moldura', 'icone', 'placa', 'som'];
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

  /** Baús à venda agora, com a chance de cada prêmio em %. */
  listarBaus() {
    return BAUS.filter(b => bauAtivo(b)).map(b => {
      const total = somaPesos(b);
      return {
        id: b.id, nome: b.nome, preco: b.preco, cor: b.cor, desc: b.desc, ate: b.ate ?? null,
        premios: b.premios.map(p => {
          const item = p.item ? itemPorId(p.item) : undefined;
          return { item: item ? { id: item.id, nome: item.nome, tipo: item.tipo, raridade: item.raridade } : null, nex: p.nex ?? null, chance: Math.round((p.peso / total) * 1000) / 10 };
        }),
      };
    });
  }

  /** Abre um baú: cobra, sorteia no servidor e entrega (repetido vira metade em Nex). */
  async abrirBau(userId: string, id: string) {
    const bau = bauPorId(id);
    if (!bau || !bauAtivo(bau)) throw new NotFoundException('Baú não encontrado');
    const indice = sortearPremio(bau, randomInt(0, somaPesos(bau)));
    const premio = bau.premios[indice];
    const item = premio.item ? itemPorId(premio.item) : undefined;
    const r = await this.prisma.$transaction(async (tx) => {
      const ok = await tx.carteira.updateMany({ where: { userId, saldo: { gte: bau.preco } }, data: { saldo: { decrement: bau.preco } } });
      if (ok.count !== 1) throw new BadRequestException('Nex insuficiente para esse baú');
      await tx.nexMovimento.create({ data: { userId, valor: -bau.preco, motivo: `Abriu ${bau.nome}`.slice(0, 48) } });
      let repetido = false, reembolso = 0, nex = premio.nex ?? 0;
      if (item) {
        const ja = await tx.itemPosse.findUnique({ where: { userId_itemId: { userId, itemId: item.id } } });
        if (ja && valido(ja)) {
          repetido = true;
          reembolso = Math.floor(valorDoItem(item) / 2);
        } else {
          await tx.itemPosse.upsert({
            where: { userId_itemId: { userId, itemId: item.id } },
            create: { userId, itemId: item.id, origem: 'bau' },
            update: { origem: 'bau', expiraEm: null },
          });
        }
      }
      const ganho = nex + reembolso;
      if (ganho > 0) {
        await tx.carteira.update({ where: { userId }, data: { saldo: { increment: ganho }, totalGanho: { increment: ganho } } });
        await tx.nexMovimento.create({ data: { userId, valor: ganho, motivo: (repetido ? `Repetido no baú: ${item!.nome}` : `Prêmio do ${bau.nome}`).slice(0, 48) } });
      }
      const c = await tx.carteira.findUnique({ where: { userId }, select: { saldo: true } });
      return { repetido, reembolso, nex, saldo: c!.saldo };
    });
    return {
      indice,
      premio: item ? { tipo: 'item', item: { id: item.id, nome: item.nome, tipo: item.tipo, raridade: item.raridade } } : { tipo: 'nex', nex: r.nex },
      repetido: r.repetido, reembolso: r.reembolso, saldo: r.saldo,
    };
  }

  /** Veste um servidor com um tema que a pessoa tem (só dono ou admin do servidor). */
  async aplicarTema(userId: string, serverId: unknown, itemId: unknown) {
    if (typeof serverId !== 'string') throw new BadRequestException('Servidor inválido');
    const server = await this.prisma.server.findUnique({ where: { id: serverId }, select: { ownerId: true } });
    if (!server) throw new NotFoundException('Servidor não encontrado');
    const m = await this.prisma.serverMember.findUnique({ where: { serverId_userId: { serverId, userId } }, select: { role: true, banned: true } });
    const pode = server.ownerId === userId || (m && !m.banned && (m.role === 'OWNER' || m.role === 'ADMIN'));
    if (!pode) throw new ForbiddenException('Só o dono ou um admin do servidor muda o tema');
    if (itemId === null) {
      await this.prisma.server.update({ where: { id: serverId }, data: { tema: null } });
      return { serverId, tema: null };
    }
    const item = typeof itemId === 'string' ? itemPorId(itemId) : undefined;
    if (!item || item.tipo !== 'tema') throw new BadRequestException('Tema inválido');
    const posse = await this.prisma.itemPosse.findUnique({ where: { userId_itemId: { userId, itemId: item.id } } });
    if (!posse || !valido(posse)) throw new ForbiddenException('Você não tem esse tema');
    await this.prisma.server.update({ where: { id: serverId }, data: { tema: item.id } });
    return { serverId, tema: item.id };
  }

  /** Equipa (ou tira, com itemId null) um item que a pessoa tem. */
  async equipar(userId: string, tipo: unknown, itemId: unknown) {
    if (!TIPOS.includes(tipo as TipoPerfil)) throw new BadRequestException('Tipo inválido');
    const t = tipo as TipoPerfil;
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
