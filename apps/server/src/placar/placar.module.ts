import { Module } from '@nestjs/common';
import { PlacarController } from './placar.controller';
import { PlacarService } from './placar.service';

@Module({
  controllers: [PlacarController],
  providers: [PlacarService],
})
export class PlacarModule {}
