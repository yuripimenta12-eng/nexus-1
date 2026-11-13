-- AlterTable
ALTER TABLE "users" ADD COLUMN     "codigoIndicacao" VARCHAR(12),
ADD COLUMN     "diasGanhos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "indicacaoPaga" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "indicadoPorId" TEXT,
ADD COLUMN     "plano" VARCHAR(10) NOT NULL DEFAULT 'gratis',
ADD COLUMN     "planoAte" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_codigoIndicacao_key" ON "users"("codigoIndicacao");

-- CreateIndex
CREATE INDEX "users_indicadoPorId_idx" ON "users"("indicadoPorId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_indicadoPorId_fkey" FOREIGN KEY ("indicadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

