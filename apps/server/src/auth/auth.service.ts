import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private redis: RedisService,
    private mailService: MailService,
  ) {}

  // ── Registro ─────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // Verifica duplicatas
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    if (existing) {
      if (existing.email === dto.email) throw new ConflictException('E-mail já cadastrado');
      throw new ConflictException('Nome de usuário já em uso');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        username: dto.username.toLowerCase(),
        passwordHash,
        profile: {
          create: {
            displayName: dto.displayName || dto.username,
          },
        },
      },
      include: { profile: true },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ── Login ─────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { profile: true },
    });

    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    if (user.isSuspended) throw new UnauthorizedException('Conta suspensa');

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('Credenciais inválidas');

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ── Refresh de token ─────────────────────────────────────────
  async refreshTokens(userId: string, refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    });

    if (!session || session.userId !== userId || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Sessão inválida');
    }

    const isBlacklisted = await this.redis.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) throw new UnauthorizedException('Token revogado');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || user.isSuspended) throw new UnauthorizedException();

    // Rotaciona o refresh token (revoga o antigo)
    await this.redis.blacklistToken(refreshToken, 60 * 60 * 24 * 30);
    await this.prisma.session.delete({ where: { refreshToken } });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  // ── Logout ───────────────────────────────────────────────────
  async logout(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
    });

    if (session) {
      await this.redis.blacklistToken(refreshToken, 60 * 60 * 24 * 30);
      await this.prisma.session.delete({ where: { refreshToken } });
    }
  }

  // ── Recuperação de senha ──────────────────────────────────────
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Responde da mesma forma independente se o e-mail existe (evita enumeração)
    if (!user) return { message: 'Se o e-mail existir, você receberá um link.' };

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

    await this.prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt },
    });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    await this.mailService.sendPasswordReset(
      user.email,
      `${appUrl}/auth/reset-password?token=${token}`,
    );

    return { message: 'Se o e-mail existir, você receberá um link.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      // Invalida todas as sessões existentes (segurança)
      this.prisma.session.deleteMany({ where: { userId: reset.userId } }),
    ]);

    return { message: 'Senha alterada com sucesso' };
  }

  // ── Validação (passport-local) ────────────────────────────────
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) return null;

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) return null;

    return user;
  }

  // ── Helpers ───────────────────────────────────────────────────
  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES', '30d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 dias

    await this.prisma.session.create({
      data: { userId, refreshToken, expiresAt },
    });
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...safe } = user;
    return safe;
  }
}
