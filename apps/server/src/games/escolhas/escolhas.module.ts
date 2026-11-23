import { Module } from '@nestjs/common';
import { EscolhasGateway } from './escolhas.gateway';

// Par ou ímpar e votação dentro da chamada de voz
@Module({ providers: [EscolhasGateway] })
export class EscolhasModule {}
