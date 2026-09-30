import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface PushPayload {
  title: string;
  body: string;
  url: string;   // caminho aberto ao tocar na notificação (ex.: /app/dms/abc)
  tag?: string;  // mesma tag = substitui a notificação anterior (não empilha)
  icon?: string;
}

interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const VAPID_KEY = 'vapid';

// Notificações no celular/computador com o Nexus FECHADO (Web Push).
// Só envia para quem não está com o Nexus aberto: com o app aberto, o aviso
// já chega pelo socket (som + notificação da própria página).
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private vapid: Promise<{ publicKey: string; privateKey: string }> | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  // Chaves VAPID: geradas uma única vez e guardadas no banco. Trocar as chaves
  // invalidaria todas as inscrições, então nunca regeramos se já existirem.
  private getVapidKeys() {
    if (!this.vapid) {
      this.vapid = (async () => {
        const saved = await this.prisma.appSetting.findUnique({ where: { key: VAPID_KEY } });
        if (saved) return JSON.parse(saved.value);
        const keys = webpush.generateVAPIDKeys();
        // upsert protege contra duas instâncias gerando ao mesmo tempo
        const row = await this.prisma.appSetting.upsert({
          where: { key: VAPID_KEY },
          create: { key: VAPID_KEY, value: JSON.stringify(keys) },
          update: {},
        });
        return JSON.parse(row.value);
      })().catch(err => {
        this.vapid = null;
        throw err;
      });
    }
    return this.vapid;
  }

  async getPublicKey() {
    return (await this.getVapidKeys()).publicKey;
  }

  async subscribe(userId: string, sub: SubscriptionInput) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  // Dispara sem bloquear quem chamou (mensagem não pode atrasar por causa do push)
  notifyUsers(userIds: string[], payload: PushPayload) {
    if (!userIds.length) return;
    void this.send(userIds, payload).catch(err =>
      this.logger.warn(`Falha ao enviar push: ${err.message}`),
    );
  }

  private async send(userIds: string[], payload: PushPayload) {
    // Quem está com o Nexus aberto (socket conectado) não recebe push
    const offline: string[] = [];
    for (const id of new Set(userIds)) {
      const presence = await this.redis.getUserPresence(id).catch(() => null);
      if (!presence) offline.push(id);
    }
    if (!offline.length) return;

    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: offline } },
    });
    if (!subs.length) return;

    const keys = await this.getVapidKeys();
    const appUrl = this.config.get<string>('APP_URL', 'https://www.nexuslink.art');
    const options = {
      vapidDetails: { subject: appUrl, publicKey: keys.publicKey, privateKey: keys.privateKey },
      TTL: 60 * 60 * 12, // tenta entregar por até 12h se o aparelho estiver sem internet
      urgency: 'high' as const,
    };
    const body = JSON.stringify({
      ...payload,
      body: payload.body.length > 140 ? `${payload.body.slice(0, 140)}…` : payload.body,
      icon: payload.icon || '/icon-192.png',
    });

    await Promise.all(
      subs.map(async s => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            options,
          );
        } catch (err: any) {
          // 404/410: o aparelho cancelou a inscrição (app desinstalado, permissão
          // revogada) — remove para não tentar de novo
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          } else {
            this.logger.warn(`Push recusado (${err?.statusCode ?? '?'}) para ${s.userId}`);
          }
        }
      }),
    );
  }
}
