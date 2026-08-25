// Chaves de permissão dos cargos (espelhadas no frontend).
// A UI exibe todas; o backend aplica as que têm efeito no Nexus hoje.
export const ALL_PERMISSIONS = [
  // Gerais do servidor
  'view_channels',
  'manage_channels',
  'manage_roles',
  'create_expressions',
  'manage_expressions',
  'manage_webhooks',
  'manage_server',
  // Assinatura / membros
  'create_invite',
  'change_nickname',
  'manage_nicknames',
  'kick_members',
  'ban_members',
  'timeout_members',
  // Canal de texto
  'send_messages',
  'send_messages_in_threads',
  'create_public_threads',
  'create_private_threads',
  'embed_links',
  'attach_files',
  'add_reactions',
  'use_external_emojis',
  'use_external_stickers',
  'mention_everyone',
  'manage_messages',
  'pin_messages',
  'bypass_slowmode',
  'manage_threads',
  'read_message_history',
  'send_tts',
  'send_voice_messages',
  'create_polls',
  // Voz
  'speak',
  'video',
  'use_soundboard',
  'use_external_sounds',
  'use_vad',
  'priority_speaker',
  'mute_members',
  'deafen_members',
  'move_members',
  'set_voice_status',
  // Restrições (permissões NEGATIVAS: ter a chave num cargo BLOQUEIA a ação)
  'block_watch_streams',
  // Avançado
  'administrator',
] as const;

export type PermissionKey = (typeof ALL_PERMISSIONS)[number];

// Permissões padrão do cargo @everyone de um servidor novo
export const DEFAULT_EVERYONE_PERMISSIONS: PermissionKey[] = [
  'view_channels',
  'create_invite',
  'change_nickname',
  'send_messages',
  'embed_links',
  'attach_files',
  'add_reactions',
  'read_message_history',
  'send_voice_messages',
  'speak',
  'video',
  'use_vad',
];
