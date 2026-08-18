import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private invitesService: InvitesService) {}

  @Post('servers/:serverId')
  create(
    @Param('serverId') serverId: string,
    @CurrentUser('id') userId: string,
    @Body() opts: { maxUses?: number; expiresInHours?: number; guestAccess?: boolean },
  ) {
    return this.invitesService.create(serverId, userId, opts);
  }

  @Get('servers/:serverId')
  getForServer(@Param('serverId') serverId: string, @CurrentUser('id') userId: string) {
    return this.invitesService.getForServer(serverId, userId);
  }

  @Post(':code/use')
  use(@Param('code') code: string, @CurrentUser('id') userId: string) {
    return this.invitesService.use(code, userId);
  }

  @Delete(':code')
  revoke(@Param('code') code: string, @CurrentUser('id') userId: string) {
    return this.invitesService.revoke(code, userId);
  }
}
