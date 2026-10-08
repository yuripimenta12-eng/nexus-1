// Tira do usuário tudo que nunca pode sair do servidor (nem para o próprio dono):
// hash da senha, segredo do 2FA e hashes dos códigos de recuperação.
export function toSafeUser<T extends Record<string, any>>(user: T) {
  const { passwordHash, twoFactorSecret, twoFactorRecovery, ...safe } = user as any;
  return safe as Omit<T, 'passwordHash' | 'twoFactorSecret' | 'twoFactorRecovery'>;
}
