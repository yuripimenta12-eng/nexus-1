import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberRole } from '@prisma/client';
import { ALL_PERMISSIONS, DEFAULT_EVERYONE_PERMISSIONS, PermissionKey } from './permissions';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  // ── Autorização ───────────────────────────────────────────────
  // true se o usuário tem a permissão no servidor: dono e ADMIN legado
  // sempre passam; senão, união das permissões dos cargos atribuídos +
  // cargo @everyone ('administrator' concede tudo).
  async hasPermission(serverId: string, userId: string, perm: PermissionKey): Promise<boolean> {
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
      include: {
        server: { select: { ownerId: true } },
        roleAssignments: { include: { role: true } },
      },
    });
    if (!member || member.banned) return false;
    if (member.server.ownerId === userId) return true;
    if (member.role === MemberRole.OWNER || member.role === MemberRole.ADMIN) return true;

    const everyone = await this.ensureDefaultRole(serverId);
    const perms = new Set<string>(JSON.parse(everyone.permissions));
    for (const a of member.roleAssignments) {
      for (const p of JSON.parse(a.role.permissions)) perms.add(p);
    }
    return perms.has('administrator') || perms.has(perm);
  }

  async requirePermission(serverId: string, userId: string, perm: PermissionKey) {
    if (!(await this.hasPermission(serverId, userId, perm))) {
      throw new ForbiddenException('Permissão insuficiente');
    }
  }

  // Cargo @everyone: criado sob demanda no primeiro acesso
  async ensureDefaultRole(serverId: string) {
    const existing = await this.prisma.role.findFirst({
      where: { serverId, isDefault: true },
    });
    if (existing) return existing;
    return this.prisma.role.create({
      data: {
        serverId,
        name: '@everyone',
        color: '#99aab5',
        isDefault: true,
        position: -1,
        permissions: JSON.stringify(DEFAULT_EVERYONE_PERMISSIONS),
      },
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────
  async list(serverId: string, userId: string) {
    await this.requireMember(serverId, userId);
    await this.ensureDefaultRole(serverId);
    return this.prisma.role.findMany({
      where: { serverId },
      orderBy: [{ isDefault: 'desc' }, { position: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { assignments: true } } },
    });
  }

  async create(serverId: string, userId: string, name?: string) {
    await this.requirePermission(serverId, userId, 'manage_roles');
    const top = await this.prisma.role.findFirst({
      where: { serverId, isDefault: false },
      orderBy: { position: 'desc' },
    });
    return this.prisma.role.create({
      data: {
        serverId,
        name: (name || 'novo cargo').slice(0, 64),
        position: (top?.position ?? 0) + 1,
      },
    });
  }

  async update(
    serverId: string,
    roleId: string,
    userId: string,
    dto: { name?: string; color?: string; hoist?: boolean; mentionable?: boolean; permissions?: string[]; position?: number },
  ) {
    await this.requirePermission(serverId, userId, 'manage_roles');
    const role = await this.getRole(serverId, roleId);

    let permissions: string | undefined;
    if (dto.permissions) {
      const valid = new Set<string>(ALL_PERMISSIONS);
      permissions = JSON.stringify(dto.permissions.filter(p => valid.has(p)));
    }

    return this.prisma.role.update({
      where: { id: role.id },
      data: {
        // @everyone não pode ser renomeado nem reposicionado
        name: role.isDefault ? undefined : dto.name?.slice(0, 64),
        position: role.isDefault ? undefined : dto.position,
        color: dto.color?.slice(0, 16),
        hoist: dto.hoist,
        mentionable: dto.mentionable,
        permissions,
      },
    });
  }

  async delete(serverId: string, roleId: string, userId: string) {
    await this.requirePermission(serverId, userId, 'manage_roles');
    const role = await this.getRole(serverId, roleId);
    if (role.isDefault) throw new BadRequestException('O cargo @everyone não pode ser excluído');
    await this.prisma.role.delete({ where: { id: role.id } });
  }

  // ── Atribuição a membros ──────────────────────────────────────
  async membersOf(serverId: string, roleId: string, userId: string) {
    await this.requireMember(serverId, userId);
    const role = await this.getRole(serverId, roleId);
    return this.prisma.roleAssignment.findMany({
      where: { roleId: role.id },
      include: { member: { include: { user: { include: { profile: true } } } } },
    });
  }

  async assign(serverId: string, roleId: string, targetUserId: string, userId: string) {
    await this.requirePermission(serverId, userId, 'manage_roles');
    const role = await this.getRole(serverId, roleId);
    if (role.isDefault) throw new BadRequestException('@everyone já vale para todos');
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');
    await this.prisma.roleAssignment.upsert({
      where: { roleId_memberId: { roleId: role.id, memberId: member.id } },
      update: {},
      create: { roleId: role.id, memberId: member.id },
    });
  }

  async unassign(serverId: string, roleId: string, targetUserId: string, userId: string) {
    await this.requirePermission(serverId, userId, 'manage_roles');
    const role = await this.getRole(serverId, roleId);
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId: targetUserId } },
    });
    if (!member) throw new NotFoundException('Membro não encontrado');
    await this.prisma.roleAssignment.deleteMany({
      where: { roleId: role.id, memberId: member.id },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────
  private async getRole(serverId: string, roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.serverId !== serverId) throw new NotFoundException('Cargo não encontrado');
    return role;
  }

  private async requireMember(serverId: string, userId: string) {
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
    });
    if (!member || member.banned) throw new ForbiddenException('Sem acesso ao servidor');
    return member;
  }
}
