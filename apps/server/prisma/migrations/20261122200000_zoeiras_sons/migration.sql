-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "somEntrada" VARCHAR(40),
ADD COLUMN "receberZoeiras" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "escudoAte" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "servers" ADD COLUMN "zoeirasPesadas" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "zoeiras_estoque" (
    "userId" TEXT NOT NULL,
    "zoeira" VARCHAR(32) NOT NULL,
    "qtd" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "zoeiras_estoque_pkey" PRIMARY KEY ("userId","zoeira")
);

-- AddForeignKey
ALTER TABLE "zoeiras_estoque" ADD CONSTRAINT "zoeiras_estoque_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
