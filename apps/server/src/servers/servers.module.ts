import { Module } from '@nestjs/common';
import { ServersController, TemplatesController } from './servers.controller';
import { ServersService } from './servers.service';
import { PresenceModule } from '../presence/presence.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [PresenceModule, RolesModule],
  controllers: [ServersController, TemplatesController],
  providers: [ServersService],
  exports: [ServersService],
})
export class ServersModule {}
