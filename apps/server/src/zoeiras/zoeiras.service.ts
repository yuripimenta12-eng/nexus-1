import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { VoiceService } from '../voice/voice.service';
import { NexusGateway } from '../gateway/nexus.gateway';
import {
  ZOEIRAS, APELIDOS, zoeiraPorId, ESPERA_LEVE_MS, ESPERA_PESADA_MS, ESPERA_ALVO_PESADA_MS,
} from './zoeiras.catalogo';

@Injectable()
export class ZoeirasService {
  private ultimaLeve = new Map<string, number>();
  private ultimaPesada = new Map<string, number>();
  private alvoPesada = new Map<string, number>();

  constructor(private prisma: PrismaService, private voice: VoiceService, private gateway: NexusGateway) {}

  async listar(userId: string) {
    const [carteira, estoque, perfil] = await Promise.all([
      this.prisma.carteira.findUnique({ where: { userId }, select: { saldo: true } }),
      this.prisma.zoeiraEstoque.findMany({ where: { userId }, select: { zoeira: true, qtd: true } }),
      this.prisma.profile.findUnique({ where: { userId }, select: { receberZoeiras: true, escudoAte: true } }),
    ]);
    const qtd = (id: string) => estoque.find(e => e.zoeira === id)?.qtd ?? 0;
    return {
      saldo: carteira?.saldo ?? 0,
      receberZoeiras: perfil?.receberZoeiras ?? true,
      escudoAte: perfil?.escudoAte && perfil.escudoAte.getTime() > Date.now() ? perfil.escudoAte : null,
      zoeiras: ZOEIRAS.map(z => ({ ...z, qtd: qtd(z.id) })),
    };
  }

  /** Compra 1 a 10 de uma vez, com Nex (desconto só se o saldo cobre). */
  async comprar(userId: string, id: string, quantidade: unknown) {
    const z = zoeiraPorId(id);
    if (!z) throw new NotFoundException('Zoeira não encontrada');
    const qtd = Math.round(Number(quantidade ?? 1));
    if (!Number.isFinite(qtd) || qtd < 1 || qtd > 10) throw new BadRequestException('Quantidade de 1 a 10');
    const total = z.preco * qtd;
    const r = await this.prisma.$transaction(async (tx) => {
      const ok = await tx.carteira.updateMany({ where: { userId, saldo: { gte: total } }, data: { saldo: { decrement: total } } });
      if (ok.count !== 1) throw new BadRequestException('Nex insuficiente');
      const e = await tx.zoeiraEstoque.upsert({
        where: { userId_zoeira: { userId, zoeira: z.id } },
        create: { userId, zoeira: z.id, qtd },
        update: { qtd: { increment: qtd } },
      });
      await tx.nexMovimento.create({ data: { userId, valor: -total, motivo: `Zoeira: ${qtd}x ${z.nome}`.slice(0, 48) } });
      const c = await tx.carteira.findUnique({ where: { userId }, select: { saldo: true } });
      return { saldo: c!.saldo, qtd: e.qtd };
    });
    return { zoeira: z.id, ...r };
  }

  /** Usa uma zoeira na call. Tudo é conferido aqui; a call só recebe o efeito. */
  async usar(userId: string, id: string, voiceRoomId: unknown, alvoId: unknown) {
    const z = zoeiraPorId(id);
    if (!z) throw new NotFoundException('Zoeira não encontrada');
    if (typeof voiceRoomId !== 'string') throw new BadRequestException('Sala inválida');
    const sala = await this.prisma.voiceRoom.findUnique({
      where: { id: voiceRoomId },
      select: { id: true, serverId: true, server: { select: { ownerId: true, zoeirasPesadas: true } } },
    });
    if (!sala) throw new NotFoundException('Sala não encontrada');
    // Quem está na call agora (o próprio serviço de voz confere o acesso de quem pede)
    const naCall = new Set((await this.voice.getRoomParticipants(voiceRoomId, userId)).map((p: any) => p.identity));
    if (!naCall.has(userId)) throw new ForbiddenException('Entre na call para usar zoeiras');

    const alvo = z.propria ? userId : typeof alvoId === 'string' ? alvoId : null;
    if (!z.propria && !z.todos) {
      if (!alvo || alvo === userId) throw new BadRequestException('Escolha alguém da call');
      if (!naCall.has(alvo)) throw new BadRequestException('Essa pessoa não está na call');
    }

    const agora = Date.now();
    const mapa = z.pesada ? this.ultimaPesada : this.ultimaLeve;
    const espera = z.pesada ? ESPERA_PESADA_MS : ESPERA_LEVE_MS;
    if (agora - (mapa.get(userId) ?? 0) < espera) throw new ConflictException('Calma! Espere um pouco para a próxima zoeira');

    if (alvo && alvo !== userId && !z.todos) {
      const p = await this.prisma.profile.findUnique({ where: { userId: alvo }, select: { receberZoeiras: true, escudoAte: true, displayName: true } });
      if (p && !p.receberZoeiras) throw new ConflictException(`${p.displayName} não aceita zoeiras`);
      if (p?.escudoAte && p.escudoAte.getTime() > agora) throw new ConflictException(`${p.displayName} está com escudo 🛡️`);
      if (z.pesada) {
        if (!sala.server.zoeirasPesadas) throw new ForbiddenException('O dono do servidor não liberou as zoeiras pesadas');
        const m = await this.prisma.serverMember.findUnique({ where: { serverId_userId: { serverId: sala.serverId, userId: alvo } }, select: { role: true } });
        if (alvo === sala.server.ownerId || m?.role === 'OWNER' || m?.role === 'ADMIN') {
          throw new ForbiddenException('Zoeira pesada não vale em dono nem admin do servidor');
        }
        if (agora - (this.alvoPesada.get(alvo) ?? 0) < ESPERA_ALVO_PESADA_MS) throw new ConflictException('Essa pessoa levou uma zoeira pesada agora há pouco');
      }
    }

    const gasto = await this.prisma.zoeiraEstoque.updateMany({ where: { userId, zoeira: z.id, qtd: { gte: 1 } }, data: { qtd: { decrement: 1 } } });
    if (gasto.count !== 1) throw new BadRequestException('Você não tem essa zoeira. Compre na loja');
    mapa.set(userId, agora);
    if (z.pesada && alvo) this.alvoPesada.set(alvo, agora);
    if (mapa.size > 20000) mapa.clear();

    if (z.id === 'escudo') {
      await this.prisma.profile.update({ where: { userId }, data: { escudoAte: new Date(agora + z.duracaoMs) } });
    }
    const autor = await this.prisma.profile.findUnique({ where: { userId }, select: { displayName: true } });
    const efeito = {
      id: z.id, emoji: z.emoji, de: userId, deNome: autor?.displayName || 'Alguém',
      alvo: z.todos ? null : alvo, ate: agora + z.duracaoMs,
      ...(z.id === 'apelido' ? { apelido: APELIDOS[randomInt(0, APELIDOS.length)] } : {}),
    };
    this.gateway.server.to(`voice:${voiceRoomId}`).emit('zoeira', efeito);
    const restante = await this.prisma.zoeiraEstoque.findUnique({ where: { userId_zoeira: { userId, zoeira: z.id } }, select: { qtd: true } });
    return { ok: true, restante: restante?.qtd ?? 0, efeito };
  }

  async preferencia(userId: string, receber: unknown) {
    if (typeof receber !== 'boolean') throw new BadRequestException('Valor inválido');
    await this.prisma.profile.update({ where: { userId }, data: { receberZoeiras: receber } });
    return { receberZoeiras: receber };
  }
}
