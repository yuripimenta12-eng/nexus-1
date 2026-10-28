import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnnouncementsService } from './announcements.service';

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private announcements: AnnouncementsService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.announcements.list(userId);
  }

  @Post(':id/read')
  read(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.announcements.markRead(userId, id);
  }

  // Só o dono do Nexus (isAdmin) — conferido no serviço
  @Get('admin')
  adminList(@CurrentUser('id') userId: string) {
    return this.announcements.adminList(userId);
  }

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // evita disparo repetido sem querer
  create(@CurrentUser('id') userId: string, @Body() body: { title?: string; body?: string }) {
    return this.announcements.create(userId, body);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.announcements.remove(userId, id);
  }
}
