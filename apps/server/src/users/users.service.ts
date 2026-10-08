import { Injectable, NotFoundException } from '@nestjs/common';
import { toSafeUser } from '../common/safe-user';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toSafeUser(user);
  }

  // Perfil de OUTRA pessoa: só o que é público (sem e-mail, admin, suspensão etc.)
  async findPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true, avatarUrl: true, bannerUrl: true, bannerColor: true,
            bio: true, status: true, customStatus: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return toSafeUser(user);
  }

  async searchUsers(query: string, excludeUserId: string) {
    if (!query || query.trim().length < 2) return [];

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        OR: [
          { username: { contains: query.toLowerCase(), mode: 'insensitive' } },
          { profile: { displayName: { contains: query, mode: 'insensitive' } } },
        ],
      },
      take: 20,
      include: { profile: { select: { displayName: true, avatarUrl: true, status: true } } },
    });

    return users.map(u => toSafeUser(u));
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
        customStatus: dto.customStatus,
        // Escolher uma cor de banner substitui a imagem enviada
        ...(dto.bannerColor !== undefined
          ? { bannerColor: dto.bannerColor, bannerUrl: null }
          : {}),
      },
    });
    return profile;
  }

  async removeBanner(userId: string) {
    return this.prisma.profile.update({
      where: { userId },
      data: { bannerUrl: null, bannerColor: null },
    });
  }

  async removeAvatar(userId: string) {
    return this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl: null },
    });
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return this.prisma.profile.update({
      where: { userId },
      data: { avatarUrl },
    });
  }

  async updateStatus(userId: string, status: UserStatus) {
    return this.prisma.profile.update({
      where: { userId },
      data: { status },
    });
  }

  async getServersForUser(userId: string) {
    return this.prisma.serverMember.findMany({
      where: { userId, banned: false },
      include: {
        server: {
          include: {
            channels: { orderBy: { position: 'asc' }, take: 1 },
            voiceRooms: { orderBy: { position: 'asc' } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }
}
