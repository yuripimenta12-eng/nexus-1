import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateChannelDto } from './dto/create-channel.dto';

@Controller('servers/:serverId/channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Post()
  create(
    @Param('serverId') serverId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channelsService.create(serverId, userId, dto);
  }

  @Get(':channelId')
  findOne(@Param('channelId') channelId: string, @CurrentUser('id') userId: string) {
    return this.channelsService.findById(channelId, userId);
  }

  @Delete(':channelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('channelId') channelId: string, @CurrentUser('id') userId: string) {
    return this.channelsService.delete(channelId, userId);
  }
}
