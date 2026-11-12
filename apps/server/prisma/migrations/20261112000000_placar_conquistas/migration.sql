-- Placar da call por servidor e conquistas
CREATE TABLE "call_stats" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "segundosCall" INTEGER NOT NULL DEFAULT 0,
    "segundosFalando" INTEGER NOT NULL DEFAULT 0,
    "segundosCamera" INTEGER NOT NULL DEFAULT 0,
    "musicas" INTEGER NOT NULL DEFAULT 0,
    "lives" INTEGER NOT NULL DEFAULT 0,
    "ultimoBatimento" TIMESTAMP(3),

    CONSTRAINT "call_stats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conquistas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chave" VARCHAR(32) NOT NULL,
    "desbloqueadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conquistas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "call_stats_serverId_userId_key" ON "call_stats"("serverId", "userId");
CREATE INDEX "call_stats_userId_idx" ON "call_stats"("userId");
CREATE UNIQUE INDEX "conquistas_userId_chave_key" ON "conquistas"("userId", "chave");

ALTER TABLE "call_stats" ADD CONSTRAINT "call_stats_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "servers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_stats" ADD CONSTRAINT "call_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conquistas" ADD CONSTRAINT "conquistas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
