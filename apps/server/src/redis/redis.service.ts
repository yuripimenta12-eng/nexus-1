import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(@Inject('REDIS_OPTIONS') private options: { url: string }) {
    this.client = new Redis(options.url, {
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.client.on('error', (err) => {
      console.error('[Redis] Erro de conexão:', err.message);
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  // ── Presença de usuários ─────────────────────────────────────
  async setUserOnline(userId: string, socketId: string) {
    await this.client.hset(`presence:${userId}`, 'socketId', socketId, 'status', 'ONLINE');
    await this.client.expire(`presence:${userId}`, 3600); // expira em 1h sem reconexão
  }

  async setUserOffline(userId: string) {
    await this.client.del(`presence:${userId}`);
  }

  async getUserPresence(userId: string): Promise<{ socketId: string; status: string } | null> {
    const data = await this.client.hgetall(`presence:${userId}`);
    if (!data.socketId) return null;
    return data as { socketId: string; status: string };
  }

  async setUserStatus(userId: string, status: string) {
    await this.client.hset(`presence:${userId}`, 'status', status);
  }

  // ── Typing indicators ────────────────────────────────────────
  async setTyping(channelId: string, userId: string) {
    await this.client.setex(`typing:${channelId}:${userId}`, 5, '1');
  }

  async getTypingUsers(channelId: string): Promise<string[]> {
    const keys = await this.client.keys(`typing:${channelId}:*`);
    return keys.map((k) => k.split(':')[2]);
  }

  // ── Socket rooms (salas de voz) ──────────────────────────────
  async addToVoiceRoom(roomId: string, userId: string) {
    await this.client.sadd(`voice:${roomId}`, userId);
  }

  async removeFromVoiceRoom(roomId: string, userId: string) {
    await this.client.srem(`voice:${roomId}`, userId);
  }

  async getVoiceRoomMembers(roomId: string): Promise<string[]> {
    return this.client.smembers(`voice:${roomId}`);
  }

  // ── Sessions ─────────────────────────────────────────────────
  async blacklistToken(token: string, ttlSeconds: number) {
    await this.client.setex(`blacklist:${token}`, ttlSeconds, '1');
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.client.exists(`blacklist:${token}`);
    return result === 1;
  }

  // ── Genérico ─────────────────────────────────────────────────
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async publish(channel: string, message: string) {
    await this.client.publish(channel, message);
  }
}
