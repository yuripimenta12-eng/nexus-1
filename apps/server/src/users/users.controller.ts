import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('@me/servers')
  getMyServers(@CurrentUser('id') userId: string) {
    return this.usersService.getServersForUser(userId);
  }

  // ATENÇÃO: rota estática deve vir ANTES de /:id
  @Get('search')
  searchUsers(
    @CurrentUser('id') currentUserId: string,
    @Query('q') query: string,
  ) {
    return this.usersService.searchUsers(query ?? '', currentUserId);
  }

  @Get(':id/profile')
  getUserProfile(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('@me/profile')
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Delete('@me/banner')
  removeBanner(@CurrentUser('id') userId: string) {
    return this.usersService.removeBanner(userId);
  }

  @Delete('@me/avatar')
  removeAvatar(@CurrentUser('id') userId: string) {
    return this.usersService.removeAvatar(userId);
  }
}
