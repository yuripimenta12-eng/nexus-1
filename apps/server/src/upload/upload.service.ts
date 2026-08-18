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

  constructor(private config: ConfigService) {
    this.s3 = new AWS.S3({
      endpoint: config.get<string>('S3_ENDPOINT'),
      accessKeyId: config.get<string>('S3_ACCESS_KEY'),
      secretAccessKey: config.get<string>('S3_SECRET_KEY'),
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

      // Corrige extensão para webp
      const webpKey = key.replace(`.${ext}`, '.webp');
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

  async deleteFile(key: string) {
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
