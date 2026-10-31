import { Prisma } from '@prisma/client';

// O que pode ir para o navegador sobre OUTRA pessoa (autor de mensagem, membro,
// quem reagiu…). "include: { profile: true }" num relacionamento de usuário
// devolve TODOS os campos dele — e-mail, hash da senha, segredo do 2FA —, então
// use sempre isto no lugar.
export const PUBLIC_USER = {
  select: { id: true, username: true, createdAt: true, isBetaTester: true, profile: true },
} satisfies Prisma.UserDefaultArgs;

// Painel do dono: mesmo assim, nunca hash da senha nem 2FA
export const ADMIN_USER = {
  select: { id: true, username: true, email: true, createdAt: true, isSuspended: true, isAdmin: true, isBetaTester: true, profile: true },
} satisfies Prisma.UserDefaultArgs;
