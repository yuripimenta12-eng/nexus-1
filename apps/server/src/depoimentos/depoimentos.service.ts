import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepoimentosService {
  constructor(private prisma: PrismaService) {}

  private async exigirAdmin(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
    if (!u?.isAdmin) throw new ForbiddenException('Só o dono do Nexus');
  }

  /** O comentário da própria pessoa (para editar). */
  meu(userId: string) {
    return this.prisma.depoimento.findUnique({ where: { userId }, select: { texto: true, nota: true, aprovado: true } });
  }

  /** Cria ou edita; qualquer mudança volta para a fila de aprovação. */
  async enviar(userId: string, dto: { texto?: unknown; nota?: unknown }) {
    const texto = typeof dto?.texto === 'string' ? dto.texto.replace(/\s+/g, ' ').trim() : '';
    if (texto.length < 10 || texto.length > 280) throw new BadRequestException('Escreva de 10 a 280 caracteres');
    const nota = Math.round(Number(dto?.nota));
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new BadRequestException('Nota de 1 a 5');
    await this.prisma.depoimento.upsert({
      where: { userId },
      create: { userId, texto, nota },
      update: { texto, nota, aprovado: false },
    });
    return { texto, nota, aprovado: false };
  }

  async apagarMeu(userId: string) {
    await this.prisma.depoimento.deleteMany({ where: { userId } });
    return { ok: true };
  }

  /** Página inicial (sem login): só os aprovados, com nome e foto de quem escreveu. */
  async publicos() {
    const lista = await this.prisma.depoimento.findMany({
      where: { aprovado: true, user: { isSuspended: false } },
      orderBy: { atualizadoEm: 'desc' },
      take: 30,
      select: {
        id: true, texto: true, nota: true,
        user: { select: { username: true, plano: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
    return lista.map(d => ({
      id: d.id, texto: d.texto, nota: d.nota,
      nome: d.user.profile?.displayName || d.user.username,
      avatarUrl: d.user.profile?.avatarUrl || null,
      plano: d.user.plano,
    }));
  }

  // ── Painel do dono ──
  async todos(adminId: string) {
    await this.exigirAdmin(adminId);
    return this.prisma.depoimento.findMany({
      orderBy: [{ aprovado: 'asc' }, { atualizadoEm: 'desc' }],
      take: 200,
      select: {
        id: true, texto: true, nota: true, aprovado: true, atualizadoEm: true,
        user: { select: { username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
  }

  async moderar(adminId: string, id: string, acao: unknown) {
    await this.exigirAdmin(adminId);
    const d = await this.prisma.depoimento.findUnique({ where: { id }, select: { id: true } });
    if (!d) throw new NotFoundException('Comentário não encontrado');
    if (acao === 'apagar') {
      await this.prisma.depoimento.delete({ where: { id } });
      return { id, apagado: true };
    }
    if (acao !== 'aprovar' && acao !== 'esconder') throw new BadRequestException('Ação inválida');
    await this.prisma.depoimento.update({ where: { id }, data: { aprovado: acao === 'aprovar' } });
    return { id, aprovado: acao === 'aprovar' };
  }
}
