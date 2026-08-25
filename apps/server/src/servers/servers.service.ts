import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { RolesService } from '../roles/roles.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { MemberRole } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class ServersService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
    private rolesService: RolesService,
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
            // permissions incluído para o cliente avaliar RESTRIÇÕES
            // (ex.: block_watch_streams) do próprio usuário
            role: { select: { id: true, name: true, color: true, hoist: true, position: true, permissions: true } },
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

  // ── Emojis customizados ───────────────────────────────────────
  async listEmojis(serverId: string, userId: string) {
    const member = await this.checkMembership(serverId, userId);
    if (!member || member.banned) throw new ForbiddenException('Sem acesso ao servidor');
    return this.prisma.customEmoji.findMany({
      where: { serverId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteEmoji(serverId: string, emojiId: string, userId: string) {
    await this.rolesService.requirePermission(serverId, userId, 'manage_expressions');
    const emoji = await this.prisma.customEmoji.findUnique({ where: { id: emojiId } });
    if (!emoji || emoji.serverId !== serverId) throw new NotFoundException('Emoji não encontrado');
    await this.prisma.customEmoji.delete({ where: { id: emojiId } });
  }

  // ── Modelo do servidor (snapshot de canais/cargos/config) ─────
  async createTemplate(serverId: string, userId: string, title: string, description?: string) {
    await this.rolesService.requirePermission(serverId, userId, 'manage_server');

    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: { orderBy: { position: 'asc' } },
        voiceRooms: { orderBy: { position: 'asc' } },
        roles: true,
      },
    });
    if (!server) throw new NotFoundException();

    const snapshot = JSON.stringify({
      description: server.description,
      tag: server.tag,
      isPublic: server.isPublic,
      maxMembers: server.maxMembers,
      channels: server.channels.map(c => ({ name: c.name, type: c.type, position: c.position })),
      voiceRooms: server.voiceRooms.map(v => ({ name: v.name, position: v.position })),
      roles: server.roles.map(r => ({
        name: r.name, color: r.color, hoist: r.hoist, mentionable: r.mentionable,
        permissions: r.permissions, position: r.position, isDefault: r.isDefault,
      })),
    });

    const code = randomBytes(8).toString('base64url').slice(0, 10);
    return this.prisma.serverTemplate.create({
      data: { code, serverId, title: title.slice(0, 100), description: description?.slice(0, 300), snapshot },
    });
  }

  async getTemplate(code: string) {
    const tpl = await this.prisma.serverTemplate.findUnique({ where: { code } });
    if (!tpl) throw new NotFoundException('Modelo não encontrado');
    const snap = JSON.parse(tpl.snapshot);
    return {
      code: tpl.code,
      title: tpl.title,
      description: tpl.description,
      uses: tpl.uses,
      channels: snap.channels?.length ?? 0,
      voiceRooms: snap.voiceRooms?.length ?? 0,
      roles: snap.roles?.filter((r: any) => !r.isDefault).length ?? 0,
    };
  }

  async useTemplate(code: string, userId: string, name?: string) {
    const tpl = await this.prisma.serverTemplate.findUnique({ where: { code } });
    if (!tpl) throw new NotFoundException('Modelo não encontrado');
    const snap = JSON.parse(tpl.snapshot);

    const server = await this.prisma.server.create({
      data: {
        name: (name || tpl.title).slice(0, 100),
        description: snap.description ?? null,
        tag: snap.tag ?? null,
        isPublic: !!snap.isPublic,
        maxMembers: snap.maxMembers ?? 100,
        ownerId: userId,
        members: { create: { userId, role: MemberRole.OWNER } },
        channels: {
          create: (snap.channels?.length ? snap.channels : [{ name: 'geral', type: 'TEXT', position: 0 }])
            .map((c: any) => ({ name: c.name, type: c.type, position: c.position })),
        },
        voiceRooms: {
          create: (snap.voiceRooms?.length ? snap.voiceRooms : [{ name: 'Geral', position: 0 }])
            .map((v: any, i: number) => ({
              name: v.name,
              position: v.position ?? i,
              livekitRoom: `tpl-${Date.now()}-${i}`,
            })),
        },
        roles: {
          create: (snap.roles || []).map((r: any) => ({
            name: r.name, color: r.color, hoist: !!r.hoist, mentionable: !!r.mentionable,
            permissions: typeof r.permissions === 'string' ? r.permissions : '[]',
            position: r.position ?? 0, isDefault: !!r.isDefault,
          })),
        },
      },
      include: { channels: true, voiceRooms: true },
    });

    await this.prisma.serverTemplate.update({
      where: { code },
      data: { uses: { increment: 1 } },
    });

    return server;
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
