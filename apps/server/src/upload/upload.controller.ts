import {
  Controller, Post, UseGuards, UseInterceptors, UploadedFile, Param, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { NexusGateway } from '../gateway/nexus.gateway';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private gateway: NexusGateway,
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

  @Post('banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    const { url } = await this.uploadService.uploadFile(file, 'banners');

    await this.prisma.profile.update({
      where: { userId },
      data: { bannerUrl: url, bannerColor: null },
    });

    return { bannerUrl: url };
  }

  @Post('attachment/:channelId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Param('channelId') channelId: string,
    @Body('messageId') messageId: string,
    @Body('content') content: string,
    @CurrentUser('id') userId: string,
  ) {
    const { url } = await this.uploadService.uploadFile(file, 'attachments');

    // Sem messageId: cria a mensagem junto com o anexo e transmite ao canal
    // (fluxo do botão de anexo no chat — a validação de acesso ao canal
    // acontece dentro do MessagesService.create)
    if (!messageId) {
      const message = await this.messagesService.create(channelId, userId, {
        content: content ?? '',
      } as any);

      await this.prisma.attachment.create({
        data: {
          messageId: message.id,
          uploaderId: userId,
          url,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      });

      const full = await this.prisma.message.findUnique({
        where: { id: message.id },
        include: {
          author: { include: { profile: true } },
          reactions: true,
          attachments: true,
          replyTo: { include: { author: { include: { profile: true } } } },
        },
      });

      this.gateway.emitToChannel(channelId, 'message:new', full);
      return full;
    }

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
