import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LojaService } from './loja.service';

@Controller('loja')
@UseGuards(JwtAuthGuard)
export class LojaController {
  constructor(private loja: LojaService) {}

  @Get()
  listar(@CurrentUser('id') userId: string) {
    return this.loja.listar(userId);
  }

  @Post('comprar/:itemId')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  comprar(@CurrentUser('id') userId: string, @Param('itemId') itemId: string) {
    return this.loja.comprar(userId, itemId);
  }

  @Get('baus')
  baus() {
    return this.loja.listarBaus();
  }

  @Post('baus/:id/abrir')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  abrirBau(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.loja.abrirBau(userId, id);
  }

  @Put('tema')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  tema(@CurrentUser('id') userId: string, @Body() body: { serverId?: string; itemId?: string | null }) {
    return this.loja.aplicarTema(userId, body?.serverId, body?.itemId ?? null);
  }

  @Put('equipar')
  @Throttle({ default: { ttl: 60000, limit: 40 } })
  equipar(@CurrentUser('id') userId: string, @Body() body: { tipo?: string; itemId?: string | null }) {
    return this.loja.equipar(userId, body?.tipo, body?.itemId ?? null);
  }
}
