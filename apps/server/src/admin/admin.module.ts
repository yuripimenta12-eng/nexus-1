import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlanosModule } from '../planos/planos.module';

@Module({
  imports: [PlanosModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
