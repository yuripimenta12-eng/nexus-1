import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PresenceService {
  constructor(private redis: RedisService) {}

  // "Jogando …" vindo do app de PC. Expira sozinho se o app parar de avisar.
  async setActivity(userId: string, name: string | null) {
    if (name) await this.redis.setTemp(`activity:${userId}`, name, 180);
    else await this.redis.del(`activity:${userId}`);
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
