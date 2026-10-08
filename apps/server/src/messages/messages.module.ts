import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ServersModule } from '../servers/servers.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [ServersModule, RolesModule],
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
