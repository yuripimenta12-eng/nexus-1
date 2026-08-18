import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class PresenceService {
  constructor(private redis: RedisService) {}

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
