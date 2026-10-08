import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength } from 'class-validator';
import { UsersService } from './users.service';
import { AccountDeletionService } from './account-deletion.service';

class DeleteAccountDto {
  @IsString() @MaxLength(128) password: string;
  @IsString() @MaxLength(20) confirm: string;
}
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService, private accountDeletion: AccountDeletionService) {}

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

  // Antes devolvia o usuário inteiro (com e-mail) para qualquer pessoa logada
  @Get(':id/profile')
  getUserProfile(@Param('id') id: string) {
    return this.usersService.findPublicProfile(id);
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.usersService.findPublicProfile(id);
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

  // Excluir a própria conta (LGPD). POST com corpo: alguns proxies descartam corpo em DELETE.
  @Post('@me/delete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 5 } }) // limita chute da senha
  deleteMyAccount(@CurrentUser('id') userId: string, @Body() dto: DeleteAccountDto) {
    if (dto.confirm.trim().toUpperCase() !== 'EXCLUIR') {
      throw new BadRequestException('Digite EXCLUIR para confirmar');
    }
    return this.accountDeletion.deleteMyAccount(userId, dto.password);
  }
}
