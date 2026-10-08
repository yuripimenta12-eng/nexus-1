import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { SearchController } from './search.controller';
import { ServersModule } from '../servers/servers.module';
import { RolesModule } from '../roles/roles.module';
import { MutesModule } from '../mutes/mutes.module';

@Module({
  imports: [ServersModule, RolesModule, MutesModule],
  controllers: [MessagesController, SearchController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
