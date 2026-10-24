import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { ServersModule } from '../servers/servers.module';
import { RolesModule } from '../roles/roles.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [ServersModule, RolesModule, GatewayModule],
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}
