// Regra de acesso a salas de voz restritas por cargo.
// Compartilhada entre VoiceService (entrar/presença) e ServersService (listagem),
// que não podem se injetar mutuamente.
//
//  • sem cargos configurados → sala aberta a todos os membros
//  • dono do servidor, OWNER e ADMIN → sempre entram
//  • senão, precisa ter pelo menos um dos cargos permitidos (ou "administrator")

export interface RoomAccessInfo { allowedRoles: { id: string }[] }
export interface MemberAccessInfo {
  role: string;
  userId: string;
  roleAssignments: { role: { id: string; permissions: string } }[];
}

export function canAccessVoiceRoom(room: RoomAccessInfo, member: MemberAccessInfo, ownerId: string): boolean {
  if (!room.allowedRoles?.length) return true;
  if (member.userId === ownerId || member.role === 'OWNER' || member.role === 'ADMIN') return true;
  const allowed = new Set(room.allowedRoles.map(r => r.id));
  for (const a of member.roleAssignments) {
    if (allowed.has(a.role.id)) return true;
    try { if (JSON.parse(a.role.permissions).includes('administrator')) return true; } catch { /* json inválido */ }
  }
  return false;
}

// Formato devolvido ao cliente: cargos como lista de ids (allowedRoleIds)
export function toPublicVoiceRoom<T extends { allowedRoles?: { id: string }[] }>(room: T) {
  const { allowedRoles, ...rest } = room as any;
  return { ...rest, allowedRoleIds: (allowedRoles || []).map((r: { id: string }) => r.id) };
}

// Include padrão do Prisma para carregar um membro com os cargos
export const MEMBER_WITH_ROLES_INCLUDE = {
  roleAssignments: { include: { role: { select: { id: true, permissions: true } } } },
} as const;
