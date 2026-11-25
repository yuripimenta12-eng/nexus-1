import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { FIM_NEXUS_2026, MARATONA_MS, eventosAtivos, horaDeBrasilia, lerReciboDj, segundosACreditar } from './placar.regras';

const HORA = 3600;

// Chaves fixas: o site tem o nome, o ícone e o texto de cada uma
export const CONQUISTAS = {
  'tagarela': { mensagens: 100 },
  'mil-mensagens': { mensagens: 1000 },
  'rato-de-call': { segundosCall: 10 * HORA },
  'mora-na-call': { segundosCall: 100 * HORA },
  'dj-da-mesa': { musicas: 100 },
  'streamer': { lives: 10 },
  'rosto-conhecido': { segundosCamera: 10 * HORA },
  'coruja': {}, // estar em call entre 2h e 5h (horário de Brasília)
  // Eventos (regras de data em placar.regras.ts): só dá para ganhar na data
  'nexus-2026': {}, // usou o Nexus em 2026
  'natal-2026': {}, 'virada-2027': {}, 'carnaval-2027': {},
  'maratonista': {}, // 5 h seguidas na mesma call
  'rei-do-unidos': { unidosVitorias: 10 },
  'sortudo': { parimparVitorias: 10 },
  'anfitriao': { membrosServidor: 10 },
  'popular': { amigos: 10 },
  'colecionador': { itens: 15 },
  'veterano-1': { diasConta: 365 }, 'veterano-2': { diasConta: 730 }, 'veterano-3': { diasConta: 1095 },
  // Assinante (Nexus+ ou Pro): dias com plano pago, somados (não zeram se parar)
  'assinante-1': { diasAssinante: 1 }, 'assinante-2': { diasAssinante: 30 }, 'assinante-3': { diasAssinante: 90 },
  'assinante-4': { diasAssinante: 180 }, 'assinante-5': { diasAssinante: 365 }, 'assinante-6': { diasAssinante: 730 },
  'assinante-7': { diasAssinante: 1095 }, 'assinante-8': { diasAssinante: 1825 },
  // Tempo de jogo (app de PC com "Mostrar o jogo" ligado), em minutos
  'jogo-1': { minutosJogo: 60 }, 'jogo-2': { minutosJogo: 300 }, 'jogo-3': { minutosJogo: 1200 },
  'jogo-4': { minutosJogo: 4500 }, 'jogo-5': { minutosJogo: 9000 }, 'jogo-6': { minutosJogo: 18000 },
  'jogo-7': { minutosJogo: 30000 }, 'jogo-8': { minutosJogo: 60000 }, 'jogo-9': { minutosJogo: 120000 },
  'jogo-10': { minutosJogo: 300000 },
} as const;
type Chave = keyof typeof CONQUISTAS;

export const TIPOS_PLACAR = { tempo: 'segundosCall', fala: 'segundosFalando', dj: 'musicas' } as const;
type TipoPlacar = keyof typeof TIPOS_PLACAR;

@Injectable()
export class PlacarService {
  private segredo: string;
  private livekit: RoomServiceClient;
  constructor(private prisma: PrismaService, config: ConfigService) {
    this.segredo = config.get<string>('LIVEKIT_API_SECRET', 'devsecret');
    this.livekit = new RoomServiceClient(
      config.get<string>('LIVEKIT_URL', 'ws://localhost:7880'),
      config.get<string>('LIVEKIT_API_KEY', 'devkey'),
      this.segredo,
    );
  }

  // Evita inflar música/live mandando o mesmo evento várias vezes seguidas
  private ultimoEvento = new Map<string, number>();
  // Recibos do DJ já contados (id → quando), para cada música contar uma vez só
  private recibosUsados = new Map<string, number>();

  // A pessoa tem que estar mesmo naquela sala agora (entrou e não saiu)
  private async salaDaPessoa(userId: string, roomId: unknown) {
    if (typeof roomId !== 'string' || !roomId || roomId.length > 64) throw new BadRequestException('Sala inválida');
    const room = await this.prisma.voiceRoom.findUnique({ where: { id: roomId }, select: { serverId: true, livekitRoom: true } });
    if (!room) throw new NotFoundException('Sala não encontrada');
    const naSala = await this.prisma.callParticipant.findFirst({
      where: { userId, leftAt: null, callSession: { voiceRoomId: roomId, endedAt: null } },
      select: { id: true },
    });
    return naSala ? room : null;
  }

