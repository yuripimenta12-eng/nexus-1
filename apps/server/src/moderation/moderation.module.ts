import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { ServersModule } from '../servers/servers.module';
import { RolesModule } from '../roles/roles.module';
import { GatewayModule } from '../gateway/gateway.module';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [ServersModule, RolesModule, GatewayModule, VoiceModule],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
