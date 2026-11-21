-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "moldura" VARCHAR(40),
ADD COLUMN "icone" VARCHAR(40),
ADD COLUMN "placa" VARCHAR(40);

-- CreateTable
CREATE TABLE "itens_posse" (
    "userId" TEXT NOT NULL,
    "itemId" VARCHAR(40) NOT NULL,
    "origem" VARCHAR(16) NOT NULL,
    "expiraEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itens_posse_pkey" PRIMARY KEY ("userId","itemId")
);

-- AddForeignKey
ALTER TABLE "itens_posse" ADD CONSTRAINT "itens_posse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
