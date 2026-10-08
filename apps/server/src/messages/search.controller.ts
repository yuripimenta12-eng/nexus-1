import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';

// Busca de mensagens nos canais de um servidor
@Controller('servers/:serverId/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private messages: MessagesService) {}

  @Get()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  search(
    @Param('serverId') serverId: string,
    @CurrentUser('id') userId: string,
    @Query('q') q: string,
    @Query('channelId') channelId?: string,
  ) {
    return this.messages.searchServer(serverId, userId, q, channelId);
  }
}
