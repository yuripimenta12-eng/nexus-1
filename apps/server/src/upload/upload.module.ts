import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MessagesModule } from '../messages/messages.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    MessagesModule,
    GatewayModule,
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
