import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DmsController } from './dms.controller';
import { DmsService } from './dms.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { UploadService } from '../upload/upload.service';
import { VoiceModule } from '../voice/voice.module';

@Module({
  imports: [
    PrismaModule,
    GatewayModule,
    VoiceModule,
    MulterModule.register({ storage: memoryStorage(), limits: { fileSize: 50 * 1024 * 1024, files: 1 } }),
  ],
  controllers: [DmsController],
  // UploadService direto (sem importar UploadModule) para não criar ciclo de módulos
  providers: [DmsService, UploadService],
  exports: [DmsService],
})
export class DmsModule {}
