import { Module } from '@nestjs/common';
import { PlanosModule } from '../planos/planos.module';
import { GatewayModule } from '../gateway/gateway.module';
import { PagamentosController } from './pagamentos.controller';
import { PagamentosService } from './pagamentos.service';
import { EfiCliente } from './efi.cliente';

@Module({
  imports: [PlanosModule, GatewayModule],
  controllers: [PagamentosController],
  providers: [PagamentosService, EfiCliente],
})
export class PagamentosModule {}
