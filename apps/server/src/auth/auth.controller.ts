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
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
    this.setRefreshCookie(res, result.refreshToken);
    // Também retorna o refreshToken no body para clientes cross-origin
    return { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken };
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
