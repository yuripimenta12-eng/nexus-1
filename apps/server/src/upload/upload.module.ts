import { ARQUIVO_MAX_MB } from '../planos/planos.regras';
import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MessagesModule } from '../messages/messages.module';
import { GatewayModule } from '../gateway/gateway.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    // Teto no recebimento: sem isso um envio gigante ia inteiro para a memória
    MulterModule.register({ storage: memoryStorage(), limits: { fileSize: ARQUIVO_MAX_MB * 1024 * 1024, files: 1 } }),
    MessagesModule,
    GatewayModule,
    RolesModule,
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
