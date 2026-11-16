import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com', 'web.push.apple.com'];

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
    // Só serviços de push conhecidos (Google, Mozilla, Microsoft, Apple): antes
    // qualquer https servia e o servidor fazia POSTs para onde a pessoa quisesse
    let host = '';
    try { host = new URL(sub.endpoint).hostname; } catch { /* inválido */ }
    if (!PUSH_HOSTS.some(h => host === h || host.endsWith('.' + h))) {
      throw new BadRequestException('Serviço de notificação não suportado');
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    // No máximo 10 aparelhos por pessoa: apaga os mais antigos
    const antigas = await this.prisma.pushSubscription.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, skip: 10, select: { id: true },
    });
    if (antigas.length) await this.prisma.pushSubscription.deleteMany({ where: { id: { in: antigas.map(a => a.id) } } });
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
      timeout: 10_000, // serviço de push lento não segura conexões abertas
    };
    const body = JSON.stringify({
      ...payload,
      body: payload.body.length > 140 ? `${payload.body.slice(0, 140)}…` : payload.body,
      icon: payload.icon || '/icon-192.png',
    });

    // Em lotes de 20, para não travar o servidor com muitas criptografias de uma vez
    for (let i = 0; i < subs.length; i += 20) await Promise.all(
      subs.slice(i, i + 20).map(async s => {
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
