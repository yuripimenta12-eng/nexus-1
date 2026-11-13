import { Module } from '@nestjs/common';
import { DepoimentosController } from './depoimentos.controller';
import { DepoimentosService } from './depoimentos.service';

@Module({
  controllers: [DepoimentosController],
  providers: [DepoimentosService],
})
export class DepoimentosModule {}
