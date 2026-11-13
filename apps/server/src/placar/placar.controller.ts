import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PlacarService } from './placar.service';

@Controller('placar')
@UseGuards(JwtAuthGuard)
export class PlacarController {
  constructor(private placar: PlacarService) {}

  // Uma vez por minuto enquanto a pessoa está numa call
  @Post('batimento')
  batimento(@CurrentUser('id') userId: string, @Body() body: { roomId?: string; falando?: number; camera?: number }) {
    return this.placar.batimento(userId, body);
  }

  // "musica" (DJ ou janela de música) ou "live" (começou a transmitir a tela)
  @Post('evento')
  evento(@CurrentUser('id') userId: string, @Body() body: { roomId?: string; tipo?: string; recibo?: string }) {
    return this.placar.evento(userId, body);
  }

  @Get('conquistas')
  conquistas(@CurrentUser('id') userId: string) {
    return this.placar.conquistas(userId);
  }

  @Get('servidor/:serverId')
  doServidor(@CurrentUser('id') userId: string, @Param('serverId') serverId: string, @Query('tipo') tipo: string) {
    return this.placar.placar(userId, serverId, tipo);
  }
}
