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
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { toSafeUser } from '../common/safe-user';
import { TwoFactorService } from './two-factor.service';
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
    private twoFactor: TwoFactorService,
  ) {}

  // ── Registro ─────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // Porta de entrada: com REGISTRATION_CODE definido, só cria conta quem
    // apresentar o código secreto OU um convite de servidor válido (o fluxo
    // de link de convite preenche isso automaticamente no front).
    // trim + remoção de aspas protege contra valores colados com espaço/aspas no painel
    const requiredCode = (this.config.get<string>('REGISTRATION_CODE', '') || '')
      .trim()
      .replace(/^["']+|["']+$/g, '');
    if (requiredCode) {
      const code = (dto.inviteCode || '').trim();
      let autorizado = code.length > 0 && code === requiredCode;
      if (!autorizado && code) {
        const invite = await this.prisma.invite.findUnique({ where: { code } });
        autorizado = !!invite &&
          (!invite.expiresAt || invite.expiresAt > new Date()) &&
          (invite.maxUses == null || invite.uses < invite.maxUses);
      }
      if (!autorizado) {
        throw new UnauthorizedException(
          'Código de convite inválido. Peça um convite a quem já usa o Nexus.',
        );
      }
    }

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

    // Conta nova começa sem confirmação: manda o link (sem atrasar o cadastro)
    void this.sendVerification(user.id).catch(() => { /* reenvio disponível no app */ });

    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ── Confirmação de e-mail ─────────────────────────────────────
  async sendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user || user.isVerified) return { message: 'E-mail já confirmado' };

    // Só o link mais recente vale
    await this.prisma.emailVerification.deleteMany({ where: { userId, usedAt: null } });
    const token = uuidv4() + uuidv4().replace(/-/g, '');
    await this.prisma.emailVerification.create({
      data: { userId, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    await this.mailService.sendEmailVerification(
      user.email,
      `${appUrl}/auth/verify-email?token=${token}`,
      user.profile?.displayName || user.username,
    );
    return { message: 'Enviamos um novo link para o seu e-mail' };
  }

  async verifyEmail(token: string) {
    const v = await this.prisma.emailVerification.findUnique({ where: { token } });
    if (!v || v.usedAt || v.expiresAt < new Date()) {
      throw new BadRequestException('Link inválido ou expirado. Peça um novo no Nexus.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: v.userId }, data: { isVerified: true } }),
      this.prisma.emailVerification.update({ where: { id: v.id }, data: { usedAt: new Date() } }),
    ]);
    return { message: 'E-mail confirmado' };
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

    // 2FA ligado: a senha certa vira só um "bilhete" de 5 min; a sessão sai
    // depois do código do app autenticador (loginWithTwoFactor)
    if (user.twoFactorEnabled) {
      const ticket = await this.jwtService.signAsync(
        { sub: user.id, purpose: '2fa' },
        { secret: this.twoFactorTicketSecret(), expiresIn: '5m' },
      );
      return { twoFactorRequired: true as const, ticket };
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return { user: this.sanitizeUser(user), ...tokens };
  }

  async loginWithTwoFactor(ticket: string, code: string) {
    let userId: string;
    try {
      const payload = await this.jwtService.verifyAsync(ticket, { secret: this.twoFactorTicketSecret() });
      if (payload.purpose !== '2fa') throw new Error();
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('O tempo para digitar o código acabou. Entre de novo com a senha.');
    }
    if (!(await this.twoFactor.verifyLoginCode(userId, code))) {
      throw new UnauthorizedException('Código incorreto');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user || user.isSuspended) throw new UnauthorizedException('Conta suspensa');

    const tokens = await this.generateTokens(user.id, user.email);
    await this.saveRefreshToken(user.id, tokens.refreshToken);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  private twoFactorTicketSecret() {
    return `${this.config.get<string>('JWT_ACCESS_SECRET')}:2fa-ticket`;
  }

  // ── Refresh de token ─────────────────────────────────────────
  async refreshTokens(userId: string, refreshToken: string) {
    // Duas abas renovando ao mesmo tempo: a primeira rotaciona, a segunda
    // chegava com o token já revogado e DERRUBAVA a sessão ("Token revogado").
    // Guardamos o resultado da rotação por 60s e devolvemos o MESMO par
    // para a aba atrasada — refresh idempotente, sessão nunca cai por corrida.
    const rotKey = `refresh-rotated:${createHash('sha256').update(refreshToken).digest('hex')}`;
    const jaRotacionado = await this.redis.getTemp(rotKey).catch(() => null);
    if (jaRotacionado) {
      return JSON.parse(jaRotacionado) as { accessToken: string; refreshToken: string };
    }

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

    // Janela de graça: abas atrasadas recebem o mesmo par recém-gerado
    await this.redis.setTemp(rotKey, JSON.stringify(tokens), 60).catch(() => { /* opcional */ });

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
    // Não bloqueia a resposta: o envio tem tempo limite e loga falhas por conta própria.
    void this.mailService.sendPasswordReset(
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

  // ── Troca de senha (usuário logado) ───────────────────────────
  // Exige a senha atual. Mantém a sessão deste aparelho e encerra as demais
  // (se alguém tinha a senha antiga, perde o acesso).
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentRefreshToken?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new BadRequestException('Senha atual incorreta');

    if (await argon2.verify(user.passwordHash, newPassword)) {
      throw new BadRequestException('A nova senha precisa ser diferente da atual');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.session.deleteMany({
        where: {
          userId,
          ...(currentRefreshToken ? { NOT: { refreshToken: currentRefreshToken } } : {}),
        },
      }),
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
      // jti aleatório: dois logins no mesmo segundo geravam o MESMO refresh
      // token (mesmo payload + mesmo iat) e o 2º falhava na unicidade do banco
      this.jwtService.signAsync({ ...payload, jti: uuidv4() }, {
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
    return toSafeUser(user);
  }
}
