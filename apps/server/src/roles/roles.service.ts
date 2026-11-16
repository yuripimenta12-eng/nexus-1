import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemberRole } from '@prisma/client';
import { ALL_PERMISSIONS, DEFAULT_EVERYONE_PERMISSIONS, PermissionKey } from './permissions';
import { PUBLIC_USER } from '../common/public-user';

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

  async requirePermission(serverId: string, userId: string, perm: PermissionKey, message?: string) {
    if (!(await this.hasPermission(serverId, userId, perm))) {
      throw new ForbiddenException(message || 'Permissão insuficiente');
    }
  }

  // Cargo fixo antigo (OWNER/ADMIN/MODERATOR) OU a permissão do cargo
  // personalizado: quem já podia continua podendo, e o cargo passa a valer.
  async allowed(serverId: string, userId: string, perm: PermissionKey, legacy: MemberRole[] = []) {
    if (legacy.length) {
      const m = await this.prisma.serverMember.findUnique({
        where: { serverId_userId: { serverId, userId } }, select: { role: true, banned: true },
      });
      if (m && !m.banned && legacy.includes(m.role)) return true;
    }
    return this.hasPermission(serverId, userId, perm);
  }

  async requireAllowed(serverId: string, userId: string, perm: PermissionKey, legacy: MemberRole[] = [], message?: string) {
    if (!(await this.allowed(serverId, userId, perm, legacy))) {
      throw new ForbiddenException(message || 'Seu cargo não permite isso neste servidor');
    }
  }

  // Lista do que a pessoa pode fazer: cargo fixo antigo + cargos personalizados.
  // Espelha allowed()/hasPermission() (o servidor continua conferindo cada ação).
  async effectivePermissions(serverId: string, userId: string) {
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
      include: { server: { select: { ownerId: true } }, roleAssignments: { include: { role: true } } },
    });
    if (!member || member.banned) throw new ForbiddenException('Sem acesso ao servidor');
    const isOwner = member.server.ownerId === userId;
    if (isOwner || member.role === MemberRole.OWNER || member.role === MemberRole.ADMIN) {
      return { role: isOwner ? 'OWNER' : member.role, permissions: [...ALL_PERMISSIONS].filter(p => p !== 'block_watch_streams') };
    }
    const everyone = await this.ensureDefaultRole(serverId);
    const perms = new Set<string>(JSON.parse(everyone.permissions));
    for (const a of member.roleAssignments) for (const p of JSON.parse(a.role.permissions)) perms.add(p);
    if (perms.has('administrator')) {
      const blocked = perms.has('block_watch_streams');
      ALL_PERMISSIONS.forEach(p => perms.add(p));
      if (!blocked) perms.delete('block_watch_streams');
    }
    if (member.role === MemberRole.MODERATOR) {
      ['kick_members', 'ban_members', 'mute_members', 'manage_messages', 'pin_messages', 'create_invite', 'move_members']
        .forEach(p => perms.add(p));
    }
    const valid = new Set<string>(ALL_PERMISSIONS);
    return { role: member.role, permissions: [...perms].filter(p => valid.has(p)) };
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

  // Hierarquia: dono e ADMIN antigo mexem em tudo. Quem tem só "Gerenciar
  // cargos" mexe apenas em cargos ABAIXO do seu mais alto e só concede
  // permissões que ele mesmo tem (antes dava "administrador" a si mesmo).
  private async roleActor(serverId: string, userId: string) {
    await this.requirePermission(serverId, userId, 'manage_roles');
    const member = await this.prisma.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
      include: { server: { select: { ownerId: true } }, roleAssignments: { include: { role: true } } },
    });
    const privileged = !!member && (member.server.ownerId === userId || member.role === MemberRole.OWNER || member.role === MemberRole.ADMIN);
    const top = Math.max(-1, ...(member?.roleAssignments.map(a => a.role.position) ?? []));
    const { permissions } = await this.effectivePermissions(serverId, userId);
    return { privileged, top, perms: new Set<string>(permissions) };
  }

  private assertBelow(actor: { privileged: boolean; top: number }, role: { position: number; isDefault: boolean }) {
    if (actor.privileged || role.isDefault) return;
    if (role.position >= actor.top) throw new ForbiddenException('Você só pode mexer em cargos abaixo do seu cargo mais alto');
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
    const actor = await this.roleActor(serverId, userId);
    if ((await this.prisma.role.count({ where: { serverId } })) >= 100) {
      throw new BadRequestException('Limite de 100 cargos por servidor');
    }
    const top = await this.prisma.role.findFirst({
      where: { serverId, isDefault: false },
      orderBy: { position: 'desc' },
    });
    const highest = (top?.position ?? 0) + 1;
    return this.prisma.role.create({
      data: {
        serverId,
        name: (typeof name === 'string' && name ? name : 'novo cargo').slice(0, 64),
        // quem não é dono/admin cria o cargo logo abaixo do seu
        position: actor.privileged ? highest : Math.max(0, Math.min(highest, actor.top - 1)),
      },
    });
  }

  async update(
    serverId: string,
    roleId: string,
    userId: string,
    dto: { name?: string; color?: string; hoist?: boolean; mentionable?: boolean; permissions?: string[]; position?: number },
  ) {
    const actor = await this.roleActor(serverId, userId);
    const role = await this.getRole(serverId, roleId);
    this.assertBelow(actor, role);

    let permissions: string | undefined;
    if (dto.permissions !== undefined) {
      if (!Array.isArray(dto.permissions)) throw new BadRequestException('Permissões inválidas');
      const valid = new Set<string>(ALL_PERMISSIONS);
      const pedidas = dto.permissions.filter(p => typeof p === 'string' && valid.has(p));
      if (!actor.privileged) {
        const atuais = new Set<string>(JSON.parse(role.permissions));
        // Pode manter o que já existe, mas só ACRESCENTA o que ele mesmo tem
        const semPoder = pedidas.filter(p => !atuais.has(p) && (!actor.perms.has(p) || p === 'administrator'));
        if (semPoder.length) throw new ForbiddenException('Você não pode conceder permissões que não tem');
      }
      permissions = JSON.stringify(pedidas);
    }
    if (dto.position !== undefined && !(Number.isInteger(dto.position) && dto.position >= 0 && dto.position < 10000)) {
      throw new BadRequestException('Posição inválida');
    }
    if (!actor.privileged && dto.position !== undefined && dto.position >= actor.top) {
      throw new ForbiddenException('Você não pode subir um cargo acima do seu');
    }
    const color = typeof dto.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(dto.color) ? dto.color : undefined;
    if (dto.color !== undefined && dto.color !== null && !color) throw new BadRequestException('Cor inválida (use #RRGGBB)');

    return this.prisma.role.update({
      where: { id: role.id },
      data: {
        // @everyone não pode ser renomeado nem reposicionado
        name: role.isDefault || typeof dto.name !== 'string' ? undefined : dto.name.slice(0, 64),
        position: role.isDefault ? undefined : dto.position,
        color,
        hoist: typeof dto.hoist === 'boolean' ? dto.hoist : undefined,
        mentionable: typeof dto.mentionable === 'boolean' ? dto.mentionable : undefined,
        permissions,
      },
    });
  }

  async delete(serverId: string, roleId: string, userId: string) {
    const actor = await this.roleActor(serverId, userId);
    const role = await this.getRole(serverId, roleId);
    if (role.isDefault) throw new BadRequestException('O cargo @everyone não pode ser excluído');
    this.assertBelow(actor, role);
    // Sala restrita só a este cargo ficaria com a lista vazia = aberta a todos
    const salas = await this.prisma.voiceRoom.findMany({
      where: { serverId, allowedRoles: { some: { id: role.id } } },
      select: { name: true, _count: { select: { allowedRoles: true } } },
    });
    const abririam = salas.filter(x => x._count.allowedRoles === 1).map(x => x.name);
    if (abririam.length) {
      throw new BadRequestException(`Este cargo é o único que libera a sala de voz ${abririam.join(', ')}. Mude a sala antes de excluir o cargo.`);
    }
    await this.prisma.role.delete({ where: { id: role.id } });
  }

  // ── Atribuição a membros ──────────────────────────────────────
  async membersOf(serverId: string, roleId: string, userId: string) {
    await this.requireMember(serverId, userId);
    const role = await this.getRole(serverId, roleId);
    return this.prisma.roleAssignment.findMany({
      where: { roleId: role.id },
      include: { member: { include: { user: PUBLIC_USER } } },
    });
  }

  async assign(serverId: string, roleId: string, targetUserId: string, userId: string) {
    const actor = await this.roleActor(serverId, userId);
    const role = await this.getRole(serverId, roleId);
    if (role.isDefault) throw new BadRequestException('@everyone já vale para todos');
    this.assertBelow(actor, role);
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
    const actor = await this.roleActor(serverId, userId);
    const role = await this.getRole(serverId, roleId);
    this.assertBelow(actor, role);
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
