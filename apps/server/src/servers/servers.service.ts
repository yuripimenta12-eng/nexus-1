import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { MemberRole } from '@prisma/client';

@Injectable()
export class ServersService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
  ) {}

  async create(userId: string, dto: CreateServerDto) {
    const server = await this.prisma.server.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId: userId,
        // Cria canais padrão
        channels: {
          create: [
            { name: 'geral', type: 'TEXT', position: 0 },
            { name: 'anúncios', type: 'ANNOUNCEMENT', position: 1 },
          ],
        },
        voiceRooms: {
          create: [
            { name: 'Geral', position: 0, livekitRoom: `server-${Date.now()}-voice-1` },
          ],
        },
        // Adiciona o criador como OWNER
        members: {
          create: { userId, role: MemberRole.OWNER },
        },
      },
      include: {
        channels: { orderBy: { position: 'asc' } },
        voiceRooms: { orderBy: { position: 'asc' } },
        members: { include: { user: { include: { profile: true } } } },
      },
    });

    return server;
  }

  async findById(serverId: string, userId: string) {
    const member = await this.checkMembership(serverId, userId);
    if (!member) throw new ForbiddenException('Você não é membro deste servidor');

    return this.prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: { orderBy: { position: 'asc' } },
        voiceRooms: { orderBy: { position: 'asc' } },
        members: {
          where: { banned: false },
          include: { user: { include: { profile: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        _count: { select: { members: true } },
      },
    });
  }

  async update(serverId: string, userId: string, dto: UpdateServerDto) {
    await this.requireRole(serverId, userId, [MemberRole.OWNER, MemberRole.ADMIN]);

    return this.prisma.server.update({
      where: { id: serverId },
      data: {
        name: dto.name,
        description: dto.description,
        tag: dto.tag,
        isPublic: dto.isPublic,
        maxMembers: dto.maxMembers,
      },
    });
  }

  // ── Apelido próprio no servidor ("Editar perfil por servidor") ─
  async setMyNickname(serverId: string, userId: string, nickname: string | null) {
    const member = await this.checkMembership(serverId, userId);
    if (!member) throw new ForbiddenException('Você não é membro deste servidor');
    return this.prisma.serverMember.update({
      where: { serverId_userId: { serverId, userId } },
      data: { nickname: nickname ? nickname.slice(0, 64) : null },
      select: { nickname: true },
    });
  }

  // ── Lista de banidos (para o painel Banimentos) ───────────────
  async getBans(serverId: string, userId: string) {
    await this.requireRole(serverId, userId, [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MODERATOR]);
    return this.prisma.serverMember.findMany({
      where: { serverId, banned: true },
      select: {
        userId: true,
        bannedAt: true,
        bannedReason: true,
        user: { select: { id: true, username: true, profile: { select: { displayName: true, avatarUrl: true } } } },
      },
      orderBy: { bannedAt: 'desc' },
    });
  }

  async delete(serverId: string, userId: string) {
    await this.requireRole(serverId, userId, [MemberRole.OWNER]);

    return this.prisma.server.delete({ where: { id: serverId } });
  }

  async leave(serverId: string, userId: string) {
    const member = await this.checkMembership(serverId, userId);
    if (!member) throw new NotFoundException('Você não é membro deste servidor');
    if (member.role === MemberRole.OWNER) {
      throw new ForbiddenException('O dono não pode sair. Transfira a propriedade primeiro.');
    }

    await this.prisma.serverMember.delete({
      where: { serverId_userId: { serverId, userId } },
    });
  }

  async getMembers(serverId: string, userId: string) {
    await this.checkMembership(serverId, userId);

    const members = await this.prisma.serverMember.findMany({
      where: { serverId, banned: false },
      include: {
        user: { include: { profile: true } },
        // Cargos personalizados: o front agrupa por cargo com hoist
        // ("exibir separadamente") e pinta o nome com a cor do cargo
        // mais alto — comportamento igual ao Discord.
        roleAssignments: {
          include: {
            role: { select: { id: true, name: true, color: true, hoist: true, position: true } },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    // Anexa o status de presença (ONLINE/OFFLINE) de cada membro, lido do Redis.
    // O front usa isso para separar "Online" de "Offline" na lista lateral e
    // atualiza em tempo real via eventos user:online / user:offline do socket.
    const statuses = await this.presence.getBulkStatus(
      members.map((m) => m.userId),
    );

    return members.map(({ roleAssignments, ...m }) => ({
      ...m,
      status: statuses[m.userId] ?? 'OFFLINE',
      roles: roleAssignments
        .map((a) => a.role)
        .sort((a, b) => b.position - a.position), // mais alto primeiro
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────
  async checkMembership(serverId: string, userId: string) {
    return this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
    });
  }

  async requireRole(serverId: string, userId: string, allowedRoles: MemberRole[]) {
    const member = await this.checkMembership(serverId, userId);
    if (!member || !allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Permissão insuficiente');
    }
    return member;
  }
}
