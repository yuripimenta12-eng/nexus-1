-- CreateTable
CREATE TABLE "depoimentos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "texto" VARCHAR(280) NOT NULL,
    "nota" INTEGER NOT NULL DEFAULT 5,
    "aprovado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depoimentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "depoimentos_userId_key" ON "depoimentos"("userId");

-- CreateIndex
CREATE INDEX "depoimentos_aprovado_atualizadoEm_idx" ON "depoimentos"("aprovado", "atualizadoEm");

-- AddForeignKey
ALTER TABLE "depoimentos" ADD CONSTRAINT "depoimentos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

