import {
  Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ServersService } from './servers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class ServersController {
  constructor(private serversService: ServersService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateServerDto) {
    return this.serversService.create(userId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.serversService.findById(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser('id') userId: string, @Body() dto: UpdateServerDto) {
    return this.serversService.update(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.serversService.delete(id, userId);
  }

  @Delete(':id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.serversService.leave(id, userId);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.serversService.getMembers(id, userId);
  }

  @Patch(':id/members/me')
  setMyNickname(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { nickname?: string | null },
  ) {
    return this.serversService.setMyNickname(id, userId, body?.nickname ?? null);
  }

  @Get(':id/bans')
  getBans(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.serversService.getBans(id, userId);
  }

  @Get(':id/emojis')
  listEmojis(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.serversService.listEmojis(id, userId);
  }

  @Delete(':id/emojis/:emojiId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEmoji(
    @Param('id') id: string,
    @Param('emojiId') emojiId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.serversService.deleteEmoji(id, emojiId, userId);
  }

  @Post(':id/template')
  createTemplate(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { title: string; description?: string },
  ) {
    return this.serversService.createTemplate(id, userId, body?.title || 'Meu servidor', body?.description);
  }
}

// ── Uso de modelos (rota /templates) ────────────────────────────
@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private serversService: ServersService) {}

  @Get(':code')
  preview(@Param('code') code: string) {
    return this.serversService.getTemplate(code);
  }

  @Post(':code/use')
  use(
    @Param('code') code: string,
    @CurrentUser('id') userId: string,
    @Body() body: { name?: string },
  ) {
    return this.serversService.useTemplate(code, userId, body?.name);
  }
}
