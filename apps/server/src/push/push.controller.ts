import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PushService } from './push.service';

class PushKeysDto {
  @IsString() @MaxLength(200) p256dh: string;
  @IsString() @MaxLength(100) auth: string;
}

class SubscribeDto {
  @IsUrl({ protocols: ['https'], require_tld: true }) @MaxLength(1000) endpoint: string;
  @ValidateNested() @Type(() => PushKeysDto) keys: PushKeysDto;
}

class UnsubscribeDto {
  @IsString() @MaxLength(1000) endpoint: string;
}

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private push: PushService) {}

  @Get('public-key')
  async publicKey() {
    return { publicKey: await this.push.getPublicKey() };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(@CurrentUser('id') userId: string, @Body() dto: SubscribeDto) {
    await this.push.subscribe(userId, dto);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(@CurrentUser('id') userId: string, @Body() dto: UnsubscribeDto) {
    await this.push.unsubscribe(userId, dto.endpoint);
  }
}
