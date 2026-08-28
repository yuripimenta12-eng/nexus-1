import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private friends: FriendsService) {}

  @Get()
  list(@CurrentUser('id') userId: string) {
    return this.friends.listFriends(userId);
  }

  @Get('requests')
  requests(@CurrentUser('id') userId: string) {
    return this.friends.listRequests(userId);
  }

  @Post('requests')
  @Throttle({ default: { ttl: 60000, limit: 10 } }) // evita spam de pedidos
  send(@CurrentUser('id') userId: string, @Body() body: { username: string }) {
    return this.friends.sendRequest(userId, String(body?.username || '').slice(0, 64));
  }

  @Post('requests/:id/accept')
  accept(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.friends.accept(userId, id);
  }

  @Delete('requests/:id')
  removeRequest(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.friends.removeRequest(userId, id);
  }

  @Delete(':userId')
  unfriend(@CurrentUser('id') userId: string, @Param('userId') friendId: string) {
    return this.friends.unfriend(userId, friendId);
  }
}
