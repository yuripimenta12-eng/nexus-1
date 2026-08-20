import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [
          PassportModule,
          UsersModule,
          JwtModule.registerAsync({
                  useFactory: (config: ConfigService) => ({
                            secret: config.get<string>('JWT_ACCESS_SECRET'),
                            signOptions: { expiresIn: config.get<string>('JWT_ACCESS_EXPIRES', '15m') },
                  }),
                  inject: [ConfigService],
          }),
        ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, LocalStrategy, JwtRefreshStrategy],
    exports: [AuthService, JwtModule],
})
  export class AuthModule {}
