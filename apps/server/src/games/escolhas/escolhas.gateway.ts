import { UseFilters } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { randomBytes } from 'crypto';
import { Server, Socket } from 'socket.io';
import { WsHttpExceptionFilter } from '../../gateway/ws-http.filter';
import * as R from './escolhas.regras';

interface Desafio { id: string; sala: string; de: string; para: string; lado: R.Lado; num: number; expiraEm: number; timer: ReturnType<typeof setTimeout> }
interface Votacao {
  id: string; sala: string; autorId: string; pergunta: string; opcoes: string[];
  votos: Map<string, number>; fimEm: number; encerrada: boolean; timer?: ReturnType<typeof setTimeout>;
}

const ESPERA_CRIAR_MS = 4_000; // entre um desafio/votação e outro da mesma pessoa

// Par ou ímpar e votação dentro da chamada de voz.
// O servidor guarda o número de quem desafiou até o outro responder (ninguém vê antes).
// shortcut: fica só na memória (reiniciar o servidor apaga desafios e votações abertas); ir para o Redis se incomodar.
@UseFilters(new WsHttpExceptionFilter())
@WebSocketGateway({
  cors: { origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','), credentials: true },
  transports: ['websocket', 'polling'],
})
export class EscolhasGateway implements OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private desafios = new Map<string, Desafio>();
  private votacoes = new Map<string, Votacao>(); // sala → votação (uma por vez)
  private ultimaCriacao = new Map<string, number>();

  private uid(c: Socket): string {
    const id = c.data?.userId;
    if (!id) throw new R.ErroEscolha('Não autenticado');
    return id;
  }

  private naSala(c: Socket, sala: unknown): string {
    if (typeof sala !== 'string' || !c.rooms.has(`voice:${sala}`)) throw new R.ErroEscolha('Entre na chamada primeiro');
    return sala;
  }

  private semPressa(uid: string) {
    const agora = Date.now();
    if (agora - (this.ultimaCriacao.get(uid) ?? 0) < ESPERA_CRIAR_MS) throw new R.ErroEscolha('Calma, espere uns segundos');
    this.ultimaCriacao.set(uid, agora);
    if (this.ultimaCriacao.size > 5000) this.ultimaCriacao.clear();
  }

  private executar<T>(fn: () => T) {
    try { return { ok: true, ...(fn() ?? {}) }; } catch (e: any) {
      return { ok: false, erro: e instanceof R.ErroEscolha ? e.message : 'Não deu certo, tente de novo' };
    }
  }

  private emitir(sala: string, evento: string, dado: unknown) {
    this.server.to(`voice:${sala}`).emit(evento, dado);
  }

  // ── Par ou ímpar ──────────────────────────────────────────────
  private publico = (d: Desafio) => ({ id: d.id, de: d.de, para: d.para, lado: d.lado, expiraEm: d.expiraEm });

  private tirarDesafio(d: Desafio, motivo: 'recusou' | 'cancelou' | 'expirou' | 'saiu') {
    clearTimeout(d.timer);
    this.desafios.delete(d.id);
    this.emitir(d.sala, 'parimpar:fim', { id: d.id, motivo });
  }

  @SubscribeMessage('parimpar:desafiar')
  async desafiar(@ConnectedSocket() c: Socket, @MessageBody() d: { voiceRoomId: string; alvoId: string; lado: string; numero: number }) {
    try {
      const uid = this.uid(c);
      const sala = this.naSala(c, d?.voiceRoomId);
      const lado = R.lado(d?.lado);
      const num = R.numeroDaMao(d?.numero);
      const alvo = typeof d?.alvoId === 'string' ? d.alvoId : '';
      if (!alvo || alvo === uid) throw new R.ErroEscolha('Escolha outra pessoa da chamada');
      const naCall = (await this.server.in(`voice:${sala}`).fetchSockets()).some(s => s.data?.userId === alvo);
      if (!naCall) throw new R.ErroEscolha('Essa pessoa não está na chamada');
      for (const x of this.desafios.values()) {
        if (x.de === uid) throw new R.ErroEscolha('Você já tem um desafio esperando resposta');
      }
      this.semPressa(uid);
      const desafio: Desafio = {
        id: randomBytes(8).toString('base64url'), sala, de: uid, para: alvo, lado, num,
        expiraEm: Date.now() + R.PARIMPAR_ESPERA_MS,
        timer: setTimeout(() => this.desafios.has(desafio.id) && this.tirarDesafio(desafio, 'expirou'), R.PARIMPAR_ESPERA_MS),
      };
      this.desafios.set(desafio.id, desafio);
      this.emitir(sala, 'parimpar:desafio', this.publico(desafio));
      return { ok: true, desafio: this.publico(desafio) };
    } catch (e: any) {
      return { ok: false, erro: e instanceof R.ErroEscolha ? e.message : 'Não deu certo, tente de novo' };
    }
  }

  @SubscribeMessage('parimpar:responder')
  responder(@ConnectedSocket() c: Socket, @MessageBody() d: { id: string; numero: number }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const x = this.desafios.get(typeof d?.id === 'string' ? d.id : '');
      if (!x) throw new R.ErroEscolha('Esse desafio já acabou');
      if (x.para !== uid) throw new R.ErroEscolha('Esse desafio não é para você');
      this.naSala(c, x.sala);
      const num = R.numeroDaMao(d?.numero);
      const r = R.resultadoParImpar(x.lado, x.num, num);
      clearTimeout(x.timer);
      this.desafios.delete(x.id);
      this.emitir(x.sala, 'parimpar:resultado', {
        id: x.id, de: x.de, para: x.para, lado: x.lado, numDe: x.num, numPara: num,
        soma: r.soma, saiu: r.saiu, vencedor: r.ganhou === 'desafiante' ? x.de : x.para,
      });
    });
  }

  // Quem desafiou cancela; quem foi desafiado recusa
  @SubscribeMessage('parimpar:cancelar')
  cancelar(@ConnectedSocket() c: Socket, @MessageBody() d: { id: string }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const x = this.desafios.get(typeof d?.id === 'string' ? d.id : '');
      if (!x) return;
      if (x.de !== uid && x.para !== uid) throw new R.ErroEscolha('Esse desafio não é seu');
      this.tirarDesafio(x, x.de === uid ? 'cancelou' : 'recusou');
    });
  }

  // ── Votação ───────────────────────────────────────────────────
  private estado(v: Votacao) {
    const a = R.apurar(v.opcoes.length, v.votos.values());
    return {
      id: v.id, autorId: v.autorId, pergunta: v.pergunta, opcoes: v.opcoes, fimEm: v.fimEm, encerrada: v.encerrada,
      contagem: a.contagem, total: a.total, vencedoras: v.encerrada ? a.vencedoras : [],
    };
  }

  private fechar(v: Votacao) {
    if (v.encerrada) return;
    clearTimeout(v.timer);
    v.encerrada = true;
    this.emitir(v.sala, 'votacao:estado', this.estado(v));
    // O resultado fica disponível mais 2 minutos para quem chegar
    setTimeout(() => { if (this.votacoes.get(v.sala) === v) this.votacoes.delete(v.sala); }, 120_000).unref();
  }

  @SubscribeMessage('votacao:criar')
  criarVotacao(@ConnectedSocket() c: Socket, @MessageBody() d: { voiceRoomId: string; pergunta: string; opcoes: string[]; duracaoS: number }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const sala = this.naSala(c, d?.voiceRoomId);
      const atual = this.votacoes.get(sala);
      if (atual && !atual.encerrada) throw new R.ErroEscolha('Já tem uma votação rolando nesta chamada');
      const m = R.montarVotacao(d?.pergunta, d?.opcoes, d?.duracaoS);
      this.semPressa(uid);
      const v: Votacao = {
        id: randomBytes(8).toString('base64url'), sala, autorId: uid, pergunta: m.pergunta, opcoes: m.opcoes,
        votos: new Map(), fimEm: Date.now() + m.duracaoS * 1000, encerrada: false,
      };
      v.timer = setTimeout(() => this.fechar(v), m.duracaoS * 1000);
      this.votacoes.set(sala, v);
      this.emitir(sala, 'votacao:estado', this.estado(v));
    });
  }

  @SubscribeMessage('votacao:votar')
  votar(@ConnectedSocket() c: Socket, @MessageBody() d: { voiceRoomId: string; id: string; opcao: number }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const sala = this.naSala(c, d?.voiceRoomId);
      const v = this.votacoes.get(sala);
      if (!v || v.id !== d?.id || v.encerrada) throw new R.ErroEscolha('Essa votação já acabou');
      if (!Number.isInteger(d?.opcao) || d.opcao < 0 || d.opcao >= v.opcoes.length) throw new R.ErroEscolha('Opção inválida');
      v.votos.set(uid, d.opcao); // dá para trocar o voto até acabar
      this.emitir(sala, 'votacao:estado', this.estado(v));
    });
  }

  @SubscribeMessage('votacao:encerrar')
  encerrar(@ConnectedSocket() c: Socket, @MessageBody() d: { voiceRoomId: string }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const v = this.votacoes.get(this.naSala(c, d?.voiceRoomId));
      if (!v) return;
      if (v.autorId !== uid) throw new R.ErroEscolha('Só quem criou pode encerrar');
      this.fechar(v);
    });
  }

  // Quem entra (ou recarrega a página) recebe o que está aberto na chamada
  @SubscribeMessage('escolhas:consultar')
  consultar(@ConnectedSocket() c: Socket, @MessageBody() d: { voiceRoomId: string }) {
    return this.executar(() => {
      const uid = this.uid(c);
      const sala = this.naSala(c, d?.voiceRoomId);
      const v = this.votacoes.get(sala);
      return {
        votacao: v ? this.estado(v) : null,
        meuVoto: v?.votos.get(uid) ?? null,
        desafios: [...this.desafios.values()].filter(x => x.sala === sala).map(this.publico),
      };
    });
  }

  // Saiu da chamada: desafios dele somem (a votação continua)
  handleDisconnect(c: Socket) {
    const uid = c.data?.userId;
    if (!uid) return;
    if ((this.server.sockets.adapter.rooms.get(`user:${uid}`)?.size ?? 0) > 0) return;
    for (const x of [...this.desafios.values()]) if (x.de === uid || x.para === uid) this.tirarDesafio(x, 'saiu');
  }
}
