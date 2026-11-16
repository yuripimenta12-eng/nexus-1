import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlanosModule } from '../planos/planos.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [PlanosModule, GatewayModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
