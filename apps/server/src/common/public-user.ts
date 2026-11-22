import { Prisma } from '@prisma/client';

// O que pode ir para o navegador sobre OUTRA pessoa (autor de mensagem, membro,
// quem reagiu…). "include: { profile: true }" num relacionamento de usuário
// devolve TODOS os campos dele — e-mail, hash da senha, segredo do 2FA —, então
// use sempre isto no lugar.
// Perfil que vai junto (sem jogos/conexões: só no perfil completo, para não
// pesar cada mensagem e cada lista de membros)
export const PUBLIC_PROFILE = {
  select: {
    id: true, userId: true, displayName: true, avatarUrl: true, bannerUrl: true, bannerColor: true, bio: true,
    status: true, customStatus: true, moldura: true, icone: true, placa: true, somEntrada: true, efeitoPerfil: true,
    receberZoeiras: true, escudoAte: true, corNome: true, procurandoDuo: true, updatedAt: true,
  },
} satisfies Prisma.ProfileDefaultArgs;

export const PUBLIC_USER = {
  select: { id: true, username: true, createdAt: true, isBetaTester: true, plano: true, profile: PUBLIC_PROFILE },
} satisfies Prisma.UserDefaultArgs;

// Painel do dono: mesmo assim, nunca hash da senha nem 2FA
export const ADMIN_USER = {
  select: { id: true, username: true, email: true, createdAt: true, isSuspended: true, isAdmin: true, isBetaTester: true, isStaff: true, profile: true },
} satisfies Prisma.UserDefaultArgs;
