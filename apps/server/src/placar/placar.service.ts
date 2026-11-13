import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { horaDeBrasilia, lerReciboDj, segundosACreditar } from './placar.regras';

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
    return { novas: await this.avaliar(userId, seg > 0 && h >= 2 && h < 5 ? ['coruja'] : []) };
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
      select: { [campo]: true, user: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } } },
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
    return { desbloqueadas: lista, progresso };
  }

  // Conquistas de qualquer pessoa, para o cartão de perfil (só as desbloqueadas)
  async conquistasDe(userId: string) {
    if (!userId || userId.length > 64) throw new BadRequestException('Usuário inválido');
    await this.avaliar(userId);
    const desbloqueadas = await this.prisma.conquista.findMany({
      where: { userId }, select: { chave: true, desbloqueadaEm: true }, orderBy: { desbloqueadaEm: 'asc' },
    });
    return { desbloqueadas };
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
    return {
      mensagens,
      segundosCall: soma._sum.segundosCall || 0,
      segundosCamera: soma._sum.segundosCamera || 0,
      musicas: soma._sum.musicas || 0,
      lives: soma._sum.lives || 0,
    };
  }

  // Desbloqueia o que a pessoa já alcançou; devolve só as novas
  private async avaliar(userId: string, extras: Chave[] = []): Promise<Chave[]> {
    const ja = new Set((await this.prisma.conquista.findMany({ where: { userId }, select: { chave: true } })).map(c => c.chave));
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
