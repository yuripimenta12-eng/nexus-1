import {
  Controller, Get, Post, Patch, Delete, Param, Body, Put, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('servers/:serverId/roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  list(@Param('serverId') serverId: string, @CurrentUser('id') userId: string) {
    return this.rolesService.list(serverId, userId);
  }

  @Post()
  create(
    @Param('serverId') serverId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { name?: string },
  ) {
    return this.rolesService.create(serverId, userId, body?.name);
  }

  @Patch(':roleId')
  update(
    @Param('serverId') serverId: string,
    @Param('roleId') roleId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { name?: string; color?: string; hoist?: boolean; mentionable?: boolean; permissions?: string[]; position?: number },
  ) {
    return this.rolesService.update(serverId, roleId, userId, body || {});
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('serverId') serverId: string,
    @Param('roleId') roleId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.rolesService.delete(serverId, roleId, userId);
  }

  @Get(':roleId/members')
  members(
    @Param('serverId') serverId: string,
    @Param('roleId') roleId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.rolesService.membersOf(serverId, roleId, userId);
  }

  @Put(':roleId/members/:targetUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  assign(
    @Param('serverId') serverId: string,
    @Param('roleId') roleId: string,
    @Param('targetUserId') targetUserId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.rolesService.assign(serverId, roleId, targetUserId, userId);
  }

  @Delete(':roleId/members/:targetUserId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unassign(
    @Param('serverId') serverId: string,
    @Param('roleId') roleId: string,
    @Param('targetUserId') targetUserId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.rolesService.unassign(serverId, roleId, targetUserId, userId);
  }
}
