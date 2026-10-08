import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from '../messages/messages.service';
import { PresenceService } from '../presence/presence.service';
import { RedisService } from '../redis/redis.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';
import { PrismaService } from '../prisma/prisma.service';
import { canAccessVoiceRoom, MEMBER_WITH_ROLES_INCLUDE } from '../voice/voice-access';

// Mapa em memória: userId → socketId
// NOTA: funciona apenas com instância única. Para escalar horizontalmente,
// substitua por Redis pub/sub (redis.adapter da socket.io).
const userSocketMap = new Map<string, string>();

// Rate limiting simples por socket (em memória)
const messageRateMap = new Map<string, { count: number; resetAt: number }>();
const MAX_MESSAGES_PER_WINDOW = 20;
const RATE_WINDOW_MS = 5000;

function checkRateLimit(socketId: string): boolean {
  const now = Date.now();
  const entry = messageRateMap.get(socketId);
  if (!entry || now > entry.resetAt) {
    messageRateMap.set(socketId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_MESSAGES_PER_WINDOW) return false;
  entry.count++;
  return true;
}

@WebSocketGateway({
  cors: {
    // Lê das variáveis de ambiente; fallback para localhost em dev.
    // Em produção defina CORS_ORIGIN=https://nexus-eight-kohl.vercel.app no Railway.
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NexusGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NexusGateway');

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private messagesService: MessagesService,
    private presenceService: PresenceService,
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  // ── Autorização das salas de tempo real ──────────────────────
  // Antes qualquer pessoa logada entrava em qualquer sala (canal, servidor,
  // voz) só sabendo o id — e recebia as mensagens em tempo real.
  private async memberOf(serverId: string | undefined, userId: string) {
    if (!serverId || !userId) return null;
    const m = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } }, include: MEMBER_WITH_ROLES_INCLUDE,
    });
    return m && !m.banned ? m : null;
  }

  private async voiceRoomFor(voiceRoomId: string | undefined, userId: string) {
    if (!voiceRoomId) return null;
    const room = await this.prisma.voiceRoom.findUnique({
      where: { id: voiceRoomId },
      include: { allowedRoles: { select: { id: true } }, server: { select: { ownerId: true } } },
    });
    if (!room) return null;
    const member = await this.memberOf(room.serverId, userId);
    if (!member) return null;
    return canAccessVoiceRoom(room, member as any, room.server.ownerId) ? room : null;
  }

  // Só age em sala de voz em que o socket entrou (pelo voice:join autorizado)
  private inVoice(client: Socket, voiceRoomId?: string) {
    return !!voiceRoomId && client.rooms.has(`voice:${voiceRoomId}`);
  }

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway inicializado');
    // Remove presenças órfãs de antes do restart (ninguém está conectado
    // neste momento; quem estiver reconecta e marca online de novo).
    this.redis.clearAllPresence().catch(err =>
      this.logger.warn(`Falha ao limpar presença no boot: ${err.message}`),
    );
  }

  // ── Conexão ───────────────────────────────────────────────────
  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.email = payload.email;

      userSocketMap.set(payload.sub, client.id);
      await this.redis.setUserOnline(payload.sub, client.id);

      this.logger.log(`Cliente conectado: ${payload.sub} (${client.id})`);

      // Anuncia offline no 'disconnecting' (não no 'disconnect'): neste ponto
      // as rooms do socket AINDA existem. No 'disconnect' o Socket.IO já as
      // esvaziou, então o broadcast de presença não alcançava ninguém e o
      // membro ficava "online" para os outros até um refetch.
      client.on('disconnecting', () => {
        const uid = client.data.userId;
        if (!uid) return;
        for (const room of client.rooms) {
          if (room !== client.id) {
            client.to(room).emit('user:offline', { userId: uid });
          }
        }
      });

      // Informa o próprio usuário que está conectado
      client.emit('connected', { userId: payload.sub });

    } catch (err) {
      this.logger.warn(`Conexão rejeitada: ${err.message}`);
      client.disconnect();
    }
  }

  // ── Desconexão ────────────────────────────────────────────────
  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    userSocketMap.delete(userId);
    messageRateMap.delete(client.id);
    await this.redis.setUserOffline(userId);
    await this.redis.setVoiceDeafened(userId, false).catch(() => {});

    // Se caiu no meio de uma chamada, limpa a presença de voz
    const { voiceRoomId, voiceServerId } = client.data;
    if (voiceRoomId) {
      await this.redis.removeFromVoiceRoom(voiceRoomId, userId);
      this.server.to(`voice:${voiceRoomId}`).emit('voice:user_left', { userId });
      if (voiceServerId) {
        this.server.to(`server:${voiceServerId}`).emit('voice:presence', {
          serverId: voiceServerId,
          voiceRoomId,
          userId,
          action: 'leave',
        });
      }
    }

    // O broadcast de user:offline acontece no handler de 'disconnecting'
    // (registrado no handleConnection) — aqui client.rooms já está vazio.

    this.logger.log(`Cliente desconectado: ${userId}`);
  }

  // ── Entrar em sala (canal de texto) ──────────────────────────
  @SubscribeMessage('channel:join')
  async handleJoinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    const ch = data?.channelId
      ? await this.prisma.channel.findUnique({ where: { id: data.channelId }, select: { serverId: true } })
      : null;
    if (!ch || !(await this.memberOf(ch.serverId, client.data.userId))) {
      client.emit('error', { message: 'Sem acesso a este canal' });
      return;
    }
    await client.join(`channel:${data.channelId}`);
    client.emit('channel:joined', { channelId: data.channelId });
  }

  @SubscribeMessage('channel:leave')
  async handleLeaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    await client.leave(`channel:${data.channelId}`);
  }

  // ── Entrar em servidor ────────────────────────────────────────
  @SubscribeMessage('server:join')
  async handleJoinServer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string },
  ) {
    if (!(await this.memberOf(data?.serverId, client.data.userId))) {
      client.emit('error', { message: 'Sem acesso a este servidor' });
      return;
    }
    await client.join(`server:${data.serverId}`);

    // Anuncia presença para os membros do servidor
    client.to(`server:${data.serverId}`).emit('user:online', {
      userId: client.data.userId,
    });
  }

  // ── Enviar mensagem ───────────────────────────────────────────
  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string; content: string; replyToId?: string; clientMsgId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Não autenticado');

    // Rate limiting: máx 20 mensagens por 5 s por socket
    if (!checkRateLimit(client.id)) {
      client.emit('error', { message: 'Muitas mensagens. Aguarde alguns segundos.' });
      return;
    }

    const dto: CreateMessageDto = {
      content: data.content,
      replyToId: data.replyToId,
    };

    const message = await this.messagesService.create(data.channelId, userId, dto);

    // Envia para todos no canal (incluindo o remetente), com clientMsgId para deduplicação
    this.server.to(`channel:${data.channelId}`).emit('message:new', {
      ...message,
      clientMsgId: data.clientMsgId,
    });

    // Atividade para a SIDEBAR de todo o servidor: badges de não-lidas e
    // detecção de menção em canais que o usuário não está olhando.
    const serverId = (message as any).channel?.serverId;
    if (serverId) {
      this.server.to(`server:${serverId}`).emit('channel:activity', {
        serverId,
        channelId: data.channelId,
        authorId: userId,
        authorName: (message as any).author?.profile?.displayName || (message as any).author?.username || '',
        content: (data.content || '').slice(0, 300),
      });
    }

    return message;
  }

  // ── Editar mensagem ───────────────────────────────────────────
  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Não autenticado');
    const message = await this.messagesService.update(data.messageId, userId, data.content);

    // Descobre o canal via Prisma (já está no service)
    this.server.to(`channel:${message.channelId}`).emit('message:updated', message);
    return message;
  }

  // ── Deletar mensagem ──────────────────────────────────────────
  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; channelId: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Não autenticado');
    const deleted = await this.messagesService.delete(data.messageId, userId);

    // Canal real da mensagem (não o informado pelo navegador)
    this.server.to(`channel:${deleted.channelId}`).emit('message:deleted', {
      messageId: data.messageId,
    });
  }

  // ── Reações ───────────────────────────────────────────────────
  @SubscribeMessage('reaction:add')
  async handleAddReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; channelId: string; emoji: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Não autenticado');
    const { channelId } = await this.messagesService.addReaction(data.messageId, userId, data.emoji);

    this.server.to(`channel:${channelId}`).emit('reaction:added', {
      messageId: data.messageId,
      userId,
      emoji: data.emoji,
    });
  }

  @SubscribeMessage('reaction:remove')
  async handleRemoveReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; channelId: string; emoji: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Não autenticado');
    const { channelId } = await this.messagesService.removeReaction(data.messageId, userId, data.emoji);

    this.server.to(`channel:${channelId}`).emit('reaction:removed', {
      messageId: data.messageId,
      userId,
      emoji: data.emoji,
    });
  }

  // ── Fixar / desafixar ─────────────────────────────────────────
  @SubscribeMessage('message:pin')
  async handlePinMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; pinned: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Não autenticado');
    const res = await this.messagesService.setPinned(data.messageId, userId, data.pinned !== false);
    this.server.to(`channel:${res.channelId}`).emit('message:pinned', { ...res, pinnedById: res.pinned ? userId : null });
    return res;
  }

  // ── Typing ────────────────────────────────────────────────────
  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    const userId = client.data.userId;
    if (!client.rooms.has(`channel:${data?.channelId}`)) return;
    await this.redis.setTyping(data.channelId, userId);

    client.to(`channel:${data.channelId}`).emit('typing:update', {
      channelId: data.channelId,
      userId,
      typing: true,
    });
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    const userId = client.data.userId;
    if (!client.rooms.has(`channel:${data?.channelId}`)) return;

    client.to(`channel:${data.channelId}`).emit('typing:update', {
      channelId: data.channelId,
      userId,
      typing: false,
    });
  }

  // ── Status do usuário ─────────────────────────────────────────
  @SubscribeMessage('user:status')
  async handleStatusUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status: 'ONLINE' | 'AWAY' | 'BUSY' },
  ) {
    const userId = client.data.userId;
    await this.redis.setUserStatus(userId, data.status);

    // Anuncia para todos os servidores do usuário
    const rooms = Array.from(client.rooms);
    rooms.forEach(room => {
      if (room.startsWith('server:')) {
        client.to(room).emit('user:status_changed', { userId, status: data.status });
      }
    });
  }

  // ── Voz: estado do microfone/câmera (sinalização) ─────────────
  @SubscribeMessage('voice:state')
  async handleVoiceState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      voiceRoomId: string;
      micEnabled: boolean;
      camEnabled: boolean;
      screenSharing: boolean;
    },
  ) {
    const userId = client.data.userId;
    if (!this.inVoice(client, data?.voiceRoomId)) return; // só quem entrou na sala (voice:join autorizado)

    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:state_changed', {
      userId,
      ...data,
    });
  }

  // ── Voz: entrar na sala ───────────────────────────────────────
  @SubscribeMessage('voice:join')
  async handleVoiceJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceRoomId: string; serverId?: string },
  ) {
    const userId = client.data.userId;
    // Sala existe, é membro e (se restrita) tem o cargo — o servidor vem do banco
    const room = await this.voiceRoomFor(data?.voiceRoomId, userId);
    if (!room) {
      client.emit('error', { message: 'Sem acesso a esta sala de voz' });
      return;
    }
    data.serverId = room.serverId;
    await client.join(`voice:${data.voiceRoomId}`);
    await this.redis.addToVoiceRoom(data.voiceRoomId, userId);

    // Guarda para limpar/anunciar na desconexão abrupta
    client.data.voiceRoomId = data.voiceRoomId;
    client.data.voiceServerId = room.serverId;

    const members = await this.redis.getVoiceRoomMembers(data.voiceRoomId);

    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:user_joined', {
      userId,
      members,
    });

    // Anuncia presença para a sidebar de todos os membros do servidor
    if (data.serverId) {
      this.server.to(`server:${data.serverId}`).emit('voice:presence', {
        serverId: data.serverId,
        voiceRoomId: data.voiceRoomId,
        userId,
        action: 'join',
      });
    }
  }

  // ── Voz: começou/parou de transmitir a tela ───────────────────
  // Sinaliza a mudança para as sidebars (que refazem o fetch da presença,
  // onde o backend lê do LiveKit quem está com SCREEN_SHARE publicado).
  @SubscribeMessage('voice:live')
  async handleVoiceLive(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceRoomId: string; serverId?: string },
  ) {
    const userId = client.data.userId;
    if (!this.inVoice(client, data?.voiceRoomId)) return; // só quem entrou na sala (voice:join autorizado)
    data.serverId = client.data.voiceServerId; // servidor da sala (do banco), não o enviado
    if (!userId || !data.serverId) return;
    this.server.to(`server:${data.serverId}`).emit('voice:presence', {
      serverId: data.serverId,
      voiceRoomId: data.voiceRoomId,
      userId,
      action: 'live',
    });
  }

  // ── Voz: começar/parar de ASSISTIR a transmissão de alguém ────
  // Relay simples para a sala: cada cliente agrega quem assiste o quê,
  // e o transmissor exibe a própria audiência.
  @SubscribeMessage('voice:watch')
  async handleVoiceWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceRoomId: string; targetUserId: string; watching: boolean },
  ) {
    const userId = client.data.userId;
    if (!this.inVoice(client, data?.voiceRoomId)) return; // só quem entrou na sala (voice:join autorizado)
    if (!userId || !data.voiceRoomId || !data.targetUserId) return;
    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:watch', {
      userId,                       // quem está assistindo (ou parou)
      targetUserId: data.targetUserId, // de quem é a transmissão
      watching: !!data.watching,
    });
  }

  // ── Voz: ensurdecido (fone mutado) — visível para todo mundo ──
  @SubscribeMessage('voice:deafen')
  async handleVoiceDeafen(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceRoomId: string; serverId?: string; deafened: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId || !data.voiceRoomId) return;
    if (!this.inVoice(client, data?.voiceRoomId)) return; // só quem entrou na sala (voice:join autorizado)
    data.serverId = client.data.voiceServerId;
    await this.redis.setVoiceDeafened(userId, !!data.deafened).catch(() => {});
    // Para quem está NA sala (badge em tempo real)
    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:deafen', {
      userId,
      deafened: !!data.deafened,
    });
    // Para as sidebars do servidor (refazem o fetch da presença)
    if (data.serverId) {
      this.server.to(`server:${data.serverId}`).emit('voice:presence', {
        serverId: data.serverId,
        voiceRoomId: data.voiceRoomId,
        userId,
        action: 'deafen',
      });
    }
  }

  // ── Voz: modo reunião (ouvindo só a live) — relay para a sala ──
  @SubscribeMessage('voice:focus')
  async handleVoiceFocus(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceRoomId: string; focused: boolean },
  ) {
    const userId = client.data.userId;
    if (!this.inVoice(client, data?.voiceRoomId)) return; // só quem entrou na sala (voice:join autorizado)
    if (!userId || !data.voiceRoomId) return;
    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:focus', {
      userId,
      focused: !!data.focused,
    });
  }

  // ── Voz: chat efêmero da sala (não persiste no banco) ─────────
  @SubscribeMessage('voice:chat')
  async handleVoiceChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceRoomId: string; content: string },
  ) {
    const userId = client.data.userId;
    if (!this.inVoice(client, data?.voiceRoomId)) return; // só quem entrou na sala (voice:join autorizado)
    if (!userId) throw new WsException('Não autenticado');

    const content = (data.content || '').trim().slice(0, 1000);
    if (!content) return;

    // Rate limiting compartilhado com as mensagens de canal
    if (!checkRateLimit(client.id)) {
      client.emit('error', { message: 'Muitas mensagens. Aguarde alguns segundos.' });
      return;
    }

    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:chat', {
      userId,
      content,
      ts: Date.now(),
    });
  }

  // ── Voz: sair da sala ─────────────────────────────────────────
  @SubscribeMessage('voice:leave')
  async handleVoiceLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceRoomId: string; serverId?: string },
  ) {
    const userId = client.data.userId;
    if (!this.inVoice(client, data?.voiceRoomId)) return;
    data.serverId = client.data.voiceServerId;
    await client.leave(`voice:${data.voiceRoomId}`);
    await this.redis.removeFromVoiceRoom(data.voiceRoomId, userId);

    client.data.voiceRoomId = undefined;
    client.data.voiceServerId = undefined;

    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:user_left', { userId });

    if (data.serverId) {
      this.server.to(`server:${data.serverId}`).emit('voice:presence', {
        serverId: data.serverId,
        voiceRoomId: data.voiceRoomId,
        userId,
        action: 'leave',
      });
    }
  }

  // ── Helper: extrai token do handshake ─────────────────────────
  private extractToken(client: Socket): string {
    const auth = client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '') ||
      client.handshake.query?.token;

    if (!auth) throw new Error('Token não fornecido');
    return auth as string;
  }

  // ── API pública para emitir eventos de outros serviços ────────
  emitToChannel(channelId: string, event: string, data: any) {
    this.server.to(`channel:${channelId}`).emit(event, data);
  }

  emitToServer(serverId: string, event: string, data: any) {
    this.server.to(`server:${serverId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any) {
    const socketId = userSocketMap.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }
}
