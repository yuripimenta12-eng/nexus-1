import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PlanosService } from './planos.service';

@Controller('planos')
@UseGuards(JwtAuthGuard)
export class PlanosController {
  constructor(private planos: PlanosService) {}

  // Plano atual e painel de afiliado (link, indicados, dias ganhos)
  @Get('meu')
  meu(@CurrentUser('id') userId: string) {
    return this.planos.meu(userId);
  }
}
