import { Module } from '@nestjs/common';
import { UnidosGateway } from './unidos.gateway';

// UNidos: jogo de cartas dentro da chamada de voz
@Module({ providers: [UnidosGateway] })
export class UnidosModule {}