  async batimento(userId: string, dto: { roomId?: string; falando?: number; camera?: number }) {
    const sala = await this.salaDaPessoa(userId, dto?.roomId);
    if (!sala) return { novas: [] };
    const { serverId } = sala;
    const agora = new Date();
    const stat = await this.prisma.callStat.upsert({
      where: { serverId_userId: { serverId, userId } },
      create: { serverId, userId, ultimoBatimento: agora },
      update: {},
    });
    const seg = segundosACreditar(stat.ultimoBatimento, agora);
    const limitar = (v: unknown) => Math.max(0, Math.min(seg, Math.round(Number(v) || 0)));
    await this.prisma.callStat.update({
      where: { id: stat.id },
      data: {
        ultimoBatimento: agora,
        segundosCall: { increment: seg },
        segundosFalando: { increment: limitar(dto?.falando) },
        segundosCamera: { increment: limitar(dto?.camera) },
      },
    });
    const h = horaDeBrasilia(agora);
    const extras: Chave[] = [];
    if (seg > 0) {
      if (h >= 2 && h < 5) extras.push('coruja');
      extras.push(...(eventosAtivos(agora) as Chave[]));
      const sessao = await this.prisma.callParticipant.findFirst({
        where: { userId, leftAt: null, callSession: { voiceRoomId: dto.roomId as string, endedAt: null } },
        select: { joinedAt: true }, orderBy: { joinedAt: 'asc' },
      });
      if (sessao && agora.getTime() - sessao.joinedAt.getTime() >= MARATONA_MS) extras.push('maratonista');
    }
    return { novas: await this.avaliar(userId, extras) };
  }

  async evento(userId: string, dto: { roomId?: string; tipo?: string; recibo?: string }) {
    const campo = dto?.tipo === 'musica' ? 'musicas' : dto?.tipo === 'live' ? 'lives' : null;
    if (!campo) throw new BadRequestException('Evento inválido');
    const sala = await this.salaDaPessoa(userId, dto.roomId);
    if (!sala || !(await this.confirmado(userId, sala.livekitRoom, campo, dto.recibo))) return { novas: [] };
    const { serverId } = sala;
    await this.prisma.callStat.upsert({
      where: { serverId_userId: { serverId, userId } },
      create: { serverId, userId, [campo]: 1 },
      update: { [campo]: { increment: 1 } },
    });
    return { novas: await this.avaliar(userId) };
  }

  // Só conta o que o servidor consegue confirmar: música do DJ pelo recibo dele;
  // música da janela/aba e live pela faixa que a pessoa está mesmo transmitindo.
  private async confirmado(userId: string, livekitRoom: string, campo: 'musicas' | 'lives', recibo?: unknown) {
    const agora = Date.now();
    if (campo === 'musicas' && recibo !== undefined) {
      const r = lerReciboDj(recibo, this.segredo, agora);
      if (!r || r.sub !== userId || r.room !== livekitRoom || this.recibosUsados.has(r.id)) return false;
      if (this.recibosUsados.size > 2000) {
        for (const [id, t] of this.recibosUsados) if (agora - t > 11 * 60_000) this.recibosUsados.delete(id);
      }
      this.recibosUsados.set(r.id, agora);
      return true;
    }
    const k = `${userId}:${campo}`;
    if (agora - (this.ultimoEvento.get(k) || 0) < 5000) return false;
    this.ultimoEvento.set(k, agora);
    if (this.ultimoEvento.size > 5000) this.ultimoEvento.clear();
    let fontes: Set<TrackSource>;
    try {
      const p = await this.livekit.getParticipant(livekitRoom, userId);
      fontes = new Set(p.tracks.map(t => t.source));
    } catch { return false; } // fora da sala no LiveKit (ou LiveKit fora do ar): não conta
    // A janela de música publica só o áudio; a live publica o vídeo da tela
    return campo === 'lives'
      ? fontes.has(TrackSource.SCREEN_SHARE)
      : fontes.has(TrackSource.SCREEN_SHARE_AUDIO) && !fontes.has(TrackSource.SCREEN_SHARE);
  }

