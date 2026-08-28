import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PresenceModule } from '../presence/presence.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PrismaModule, PresenceModule, GatewayModule],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
