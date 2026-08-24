import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private s3: AWS.S3;
  private bucket: string;
  private publicUrl: string;
  // Fica true quando S3_ENDPOINT aponta para localhost/127.0.0.1 (MinIO local
  // de desenvolvimento) ou faltam credenciais — nesse caso não há para onde
  // enviar o arquivo em produção, então caímos no fallback de data URL.
  private readonly s3Configured: boolean;
  private warnedFallback = false;

  constructor(private config: ConfigService) {
    const endpoint = config.get<string>('S3_ENDPOINT', '');
    const accessKey = config.get<string>('S3_ACCESS_KEY', '');
    const secretKey = config.get<string>('S3_SECRET_KEY', '');
    const isLocalEndpoint = /localhost|127\.0\.0\.1/.test(endpoint);
    this.s3Configured = !!endpoint && !!accessKey && !!secretKey && !isLocalEndpoint;

    this.s3 = new AWS.S3({
      endpoint,
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      region: config.get<string>('S3_REGION', 'us-east-1'),
      s3ForcePathStyle: true, // necessário para MinIO
      signatureVersion: 'v4',
    });

    this.bucket = config.get<string>('S3_BUCKET', 'nexus-uploads');
    this.publicUrl = config.get<string>('S3_PUBLIC_URL', '');
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: 'avatars' | 'attachments' | 'banners',
  ): Promise<{ url: string; key: string }> {
    this.validateFile(file, folder);

    const ext = file.originalname.split('.').pop();
    const key = `${folder}/${uuidv4()}.${ext}`;
    let buffer = file.buffer;

    // Otimiza imagens com sharp
    if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/gif') {
      buffer = await sharp(file.buffer)
        .resize(
          folder === 'avatars' ? 256 : folder === 'banners' ? 1920 : 1920,
          folder === 'avatars' ? 256 : folder === 'banners' ? 480 : 1080,
          { fit: 'inside', withoutEnlargement: true },
        )
        .webp({ quality: 85 })
        .toBuffer();

      const webpKey = key.replace(`.${ext}`, '.webp');

      if (!this.s3Configured) {
        return { url: this.toDataUrl(buffer, 'image/webp'), key: webpKey };
      }

      await this.s3.putObject({
        Bucket: this.bucket,
        Key: webpKey,
        Body: buffer,
        ContentType: 'image/webp',
        ACL: 'public-read',
      }).promise();

      return {
        url: `${this.publicUrl}/${webpKey}`,
        key: webpKey,
      };
    }

    if (!this.s3Configured) {
      // GIFs e não-imagens: só cabem no fallback se forem pequenos o bastante
      // para virar data URL sem inchar demais o banco.
      if (buffer.length > 4 * 1024 * 1024) {
        throw new BadRequestException(
          'Armazenamento de arquivos não configurado no servidor. Contate o administrador.',
        );
      }
      return { url: this.toDataUrl(buffer, file.mimetype), key };
    }

    // Upload direto para não-imagens ou GIFs
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
      ContentDisposition: `attachment; filename="${file.originalname}"`,
    }).promise();

    return { url: `${this.publicUrl}/${key}`, key };
  }

  // Fallback sem infraestrutura de armazenamento: embute o arquivo como
  // data URL, guardado diretamente na coluna do banco (avatarUrl/bannerUrl/
  // Attachment.url). Funciona sem nenhuma conta externa; basta configurar
  // S3_ENDPOINT/S3_ACCESS_KEY/S3_SECRET_KEY apontando para um provedor real
  // (Cloudflare R2, Backblaze B2, AWS S3 etc.) para passar a usar object storage.
  private toDataUrl(buffer: Buffer, mimeType: string): string {
    if (!this.warnedFallback) {
      this.warnedFallback = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[UploadService] S3/MinIO não configurado para produção (S3_ENDPOINT ausente ou apontando ' +
        'para localhost). Usando fallback de data URL — configure um object storage real para uploads maiores.',
      );
    }
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  async deleteFile(key: string) {
    if (!this.s3Configured) return; // arquivo vive como data URL no banco, nada para apagar no storage
    await this.s3.deleteObject({ Bucket: this.bucket, Key: key }).promise();
  }

  private validateFile(file: Express.Multer.File, folder: string) {
    const maxSizeMB = parseInt(this.config.get<string>('MAX_FILE_SIZE_MB', '50'));
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new BadRequestException(`Arquivo muito grande. Máximo: ${maxSizeMB}MB`);
    }

    if (folder === 'avatars' || folder === 'banners') {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedImageTypes.includes(file.mimetype)) {
        throw new BadRequestException('Tipo de imagem não suportado');
      }
    } else {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'application/zip',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException('Tipo de arquivo não suportado');
      }
    }
  }
}
