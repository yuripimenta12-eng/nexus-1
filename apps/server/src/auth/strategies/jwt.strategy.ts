import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';

const LIBERADO_SEM_CONFIRMAR = /^\/api\/(auth\/(me|resend-verification|change-password)|users\/@me\/delete)\/?$/;
import { toSafeUser } from '../../common/safe-user';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { profile: true },
    });

    if (!user || user.isSuspended) throw new UnauthorizedException();
    // E-mail não confirmado: só o necessário para confirmar ou sair
    // (antes a trava existia só no site e a API liberava tudo)
    if (!user.isVerified && !LIBERADO_SEM_CONFIRMAR.test(req.path || '')) {
      throw new ForbiddenException('Confirme seu e-mail para continuar');
    }

    return toSafeUser(user);
  }
}
