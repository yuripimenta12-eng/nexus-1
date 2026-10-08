import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ServersModule } from '../servers/servers.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [ServersModule, RolesModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
