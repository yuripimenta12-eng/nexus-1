import { Controller, Get, Post, Delete, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MemberRole } from '@prisma/client';

@Controller('moderation')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  @Post('servers/:serverId/kick/:userId')
  kick(
    @Param('serverId') serverId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') requesterId: string,
    @Body('reason') reason?: string,
  ) {
    return this.moderationService.kick(serverId, targetUserId, requesterId, reason);
  }

  @Post('servers/:serverId/ban/:userId')
  ban(
    @Param('serverId') serverId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') requesterId: string,
    @Body('reason') reason?: string,
  ) {
    return this.moderationService.ban(serverId, targetUserId, requesterId, reason);
  }

  @Delete('servers/:serverId/ban/:userId')
  unban(
    @Param('serverId') serverId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') requesterId: string,
  ) {
    return this.moderationService.unban(serverId, targetUserId, requesterId);
  }

  @Patch('servers/:serverId/mute/:userId')
  mute(
    @Param('serverId') serverId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') requesterId: string,
    @Body('muted') muted: boolean,
  ) {
    return this.moderationService.mute(serverId, targetUserId, requesterId, muted);
  }

  @Patch('servers/:serverId/role/:userId')
  setRole(
    @Param('serverId') serverId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('id') requesterId: string,
    @Body('role') role: MemberRole,
  ) {
    return this.moderationService.setRole(serverId, targetUserId, requesterId, role);
  }

  @Post('report')
  report(
    @CurrentUser('id') reporterId: string,
    @Body() dto: any,
  ) {
    return this.moderationService.report(reporterId, dto);
  }

  @Get('blocks')
  listBlocks(@CurrentUser('id') blockerId: string) {
    return this.moderationService.listBlocks(blockerId);
  }

  @Post('block/:userId')
  block(@CurrentUser('id') blockerId: string, @Param('userId') blockedId: string) {
    return this.moderationService.block(blockerId, blockedId);
  }

  @Delete('block/:userId')
  unblock(@CurrentUser('id') blockerId: string, @Param('userId') blockedId: string) {
    return this.moderationService.unblock(blockerId, blockedId);
  }
}
