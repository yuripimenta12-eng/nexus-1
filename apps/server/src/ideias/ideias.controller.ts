import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdeiasService } from './ideias.service';

@Controller('ideias')
@UseGuards(JwtAuthGuard)
export class IdeiasController {
  constructor(private ideias: IdeiasService) {}

  @Get()
  listar(@CurrentUser('id') userId: string) {
    return this.ideias.listar(userId);
  }

  @Put(':id/voto')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  votar(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: { tipo?: 'quero' | 'nao' | null }) {
    return this.ideias.votar(userId, id, body?.tipo ?? null);
  }
}
