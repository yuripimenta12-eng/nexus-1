import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { ServersModule } from '../servers/servers.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [ServersModule, RolesModule],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
