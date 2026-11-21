import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PresenceService {
  constructor(private redis: RedisService) {}

  // "Jogando …" vindo do app de PC. Expira sozinho se o app parar de avisar.
  async setActivity(userId: string, name: string | null) {
    if (name) {
      // "desde": continua contando enquanto o jogo for o mesmo
      const antes = await this.redis.getTemp(`activity:${userId}`);
      const desde = antes === name ? await this.redis.getTemp(`activitySince:${userId}`) : null;
      await this.redis.setTemp(`activity:${userId}`, name, 180);
      await this.redis.setTemp(`activitySince:${userId}`, desde || String(Date.now()), 180);
    } else {
      await this.redis.del(`activity:${userId}`);
      await this.redis.del(`activitySince:${userId}`);
    }
  }

  /** Jogo aberto agora e desde quando (ms), ou null. */
  async getActivity(userId: string): Promise<{ nome: string; desde: number | null } | null> {
    const nome = await this.redis.getTemp(`activity:${userId}`);
    if (!nome) return null;
    const desde = Number(await this.redis.getTemp(`activitySince:${userId}`));
    return { nome, desde: Number.isFinite(desde) && desde > 0 ? desde : null };
  }

  async getBulkActivity(userIds: string[]): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {};
    await Promise.all(userIds.map(async (id) => { out[id] = await this.redis.getTemp(`activity:${id}`); }));
    return out;
  }

  async getUserStatus(userId: string): Promise<string> {
    const presence = await this.redis.getUserPresence(userId);
    return presence?.status ?? 'OFFLINE';
  }

  async getBulkStatus(userIds: string[]): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    await Promise.all(
      userIds.map(async (id) => {
        results[id] = await this.getUserStatus(id);
      }),
    );
    return results;
  }
}