  async placar(userId: string, serverId: string, tipo: string) {
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } }, select: { banned: true },
    });
    if (!member || member.banned) throw new ForbiddenException('Sem acesso');
    const campo = TIPOS_PLACAR[(Object.prototype.hasOwnProperty.call(TIPOS_PLACAR, tipo) ? tipo : 'tempo') as TipoPlacar];
    // Só membros atuais do servidor aparecem
    const ondeMembro = { serverId, [campo]: { gt: 0 }, user: { memberships: { some: { serverId, banned: false } } } };
    const linhas = await this.prisma.callStat.findMany({
      where: ondeMembro,
      orderBy: { [campo]: 'desc' },
      take: 10,
      select: { [campo]: true, user: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true, moldura: true } } } } },
    }) as any[];
    const meu = await this.prisma.callStat.findUnique({ where: { serverId_userId: { serverId, userId } }, select: { [campo]: true } }) as any;
    const meuValor: number = meu?.[campo] || 0;
    const posicao = meuValor > 0
      ? (await this.prisma.callStat.count({ where: { ...ondeMembro, [campo]: { gt: meuValor } } })) + 1
      : null;
    return {
      itens: linhas.map(l => ({
        userId: l.user.id,
        nome: l.user.profile?.displayName || l.user.username,
        avatarUrl: l.user.profile?.avatarUrl || null,
        moldura: l.user.profile?.moldura || null,
        valor: l[campo],
      })),
      eu: { posicao, valor: meuValor },
    };
  }

  async conquistas(userId: string) {
    await this.avaliar(userId);
    const [lista, progresso] = await Promise.all([
      this.prisma.conquista.findMany({ where: { userId }, select: { chave: true, desbloqueadaEm: true } }),
      this.progresso(userId),
    ]);
    return { desbloqueadas: await this.comBeta(userId, lista), progresso };
  }

  // Conquistas de qualquer pessoa, para o cartão de perfil (só as desbloqueadas)
  async conquistasDe(userId: string) {
    if (!userId || userId.length > 64) throw new BadRequestException('Usuário inválido');
    await this.avaliar(userId);
    const desbloqueadas = await this.prisma.conquista.findMany({
      where: { userId }, select: { chave: true, desbloqueadaEm: true }, orderBy: { desbloqueadaEm: 'asc' },
    });
    return { desbloqueadas: await this.comBeta(userId, desbloqueadas) };
  }

  // "Staff" (cargo dado pelo dono no painel) e "Beta" (marca isBetaTester) vêm primeiro.
  // Não são gravadas: tirou o cargo/emblema, some daqui também.
  private async comBeta(userId: string, lista: { chave: string; desbloqueadaEm: Date }[]) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { isBetaTester: true, isStaff: true, createdAt: true } });
    return [
      ...(u?.isStaff ? [{ chave: 'staff', desbloqueadaEm: u.createdAt }] : []),
      ...(u?.isBetaTester ? [{ chave: 'beta', desbloqueadaEm: u.createdAt }] : []),
      ...lista,
    ];
  }

  private async progresso(userId: string, contarMensagens = true) {
    const soma = await this.prisma.callStat.aggregate({
      where: { userId },
      _sum: { segundosCall: true, segundosCamera: true, musicas: true, lives: true },
    });
    const mensagens = contarMensagens
      ? (await this.prisma.message.count({ where: { authorId: userId } }))
        + (await this.prisma.directMessage.count({ where: { senderId: userId } }))
      : 0;
    const [carteira, amigos, itens, servidores, user] = await Promise.all([
      this.prisma.carteira.findUnique({ where: { userId }, select: { unidosVitorias: true, parimparVitorias: true } }),
      this.prisma.friendship.count({ where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
      this.prisma.itemPosse.count({ where: { userId } }),
      this.prisma.server.findMany({ where: { ownerId: userId }, select: { _count: { select: { members: { where: { banned: false } } } } } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, diasAssinante: true, minutosJogo: true } }),
    ]);
    return {
      mensagens,
      segundosCall: soma._sum.segundosCall || 0,
      segundosCamera: soma._sum.segundosCamera || 0,
      musicas: soma._sum.musicas || 0,
      lives: soma._sum.lives || 0,
      unidosVitorias: carteira?.unidosVitorias || 0,
      parimparVitorias: carteira?.parimparVitorias || 0,
      amigos,
      itens,
      membrosServidor: Math.max(0, ...servidores.map(s => s._count.members)),
      diasConta: user ? Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000) : 0,
      diasAssinante: user?.diasAssinante || 0,
      minutosJogo: user?.minutosJogo || 0,
    };
  }

  // Desbloqueia o que a pessoa já alcançou; devolve só as novas
  private async avaliar(userId: string, extras: Chave[] = []): Promise<Chave[]> {
    const ja = new Set((await this.prisma.conquista.findMany({ where: { userId }, select: { chave: true } })).map(c => c.chave));
    if (Date.now() < FIM_NEXUS_2026.getTime()) extras = [...extras, 'nexus-2026'];
    const faltaMensagem = !ja.has('tagarela') || !ja.has('mil-mensagens');
    const p = await this.progresso(userId, faltaMensagem);
    const novas = (Object.keys(CONQUISTAS) as Chave[]).filter(chave => {
      if (ja.has(chave)) return false;
      const meta = CONQUISTAS[chave] as Record<string, number>;
      const regras = Object.entries(meta);
      if (!regras.length) return extras.includes(chave);
      return regras.every(([campo, alvo]) => (p as any)[campo] >= alvo);
    });
    if (novas.length) {
      await this.prisma.conquista.createMany({ data: novas.map(chave => ({ userId, chave })), skipDuplicates: true });
    }
    return novas;
  }
}
