import { Module } from '@nestjs/common';
import { IdeiasController } from './ideias.controller';
import { IdeiasService } from './ideias.service';

@Module({
  controllers: [IdeiasController],
  providers: [IdeiasService],
})
export class IdeiasModule {}
