import { Module } from '@nestjs/common';
import { ZoeirasController } from './zoeiras.controller';
import { ZoeirasService } from './zoeiras.service';
import { VoiceModule } from '../voice/voice.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [VoiceModule, GatewayModule],
  controllers: [ZoeirasController],
  providers: [ZoeirasService],
})
export class ZoeirasModule {}
