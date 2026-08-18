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
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from '../messages/messages.service';
import { PresenceService } from '../presence/presence.service';
import { RedisService } from '../redis/redis.service';
import { CreateMessageDto } from '../messages/dto/create-message.dto';

// Mapa: userId → socketId
const userSocketMap = new Map<string, string>();

@WebSocketGateway({
  cors: {
    origin: '*',
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
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway inicializado');
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
    await this.redis.setUserOffline(userId);

    // Notifica rooms que o usuário estava
    const rooms = Array.from(client.rooms).filter(r => r !== client.id);
    rooms.forEach(room => {
      this.server.to(room).emit('user:offline', { userId });
    });

    this.logger.log(`Cliente desconectado: ${userId}`);
  }

  // ── Entrar em sala (canal de texto) ──────────────────────────
  @SubscribeMessage('channel:join')
  async handleJoinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
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
    @MessageBody() data: { channelId: string; content: string; replyToId?: string },
  ) {
    const userId = client.data.userId;
    if (!userId) throw new WsException('Não autenticado');

    const dto: CreateMessageDto = {
      content: data.content,
      replyToId: data.replyToId,
    };

    const message = await this.messagesService.create(data.channelId, userId, dto);

    // Envia para todos no canal (incluindo o remetente)
    this.server.to(`channel:${data.channelId}`).emit('message:new', message);

    return message;
  }

  // ── Editar mensagem ───────────────────────────────────────────
  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    const userId = client.data.userId;
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
    await this.messagesService.delete(data.messageId, userId);

    this.server.to(`channel:${data.channelId}`).emit('message:deleted', {
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
    await this.messagesService.addReaction(data.messageId, userId, data.emoji);

    this.server.to(`channel:${data.channelId}`).emit('reaction:added', {
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
    await this.messagesService.removeReaction(data.messageId, userId, data.emoji);

    this.server.to(`channel:${data.channelId}`).emit('reaction:removed', {
      messageId: data.messageId,
      userId,
      emoji: data.emoji,
    });
  }

  // ── Typing ────────────────────────────────────────────────────
  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    const userId = client.data.userId;
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

    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:state_changed', {
      userId,
      ...data,
    });
  }

  // ── Voz: entrar na sala ───────────────────────────────────────
  @SubscribeMessage('voice:join')
  async handleVoiceJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceRoomId: string },
  ) {
    const userId = client.data.userId;
    await client.join(`voice:${data.voiceRoomId}`);
    await this.redis.addToVoiceRoom(data.voiceRoomId, userId);

    const members = await this.redis.getVoiceRoomMembers(data.voiceRoomId);

    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:user_joined', {
      userId,
      members,
    });
  }

  // ── Voz: sair da sala ─────────────────────────────────────────
  @SubscribeMessage('voice:leave')
  async handleVoiceLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { voiceRoomId: string },
  ) {
    const userId = client.data.userId;
    await client.leave(`voice:${data.voiceRoomId}`);
    await this.redis.removeFromVoiceRoom(data.voiceRoomId, userId);

    this.server.to(`voice:${data.voiceRoomId}`).emit('voice:user_left', { userId });
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
