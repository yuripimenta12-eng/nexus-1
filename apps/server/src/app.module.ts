import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ServersModule } from './servers/servers.module';
import { ChannelsModule } from './channels/channels.module';
import { MessagesModule } from './messages/messages.module';
import { VoiceModule } from './voice/voice.module';
import { InvitesModule } from './invites/invites.module';
import { ModerationModule } from './moderation/moderation.module';
import { AdminModule } from './admin/admin.module';
import { UploadModule } from './upload/upload.module';
import { PresenceModule } from './presence/presence.module';
import { GatewayModule } from './gateway/gateway.module';
import { DmsModule } from './dms/dms.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ServersModule,
    ChannelsModule,
    MessagesModule,
    VoiceModule,
    InvitesModule,
    ModerationModule,
    AdminModule,
    UploadModule,
    PresenceModule,
    GatewayModule,
    DmsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Aplica rate limiting a TODAS as rotas HTTP (100 req/min por IP).
    // Sem este APP_GUARD, o ThrottlerModule fica registrado mas inerte.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
