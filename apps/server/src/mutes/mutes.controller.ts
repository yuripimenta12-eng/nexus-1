import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MutesService } from './mutes.service';

@Controller('notifications/mutes')
@UseGuards(JwtAuthGuard)
export class MutesController {
  constructor(private mutes: MutesService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.mutes.list(userId);
  }

  @Put()
  set(
    @CurrentUser('id') userId: string,
    @Body() body: { serverId?: string; channelId?: string; muted?: boolean },
  ) {
    return this.mutes.set(userId, body);
  }
}
