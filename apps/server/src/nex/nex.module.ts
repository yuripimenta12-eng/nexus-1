import { Module } from '@nestjs/common';
import { NexController } from './nex.controller';
import { NexService } from './nex.service';

@Module({
  controllers: [NexController],
  providers: [NexService],
  exports: [NexService],
})
export class NexModule {}
