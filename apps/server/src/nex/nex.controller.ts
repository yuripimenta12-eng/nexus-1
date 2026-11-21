import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NexService } from './nex.service';

@Controller('nex')
@UseGuards(JwtAuthGuard)
export class NexController {
  constructor(private nex: NexService) {}

  @Get()
  resumo(@CurrentUser('id') userId: string) {
    return this.nex.resumo(userId);
  }

  @Post('presenca')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  presenca(@CurrentUser('id') userId: string) {
    return this.nex.pegarPresenca(userId);
  }

  @Post('roleta')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  roleta(@CurrentUser('id') userId: string) {
    return this.nex.girarRoleta(userId);
  }

  @Post('missoes/:id')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  missao(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.nex.resgatarMissao(userId, id);
  }

  @Get('extrato')
  extrato(@CurrentUser('id') userId: string) {
    return this.nex.extrato(userId);
  }
}
