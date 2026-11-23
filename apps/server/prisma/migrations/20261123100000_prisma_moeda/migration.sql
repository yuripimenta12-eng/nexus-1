ALTER TABLE "carteiras" ADD COLUMN "prismas" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "prisma_movimentos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "motivo" VARCHAR(48) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prisma_movimentos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "prisma_movimentos_userId_criadoEm_idx" ON "prisma_movimentos"("userId", "criadoEm");

ALTER TABLE "prisma_movimentos" ADD CONSTRAINT "prisma_movimentos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
