import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GifsService } from './gifs.service';

@Controller('gifs')
@UseGuards(JwtAuthGuard)
export class GifsController {
  constructor(private gifs: GifsService) {}

  @Get('status')
  status() { return this.gifs.status(); }

  @Get('trending')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  trending() { return this.gifs.trending(); }

  @Get('search')
  @Throttle({ default: { ttl: 60000, limit: 40 } })
  search(@Query('q') q: string) { return this.gifs.search(q); }
}
