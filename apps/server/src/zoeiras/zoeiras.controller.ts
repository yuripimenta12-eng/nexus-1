import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZoeirasService } from './zoeiras.service';

@Controller('zoeiras')
@UseGuards(JwtAuthGuard)
export class ZoeirasController {
  constructor(private zoeiras: ZoeirasService) {}

  @Get()
  listar(@CurrentUser('id') userId: string) {
    return this.zoeiras.listar(userId);
  }

  @Post('comprar/:id')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  comprar(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: { qtd?: number }) {
    return this.zoeiras.comprar(userId, id, body?.qtd ?? 1);
  }

  @Post('usar/:id')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  usar(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() body: { voiceRoomId?: string; alvoId?: string }) {
    return this.zoeiras.usar(userId, id, body?.voiceRoomId, body?.alvoId);
  }

  @Put('preferencia')
  preferencia(@CurrentUser('id') userId: string, @Body() body: { receber?: boolean }) {
    return this.zoeiras.preferencia(userId, body?.receber);
  }
}
