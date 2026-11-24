import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PagamentosService } from './pagamentos.service';

@Controller('pagamentos')
@UseGuards(JwtAuthGuard)
export class PagamentosController {
  constructor(private pagamentos: PagamentosService) {}

  @Get('disponivel')
  disponivel() { return this.pagamentos.disponivel(); }

  @Post('pix')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  criar(@CurrentUser('id') userId: string, @Body() body: { tipo?: unknown; item?: unknown; valorCentavos?: unknown }) {
    return this.pagamentos.criar(userId, body);
  }

  @Get('pix/:id')
  ver(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.pagamentos.ver(userId, id);
  }
}
