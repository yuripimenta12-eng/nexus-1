import {
  Controller, Post, UseGuards, UseInterceptors, UploadedFile, Param, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private prisma: PrismaService,
  ) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    const { url } = await this.uploadService.uploadFile(file, 'avatars');

    await this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl: url },
    });

    return { avatarUrl: url };
  }

  @Post('attachment/:channelId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Param('channelId') channelId: string,
    @Body('messageId') messageId: string,
    @CurrentUser('id') userId: string,
  ) {
    const { url } = await this.uploadService.uploadFile(file, 'attachments');

    const attachment = await this.prisma.attachment.create({
      data: {
        messageId,
        uploaderId: userId,
        url,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });

    return attachment;
  }
}
