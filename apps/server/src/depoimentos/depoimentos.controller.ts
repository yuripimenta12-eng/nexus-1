import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DepoimentosService } from './depoimentos.service';

@Controller('depoimentos')
export class DepoimentosController {
  constructor(private depoimentos: DepoimentosService) {}

  // Página inicial: aberto, sem login (só os aprovados)
  @Get('publicos')
  publicos() {
    return this.depoimentos.publicos();
  }

  @Get('meu')
  @UseGuards(JwtAuthGuard)
  meu(@CurrentUser('id') userId: string) {
    return this.depoimentos.meu(userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  enviar(@CurrentUser('id') userId: string, @Body() body: { texto?: string; nota?: number }) {
    return this.depoimentos.enviar(userId, body);
  }

  @Delete('meu')
  @UseGuards(JwtAuthGuard)
  apagarMeu(@CurrentUser('id') userId: string) {
    return this.depoimentos.apagarMeu(userId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard)
  todos(@CurrentUser('id') userId: string) {
    return this.depoimentos.todos(userId);
  }

  // acao: "aprovar" | "esconder" | "apagar"
  @Post('admin/:id')
  @UseGuards(JwtAuthGuard)
  moderar(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: { acao?: string }) {
    return this.depoimentos.moderar(userId, id, body?.acao);
  }
}
