-- CreateTable
CREATE TABLE "carteiras" (
    "userId" TEXT NOT NULL,
    "saldo" INTEGER NOT NULL DEFAULT 0,
    "totalGanho" INTEGER NOT NULL DEFAULT 0,
    "presencaDia" INTEGER NOT NULL DEFAULT 0,
    "presencaData" VARCHAR(10),
    "presencaMelhor" INTEGER NOT NULL DEFAULT 0,
    "roletaData" VARCHAR(10),
    "roletaGiros" INTEGER NOT NULL DEFAULT 0,
    "unidosVitorias" INTEGER NOT NULL DEFAULT 0,
    "unidosData" VARCHAR(10),
    "unidosHoje" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carteiras_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "nex_movimentos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "motivo" VARCHAR(48) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nex_movimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missao_resgates" (
    "userId" TEXT NOT NULL,
    "missao" VARCHAR(40) NOT NULL,
    "periodo" VARCHAR(10) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missao_resgates_pkey" PRIMARY KEY ("userId","missao","periodo")
);

-- CreateIndex
CREATE INDEX "nex_movimentos_userId_criadoEm_idx" ON "nex_movimentos"("userId", "criadoEm");

-- AddForeignKey
ALTER TABLE "carteiras" ADD CONSTRAINT "carteiras_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nex_movimentos" ADD CONSTRAINT "nex_movimentos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missao_resgates" ADD CONSTRAINT "missao_resgates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
