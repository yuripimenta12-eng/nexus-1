import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IDEIAS_EM_VOTACAO, JA_CHEGOU } from './ideias.lista';

const TIPOS = ['quero', 'nao'] as const;
type Tipo = (typeof TIPOS)[number];

@Injectable()
export class IdeiasService {
  constructor(private prisma: PrismaService) {}

  /** Lista com a contagem de votos e o voto da pessoa; mais pedidas primeiro. */
  async listar(userId: string) {
    const ids = IDEIAS_EM_VOTACAO.map(i => i.id);
    const [contagem, meus] = await Promise.all([
      this.prisma.ideiaVoto.groupBy({ by: ['ideia', 'tipo'], where: { ideia: { in: ids } }, _count: { _all: true } }),
      this.prisma.ideiaVoto.findMany({ where: { userId, ideia: { in: ids } }, select: { ideia: true, tipo: true } }),
    ]);
    const conta = (ideia: string, tipo: Tipo) =>
      contagem.find(c => c.ideia === ideia && c.tipo === tipo)?._count._all || 0;
    const ideias = IDEIAS_EM_VOTACAO.map(i => ({
      ...i,
      quero: conta(i.id, 'quero'),
      nao: conta(i.id, 'nao'),
      meuVoto: (meus.find(m => m.ideia === i.id)?.tipo as Tipo | undefined) ?? null,
    })).sort((a, b) => b.quero - a.quero);
    return { chegou: JA_CHEGOU, ideias };
  }

  /** Vota, troca o voto ou tira (tipo null). */
  async votar(userId: string, ideia: string, tipo: unknown) {
    if (!IDEIAS_EM_VOTACAO.some(i => i.id === ideia)) throw new BadRequestException('Ideia não encontrada');
    if (tipo === null) {
      await this.prisma.ideiaVoto.deleteMany({ where: { ideia, userId } });
      return { ideia, meuVoto: null };
    }
    if (!TIPOS.includes(tipo as Tipo)) throw new BadRequestException('Voto inválido');
    await this.prisma.ideiaVoto.upsert({
      where: { ideia_userId: { ideia, userId } },
      create: { ideia, userId, tipo: tipo as Tipo },
      update: { tipo: tipo as Tipo },
    });
    return { ideia, meuVoto: tipo };
  }
}
