-- Emojis customizados + Modelos de servidor (SQL idempotente)

CREATE TABLE IF NOT EXISTS "custom_emojis" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "url" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_emojis_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "custom_emojis_serverId_fkey" FOREIGN KEY ("serverId")
        REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "custom_emojis_serverId_name_key" ON "custom_emojis"("serverId", "name");
CREATE INDEX IF NOT EXISTS "custom_emojis_serverId_idx" ON "custom_emojis"("serverId");

CREATE TABLE IF NOT EXISTS "server_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(300),
    "snapshot" TEXT NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "server_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "server_templates_code_key" ON "server_templates"("code");
CREATE INDEX IF NOT EXISTS "server_templates_serverId_idx" ON "server_templates"("serverId");
