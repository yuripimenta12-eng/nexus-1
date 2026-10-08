import { Module } from '@nestjs/common';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { ServersModule } from '../servers/servers.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [ServersModule, RolesModule],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
