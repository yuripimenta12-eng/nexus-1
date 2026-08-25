-- Cargos personalizados (estilo Discord)
-- SQL idempotente: o banco de producao foi criado via `db push` (sem
-- historico de migrations); esta migration aplica apenas o delta e pode
-- rodar com seguranca mesmo se parte ja existir.

ALTER TABLE "servers" ADD COLUMN IF NOT EXISTS "tag" VARCHAR(32);

CREATE TABLE IF NOT EXISTS "roles" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "color" VARCHAR(16) NOT NULL DEFAULT '#99aab5',
    "hoist" BOOLEAN NOT NULL DEFAULT false,
    "mentionable" BOOLEAN NOT NULL DEFAULT false,
    "permissions" VARCHAR(4000) NOT NULL DEFAULT '[]',
    "position" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "roles_serverId_fkey" FOREIGN KEY ("serverId")
        REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "roles_serverId_idx" ON "roles"("serverId");

CREATE TABLE IF NOT EXISTS "role_assignments" (
    "roleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("roleId", "memberId"),
    CONSTRAINT "role_assignments_roleId_fkey" FOREIGN KEY ("roleId")
        REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_assignments_memberId_fkey" FOREIGN KEY ("memberId")
        REFERENCES "server_members"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "role_assignments_memberId_idx" ON "role_assignments"("memberId");
