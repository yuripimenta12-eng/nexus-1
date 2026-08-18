import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('metrics')
  metrics(@CurrentUser('id') userId: string) {
    return this.adminService.getMetrics(userId);
  }

  @Get('users')
  users(
    @CurrentUser('id') userId: string,
    @Query('page') page?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(userId, page, 50, search);
  }

  @Post('users/:id/suspend')
  suspend(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.adminService.suspendUser(userId, targetId, true);
  }

  @Post('users/:id/unsuspend')
  unsuspend(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.adminService.suspendUser(userId, targetId, false);
  }

  @Get('servers')
  servers(@CurrentUser('id') userId: string, @Query('page') page?: number) {
    return this.adminService.getServers(userId, page);
  }

  @Get('reports')
  reports(@CurrentUser('id') userId: string, @Query('page') page?: number) {
    return this.adminService.getReports(userId, page);
  }

  @Patch('reports/:id')
  resolveReport(
    @CurrentUser('id') userId: string,
    @Param('id') reportId: string,
    @Body() body: { status: string; resolution?: string },
  ) {
    return this.adminService.resolveReport(userId, reportId, body.status, body.resolution);
  }

  @Get('audit-logs')
  auditLogs(
    @CurrentUser('id') userId: string,
    @Query('serverId') serverId?: string,
    @Query('page') page?: number,
  ) {
    return this.adminService.getAuditLogs(userId, serverId, page);
  }
}
