import { Logger, UseFilters } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { RedisService } from '../../redis/redis.service';
import { randomBytes, randomInt } from 'crypto';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { WsHttpExceptionFilter } from '../../gateway/ws-http.filter';
import * as J from './unidos.engine';

const TEMPO_VEZ = 30_000;      // 30 s por jogada
const TEMPO_AUSENTE = 4_000;   // quem saiu da chamada joga sozinho rápido
const LOBBY_PARADO = 15 * 60_000;
const FIM_PARADO = 10 * 60_000;

// Aleatoriedade forte (ninguém consegue prever o baralho)
const rng: J.Rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

type Resposta = { ok: true; partida?: J.Visao } | { ok: false; erro: string };

// UNidos — jogo de cartas dentro da chamada de voz.
// O servidor guarda tudo; cada pessoa recebe só a própria mão.
@UseFilters(new WsHttpExceptionFilter())
@WebSocketGateway({
  cors: { origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','), credentials: true },
  transports: ['websocket', 'polling'],
})
export class UnidosGateway implements OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger('UNidos');
  private partidas = new Map<string, J.Estado>();
  private porSala = new Map<string, string>();          // voiceRoomId → partidaId
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private ultimoUso = new Map<string, number>();

  constructor(private prisma: PrismaService, private redis: RedisService) {
    // Limpa mesas abandonadas
    setInterval(() => this.limpar(), 60_000).unref();
  }

  // ── Partidas salvas no Redis: sobrevivem a reinício do servidor ─
  private chave = (id: string) => `unidos:partida:${id}`;
  private salvar(p: J.Estado) {
    this.redis.set(this.chave(p.id), JSON.stringify(p), 6 * 3600).catch(e => this.logger.warn(`salvar: ${e.message}`));
  }

  // Ao subir: retoma as partidas que estavam rolando (o relógio da vez recomeça)
  async afterInit() {
    try {
      const chaves = await this.redis.scanKeys('unidos:partida:*');
      for (const k of chaves) {
        const bruto = await this.redis.get(k);
        if (!bruto) continue;
        const p = JSON.parse(bruto) as J.Estado;
        if (!p?.id || !Array.isArray(p.jogadores) || !p.jogadores.length) { await this.redis.del(k); continue; }
        if (p.status === 'jogando') p.prazo = Date.now() + TEMPO_VEZ;
        p.seq++;
        this.partidas.set(p.id, p);
        this.porSala.set(p.voiceRoomId, p.id);
        this.ultimoUso.set(p.id, Date.now());
        this.agendar(p);
      }
      if (chaves.length) this.logger.log(`${this.partidas.size} partida(s) retomada(s) depois do reinício`);
    } catch (e: any) { this.logger.warn(`retomar partidas: ${e.message}`); }
  }

  // ── Helpers ────────────────────────────────────────────────────
  private uid(client: Socket): string {
    const id = client.data?.userId;
    if (!id) throw new J.ErroJogo('Não autenticado');
    return id;
  }

  // Sala de voz do servidor (precisa estar nela) ou chamada direta da DM:
  // "dm:<idA>:<idB>" com os ids em ordem — só a dupla entra nessa mesa.
  private naSala(client: Socket, voiceRoomId: unknown): string {
    if (typeof voiceRoomId === 'string' && voiceRoomId.startsWith('dm:')) {
      const par = this.parDm(voiceRoomId);
      if (par && par.includes(client.data?.userId)) return voiceRoomId;
      throw new J.ErroJogo('Essa mesa é só de quem está na chamada');
    }
    if (typeof voiceRoomId !== 'string' || !client.rooms.has(`voice:${voiceRoomId}`)) {
      throw new J.ErroJogo('Entre na chamada para jogar');
    }
    return voiceRoomId;
  }

  private parDm(chave: string): [string, string] | null {
    const m = /^dm:([A-Za-z0-9_-]{8,40}):([A-Za-z0-9_-]{8,40})$/.exec(chave);
    if (!m || m[1] >= m[2]) return null; // dois ids diferentes, em ordem
    return [m[1], m[2]];
  }

  // Para onde avisar que existe uma mesa: a sala de voz, ou os dois da DM
  private avisarSala(voiceRoomId: string, dado: unknown) {
    const par = voiceRoomId.startsWith('dm:') ? this.parDm(voiceRoomId) : null;
    if (par) for (const id of par) this.server.to(`user:${id}`).emit('unidos:sala', dado);
    else this.server.to(`voice:${voiceRoomId}`).emit('unidos:sala', dado);
  }

  private partida(id: unknown): J.Estado {
    const p = typeof id === 'string' ? this.partidas.get(id) : undefined;
    if (!p) throw new J.ErroJogo('Partida não encontrada');
    return p;
  }

  private async perfil(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, profile: { select: { displayName: true, avatarUrl: true } } },
    });
    return { id: userId, nome: u?.profile?.displayName || u?.username || 'Jogador', avatarUrl: u?.profile?.avatarUrl ?? null };
  }

  // Cada jogador recebe a visão dele; a sala de voz recebe o resumo (para o botão "Entrar")
  private enviar(p: J.Estado) {
    this.ultimoUso.set(p.id, Date.now());
    this.salvar(p);
    for (const j of p.jogadores) {
      this.server.to(`user:${j.id}`).emit('unidos:estado', J.visao(p, j.id));
    }
    this.avisarSala(p.voiceRoomId, this.resumo(p));
    this.agendar(p);
  }

  private resumo(p: J.Estado | undefined) {
    if (!p) return null;
    const host = p.jogadores.find(j => j.id === p.hostId);
    return {
      id: p.id, voiceRoomId: p.voiceRoomId, status: p.status,
      hostNome: host?.nome ?? '', jogadores: p.jogadores.map(j => ({ id: j.id, nome: j.nome, avatarUrl: j.avatarUrl })),
    };
  }

  // Relógio da vez: acabou o tempo, o jogo compra por ele e passa
  private agendar(p: J.Estado) {
    clearTimeout(this.timers.get(p.id));
    this.timers.delete(p.id);
    if (p.status !== 'jogando') return;
    const daVez = J.daVez(p);
    const espera = daVez.ausente ? TEMPO_AUSENTE : Math.max(0, p.prazo - Date.now());
    this.timers.set(p.id, setTimeout(() => {
      try {
        if (this.partidas.get(p.id) !== p || p.status !== 'jogando') return;
        J.tempoEsgotado(p, rng, Date.now(), TEMPO_VEZ);
        this.enviar(p);
      } catch (e: any) { this.logger.warn(`tempo: ${e.message}`); }
    }, espera + 300));
  }

  private executar(fn: () => void): Resposta {
    try {
      fn();
      return { ok: true };
    } catch (e: any) {
      if (e instanceof J.ErroJogo) return { ok: false, erro: e.message };
      this.logger.error(e?.stack || e);
      return { ok: false, erro: 'Não foi possível fazer essa jogada' };
    }
  }

  private encerrar(p: J.Estado) {
    clearTimeout(this.timers.get(p.id));
    this.timers.delete(p.id);
    this.partidas.delete(p.id);
    this.redis.del(this.chave(p.id)).catch(() => {});
    if (this.porSala.get(p.voiceRoomId) === p.id) this.porSala.delete(p.voiceRoomId);
    this.ultimoUso.delete(p.id);
    for (const j of p.jogadores) this.server.to(`user:${j.id}`).emit('unidos:encerrada', { id: p.id });
    this.avisarSala(p.voiceRoomId, null);
  }

  private limpar() {
    const agora = Date.now();
    for (const p of this.partidas.values()) {
      const parado = agora - (this.ultimoUso.get(p.id) ?? agora);
      if ((p.status === 'lobby' && parado > LOBBY_PARADO) || (p.status === 'fim' && parado > FIM_PARADO)
        || p.jogadores.length === 0 || p.jogadores.every(j => j.ausente)) {
        this.encerrar(p);
      }
    }
  }

  // ── Eventos ────────────────────────────────────────────────────
  // Qual partida existe nesta chamada (ao entrar na sala / recarregar)
  @SubscribeMessage('unidos:consultar')
  consultar(@ConnectedSocket() c: Socket, @MessageBody() d: { voiceRoomId: string }) {
    try {
      const uid = this.uid(c);
      const sala = this.naSala(c, d?.voiceRoomId);
      const p = this.partidas.get(this.porSala.get(sala) || '');
      const eu = p?.jogadores.find(j => j.id === uid);
      if (p && eu && eu.ausente) { eu.ausente = false; p.seq++; this.enviar(p); }
      return { ok: true, sala: this.resumo(p), partida: p && eu ? J.visao(p, uid) : null };
    } catch (e: any) { return { ok: false, erro: e.message }; }
  }

  // Abre uma mesa na chamada (ou devolve a que já existe)
  @SubscribeMessage('unidos:abrir')
  async abrir(@ConnectedSocket() c: Socket, @MessageBody() d: { voiceRoomId: string }) {
    try {
      const uid = this.uid(c);
      const sala = this.naSala(c, d?.voiceRoomId);
      const existente = this.partidas.get(this.porSala.get(sala) || '');
      if (existente) {
        if (existente.status === 'lobby') J.entrar(existente, await this.perfil(uid));
        this.enviar(existente);
        return { ok: true, partida: J.visao(existente, uid) };
      }
      const p = J.novaPartida(randomBytes(9).toString('base64url'), sala, await this.perfil(uid));
      this.partidas.set(p.id, p);
      this.porSala.set(sala, p.id);
      this.enviar(p);
      return { ok: true, partida: J.visao(p, uid) };
    } catch (e: any) { return { ok: false, erro: e instanceof J.ErroJogo ? e.message : 'Não foi possível abrir a mesa' }; }
  }

  @SubscribeMessage('unidos:entrar')
  async entrar(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string }) {
    try {
      const uid = this.uid(c);
      const p = this.partida(d?.partidaId);
      this.naSala(c, p.voiceRoomId);
      J.entrar(p, await this.perfil(uid));
      this.enviar(p);
      return { ok: true, partida: J.visao(p, uid) };
    } catch (e: any) { return { ok: false, erro: e instanceof J.ErroJogo ? e.message : 'Não foi possível entrar' }; }
  }

  @SubscribeMessage('unidos:sair')
  sair(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const p = this.partida(d?.partidaId);
      J.sair(p, uid, Date.now(), TEMPO_VEZ);
      this.server.to(`user:${uid}`).emit('unidos:encerrada', { id: p.id });
      if (!p.jogadores.length) this.encerrar(p); else this.enviar(p);
    });
  }

  @SubscribeMessage('unidos:iniciar')
  iniciar(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const p = this.partida(d?.partidaId);
      if (p.hostId !== uid) throw new J.ErroJogo('Só quem abriu a mesa pode começar');
      J.iniciar(p, rng, Date.now(), TEMPO_VEZ);
      this.enviar(p);
    });
  }

  @SubscribeMessage('unidos:jogar')
  jogar(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string; cartaId: string; cor?: J.Cor; alvoId?: string }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const p = this.partida(d?.partidaId);
      if (typeof d?.cartaId !== 'string') throw new J.ErroJogo('Carta inválida');
      J.jogar(p, uid, d.cartaId, { cor: d.cor, alvoId: typeof d.alvoId === 'string' ? d.alvoId : undefined }, rng, Date.now(), TEMPO_VEZ);
      this.enviar(p);
    });
  }

  @SubscribeMessage('unidos:comprar')
  comprar(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string }) {
    return this.executar(() => {
      const p = this.partida(d?.partidaId);
      J.comprar(p, this.uid(c), rng, Date.now(), TEMPO_VEZ);
      this.enviar(p);
    });
  }

  @SubscribeMessage('unidos:passar')
  passar(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string }) {
    return this.executar(() => {
      const p = this.partida(d?.partidaId);
      J.passar(p, this.uid(c), Date.now(), TEMPO_VEZ);
      this.enviar(p);
    });
  }

  @SubscribeMessage('unidos:gritar')
  gritar(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string }) {
    return this.executar(() => {
      const p = this.partida(d?.partidaId);
      J.gritar(p, this.uid(c));
      this.enviar(p);
    });
  }

  @SubscribeMessage('unidos:pegar')
  pegar(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string; alvoId: string }) {
    return this.executar(() => {
      const p = this.partida(d?.partidaId);
      if (typeof d?.alvoId !== 'string') throw new J.ErroJogo('Escolha quem pegar');
      J.pegar(p, this.uid(c), d.alvoId, rng);
      this.enviar(p);
    });
  }

  // Jogar de novo com a mesma mesa
  @SubscribeMessage('unidos:revanche')
  revanche(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const p = this.partida(d?.partidaId);
      if (p.hostId !== uid) throw new J.ErroJogo('Só quem abriu a mesa pode recomeçar');
      if (p.status !== 'fim') throw new J.ErroJogo('A partida ainda não terminou');
      J.iniciar(p, rng, Date.now(), TEMPO_VEZ);
      this.enviar(p);
    });
  }

  @SubscribeMessage('unidos:encerrar')
  encerrarMesa(@ConnectedSocket() c: Socket, @MessageBody() d: { partidaId: string }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const p = this.partida(d?.partidaId);
      if (p.hostId !== uid) throw new J.ErroJogo('Só quem abriu a mesa pode encerrar');
      this.encerrar(p);
    });
  }

  // Caiu ou fechou o Nexus: se não tiver outro aparelho aberto, vira "ausente"
  // (as vezes dele andam sozinhas até ele voltar)
  handleDisconnect(client: Socket) {
    const uid = client.data?.userId;
    if (!uid) return;
    const aindaAqui = (this.server.sockets.adapter.rooms.get(`user:${uid}`)?.size ?? 0) > 0;
    if (aindaAqui) return;
    for (const p of this.partidas.values()) {
      const j = p.jogadores.find(x => x.id === uid);
      if (!j) continue;
      if (p.status === 'lobby') { J.sair(p, uid); if (!p.jogadores.length) { this.encerrar(p); continue; } }
      else { j.ausente = true; p.seq++; }
      this.enviar(p);
    }
  }
}
