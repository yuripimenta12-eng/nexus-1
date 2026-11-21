import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import type SharpFn from 'sharp';
// sharp 0.35: no CommonJS o require devolve a própria função (os tipos vêm como ESM)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp: typeof SharpFn = require('sharp');
import { v4 as uuidv4 } from 'uuid';
import { ARQUIVO_MAX_MB } from '../planos/planos.regras';

const EXT_POR_TIPO: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'application/zip': 'zip',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

@Injectable()
export class UploadService {
  private s3: AWS.S3;
  private bucket: string;
  private publicUrl: string;
  // Fica true quando S3_ENDPOINT aponta para localhost/127.0.0.1 (MinIO local
  // de desenvolvimento) ou faltam credenciais — nesse caso não há para onde
  // enviar o arquivo em produção, então caímos no fallback de data URL.
  private readonly s3Configured: boolean;
  private readonly useAcl: boolean = true;
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
    // Cloudflare R2 e o MinIO do VPS nao usam ACL por objeto (o acesso publico
    // vem da politica do bucket); enviar x-amz-acl causa erro no PutObject.
    // S3_NO_ACL=true desliga explicitamente para qualquer provedor.
    this.useAcl =
      !/r2\.cloudflarestorage\.com/.test(endpoint) &&
      config.get<string>('S3_NO_ACL', 'false') !== 'true';
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: 'avatars' | 'attachments' | 'banners' | 'server-icons' | 'emojis',
    // limiteMB: tamanho máximo pelo plano; animado: foto/capa em GIF continua animada (Nexus+/Pro)
    opts: { limiteMB?: number; animado?: boolean } = {},
  ): Promise<{ url: string; key: string }> {
    if (!file?.buffer) throw new BadRequestException('Nenhum arquivo enviado');
    // "audio/webm;codecs=opus" (gravador do navegador) → "audio/webm"
    file.mimetype = (file.mimetype || '').split(';')[0].trim().toLowerCase();
    this.validateFile(file, folder, opts.limiteMB);

    // Extensão e nome vêm do usuário: só letras/números (nada de "../" ou aspas no cabeçalho)
    // Extensão vem do tipo já validado (não do nome): nada de ".html"/".exe" no bucket
    const ext = EXT_POR_TIPO[file.mimetype] || 'bin';
    const safeName = (file.originalname || 'arquivo').replace(/[^\w.\- ()À-ÿ]/g, '_').slice(0, 120);
    let key = `${folder}/${uuidv4()}.${ext}`;
    let buffer = file.buffer;

    // Foto e capa: animação (GIF ou WebP animado) só para Nexus+/Pro; no
    // grátis vira imagem parada (o primeiro quadro)
    const perfil = folder === 'avatars' || folder === 'banners';
    if (perfil && opts.animado && file.mimetype === 'image/gif' && file.size > 15 * 1024 * 1024) {
      throw new BadRequestException('GIF muito grande para foto ou capa (máximo 15 MB)');
    }
    const manterGif = file.mimetype === 'image/gif' && (!perfil || opts.animado);
    // "-anim" marca as fotos que têm a cópia parada (as antigas não têm)
    if (perfil && manterGif) key = key.replace(/\.gif$/, '-anim.gif');

    // Otimiza imagens com sharp
    if (file.mimetype.startsWith('image/') && !manterGif) {
      // Teto de pixels para imagens pequenas: um PNG de poucos KB que declara
      // 16000x16000 ocupava os workers que também fazem o login
      buffer = await sharp(file.buffer, { limitInputPixels: 40_000_000, animated: perfil && !!opts.animado && file.mimetype === 'image/webp' })
        .resize(
          folder === 'avatars' ? 256 : folder === 'server-icons' ? 512 : folder === 'emojis' ? 128 : folder === 'banners' ? 1920 : 1920,
          folder === 'avatars' ? 256 : folder === 'server-icons' ? 512 : folder === 'emojis' ? 128 : folder === 'banners' ? 480 : 1080,
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
        ...(this.useAcl ? { ACL: 'public-read' } : {}),
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

    // GIF animado de foto/capa: guarda também uma versão parada, usada se o
    // plano vencer (ver PlanosService: troca ".gif" por "-estatico.webp")
    if (perfil && manterGif) {
      const parado = await sharp(file.buffer, { limitInputPixels: 40_000_000 })
        .resize(folder === 'avatars' ? 256 : 1920, folder === 'avatars' ? 256 : 480, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 }).toBuffer();
      await this.s3.putObject({
        Bucket: this.bucket, Key: key.replace(/\.gif$/, '-estatico.webp'), Body: parado, ContentType: 'image/webp',
        ...(this.useAcl ? { ACL: 'public-read' } : {}),
      }).promise();
    }

    // Upload direto para não-imagens ou GIFs
    await this.s3.putObject({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.mimetype,
      ...(this.useAcl ? { ACL: 'public-read' } : {}),
      // "attachment": o navegador baixa em vez de abrir como página (evita HTML hospedado)
      ContentDisposition: `attachment; filename="${safeName.replace(/[^ -~]/g, '_')}"`,
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

  private validateFile(file: Express.Multer.File, folder: string, limiteMB?: number) {
    const maxSizeMB = limiteMB ?? parseInt(this.config.get<string>('MAX_FILE_SIZE_MB', '50'));
    if (file.size > maxSizeMB * 1024 * 1024) {
      throw new BadRequestException(`Arquivo muito grande. Máximo: ${maxSizeMB} MB${limiteMB && limiteMB < ARQUIVO_MAX_MB ? ' (com o Nexus+ ou o Pro dá para mandar maiores)' : ''}`);
    }

    if (folder === 'avatars' || folder === 'banners' || folder === 'server-icons' || folder === 'emojis') {
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
        // Mensagens de voz e áudios
        'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
        // Vídeos curtos
        'video/mp4', 'video/webm',
      ];
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException('Tipo de arquivo não suportado');
      }
    }
  }
}
