// Chaves de permissão dos cargos (espelhadas no frontend, roles-manager.tsx).
// Só entram aqui permissões que o backend realmente aplica.
export const ALL_PERMISSIONS = [
  // Gerais do servidor
  'manage_channels',
  'manage_roles',
  'create_expressions',
  'manage_expressions',
  'manage_server',
  // Membros
  'create_invite',
  'change_nickname',
  'kick_members',
  'ban_members',
  // Canal de texto
  'send_messages',
  'attach_files',
  'add_reactions',
  'send_voice_messages',
  'manage_messages',
  'pin_messages',
  // Voz
  'speak',
  'video',
  'mute_members',
  'move_members',
  // Restrições (permissões NEGATIVAS: ter a chave num cargo BLOQUEIA a ação)
  'block_watch_streams',
  // Avançado
  'administrator',
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

// Permissões padrão do cargo @everyone de um servidor novo
// (convite fica com a equipe; o dono libera no cargo se quiser)
export const DEFAULT_EVERYONE_PERMISSIONS: PermissionKey[] = [
  'change_nickname',
  'send_messages',
  'attach_files',
  'add_reactions',
  'send_voice_messages',
  'speak',
  'video',
];
