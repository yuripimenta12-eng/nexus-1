import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { TwoFactorCodeDto, TwoFactorLoginDto, TwoFactorDisableDto } from './dto/two-factor.dto';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private twoFactor: TwoFactorService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 3 }, hourly: { ttl: 3600000, limit: 10 } }) // 3/min e 10/hora por IP
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(res, result.refreshToken);
    // Também retorna o refreshToken no body para clientes cross-origin
    return { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // 10 tentativas por minuto
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    if ('twoFactorRequired' in result) return result; // falta o código do app autenticador
    this.setRefreshCookie(res, result.refreshToken);
    // Também retorna o refreshToken no body para clientes cross-origin
    return { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken };
  }

  // Segunda etapa do login com 2FA: bilhete (da senha) + código do app
  @Post('login/2fa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 6 } }) // impede chutar os 6 dígitos
  async loginTwoFactor(@Body() dto: TwoFactorLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginWithTwoFactor(dto.ticket, dto.code);
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken };
  }

  // ── Configurar 2FA (usuário logado) ──
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  twoFactorSetup(@CurrentUser('id') userId: string) {
    return this.twoFactor.setup(userId);
  }

  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 6 } })
  twoFactorEnable(@CurrentUser('id') userId: string, @Body() dto: TwoFactorCodeDto) {
    return this.twoFactor.enable(userId, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  twoFactorDisable(@CurrentUser('id') userId: string, @Body() dto: TwoFactorDisableDto) {
    return this.twoFactor.disable(userId, dto.password, dto.code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = (req.user as any).sub;
    const refreshToken = req.cookies['nexus_refresh'] || (req.user as any).refreshToken;
    const tokens = await this.authService.refreshTokens(userId, refreshToken);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['nexus_refresh'];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie('nexus_refresh');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: any) {
    return user;
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // limita brute-force do token de reset
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 600000, limit: 3 } }) // 3 reenvios a cada 10 min
  resendVerification(@CurrentUser('id') userId: string) {
    return this.authService.sendVerification(userId);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // limita chute da senha atual
  async changePassword(
    @CurrentUser() user: any,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      req.cookies['nexus_refresh'],
    );
  }

  // ── Cookie HTTP-only para o refresh token ─────────────────────
  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie('nexus_refresh', refreshToken, {
      httpOnly: true,
      secure: true,           // sempre secure para suportar sameSite: 'none'
      sameSite: 'none',       // permite cross-origin (Vercel ↔ Railway)
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias
      path: '/api/auth',
    });
  }
}
