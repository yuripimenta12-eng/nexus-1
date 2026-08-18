import { Module } from '@nestjs/common';
import { NexusGateway } from './nexus.gateway';
import { MessagesModule } from '../messages/messages.module';
import { ServersModule } from '../servers/servers.module';
import { PresenceModule } from '../presence/presence.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [MessagesModule, ServersModule, PresenceModule, AuthModule],
  providers: [NexusGateway],
  exports: [NexusGateway],
})
export class GatewayModule {}
