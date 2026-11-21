import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountDeletionService } from './account-deletion.service';
import { UploadService } from '../upload/upload.service';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [PresenceModule],
  controllers: [UsersController],
  // UploadService entra direto (ele só depende do ConfigService): importar o
  // UploadModule criaria o ciclo Auth → Users → Upload → Gateway → Auth.
  providers: [UsersService, AccountDeletionService, UploadService],
  exports: [UsersService],
})
export class UsersModule {}
