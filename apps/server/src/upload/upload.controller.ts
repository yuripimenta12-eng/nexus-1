import {
  Controller, Post, UseGuards, UseInterceptors, UploadedFile, Param, Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesService } from '../messages/messages.service';
import { NexusGateway } from '../gateway/nexus.gateway';
import { RolesService } from '../roles/roles.service';

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private uploadService: UploadService,
    private prisma: PrismaService,
    private messagesService: MessagesService,
    private gateway: NexusGateway,
    private rolesService: RolesService,
  ) {}

  // ── Ícone do servidor (512x512 recomendado) ───────────────────
  @Post('server-icon/:serverId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadServerIcon(
    @UploadedFile() file: Express.Multer.File,
    @Param('serverId') serverId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.rolesService.requirePermission(serverId, userId, 'manage_server');
    if (!file?.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Envie uma imagem (PNG, JPG ou GIF)');
    }
    const { url } = await this.uploadService.uploadFile(file, 'server-icons');
    await this.prisma.server.update({ where: { id: serverId }, data: { iconUrl: url } });
    return { iconUrl: url };
  }

  // ── Emoji customizado do servidor (máx. 50) ───────────────────
  @Post('emoji/:serverId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadEmoji(
    @UploadedFile() file: Express.Multer.File,
    @Param('serverId') serverId: string,
    @Body('name') name: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.rolesService.requirePermission(serverId, userId, 'create_expressions');
    if (!file?.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Envie uma imagem (PNG, JPG ou GIF)');
    }
    if (file.size > 512 * 1024) {
      throw new BadRequestException('Emoji deve ter no máximo 512KB');
    }

    const count = await this.prisma.customEmoji.count({ where: { serverId } });
    if (count >= 50) throw new BadRequestException('Limite de 50 emojis atingido');

    // Nome: informado ou derivado do arquivo; só letras/números/_ (padrão :nome:)
    const base = (name || file.originalname.replace(/\.[^.]+$/, ''))
      .toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
      .slice(0, 32);
    if (!base) throw new BadRequestException('Nome de emoji inválido');

    const exists = await this.prisma.customEmoji.findUnique({
      where: { serverId_name: { serverId, name: base } },
    });
    if (exists) throw new BadRequestException(`Já existe um emoji :${base}: neste servidor`);

    const { url } = await this.uploadService.uploadFile(file, 'emojis');
    return this.prisma.customEmoji.create({
      data: { serverId, name: base, url, creatorId: userId },
    });
  }

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
