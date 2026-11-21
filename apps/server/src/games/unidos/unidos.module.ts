import { Module } from '@nestjs/common';
import { UnidosGateway } from './unidos.gateway';
import { NexModule } from '../../nex/nex.module';

// UNidos: jogo de cartas dentro da chamada de voz (vitórias contam nas missões Nex)
@Module({ imports: [NexModule], providers: [UnidosGateway] })
export class UnidosModule {}
