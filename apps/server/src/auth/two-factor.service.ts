import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Tolera 30s de diferença no relógio do celular (1 janela antes/depois)
authenticator.options = { window: 1 };

const ISSUER = 'Nexus Link';

// Verificação em duas etapas (TOTP — Google Authenticator, Authy, 1Password...).
// O segredo é guardado CIFRADO (AES-256-GCM) com uma chave derivada de um
// segredo do servidor: um vazamento só do banco não revela os segredos.
@Injectable()
export class TwoFactorService {
  private readonly key: Buffer;

  constructor(private prisma: PrismaService, config: ConfigService) {
    const base = config.get<string>('TOTP_ENC_KEY') || config.get<string>('JWT_REFRESH_SECRET') || '';
    this.key = createHash('sha256').update(`nexus-2fa:${base}`).digest();
  }

  private encrypt(plain: string) {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
  }

  private decrypt(blob: string) {
    const [iv, tag, enc] = blob.split('.').map(s => Buffer.from(s, 'base64'));
    const d = createDecipheriv('aes-256-gcm', this.key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  }

  private hashCode(code: string) {
    return createHash('sha256').update(code.replace(/[^A-Z0-9]/gi, '').toUpperCase()).digest('hex');
  }

  // 1) Gera um segredo novo (ainda desligado) e o QR code para escanear
  async setup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.twoFactorEnabled) throw new BadRequestException('A verificação em duas etapas já está ligada');

    const secret = authenticator.generateSecret(20);
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: this.encrypt(secret) } });

    const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
    // Segredo em grupos de 4 para digitar à mão, se a câmera não ajudar
    return { qrDataUrl, manualKey: secret.match(/.{1,4}/g)!.join(' ') };
  }

  // 2) Confirma com um código do app e liga; devolve os códigos de recuperação (uma vez só)
  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) throw new BadRequestException('Comece pela leitura do QR code');
    if (user.twoFactorEnabled) throw new BadRequestException('Já está ligada');
    if (!authenticator.check(code.replace(/\s/g, ''), this.decrypt(user.twoFactorSecret))) {
      throw new BadRequestException('Código incorreto. Confira a hora do celular e tente o código atual.');
    }

    const codes = Array.from({ length: 8 }, () => {
      const raw = randomBytes(5).toString('hex').toUpperCase(); // 10 caracteres
      return `${raw.slice(0, 5)}-${raw.slice(5)}`;
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorRecovery: codes.map(c => this.hashCode(c)) },
    });
    return { recoveryCodes: codes };
  }

  // Confere um código no login: TOTP do app OU um código de recuperação (gasta o código)
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) return false;
    const clean = code.trim();

    if (/^\d{6}$/.test(clean.replace(/\s/g, ''))) {
      return authenticator.check(clean.replace(/\s/g, ''), this.decrypt(user.twoFactorSecret));
    }
    const h = this.hashCode(clean);
    if (user.twoFactorRecovery.includes(h)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorRecovery: user.twoFactorRecovery.filter(x => x !== h) },
      });
      return true;
    }
    return false;
  }

  // Desliga: exige a senha E um código (do app ou de recuperação)
  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled) throw new BadRequestException('A verificação em duas etapas não está ligada');
    if (!(await argon2.verify(user.passwordHash, password).catch(() => false))) {
      throw new BadRequestException('Senha incorreta');
    }
    if (!(await this.verifyLoginCode(userId, code))) throw new BadRequestException('Código incorreto');
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecovery: [] },
    });
    return { message: 'Verificação em duas etapas desligada' };
  }
}
