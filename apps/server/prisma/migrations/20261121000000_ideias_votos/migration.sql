-- CreateTable
CREATE TABLE "ideia_votos" (
    "ideia" VARCHAR(40) NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" VARCHAR(8) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ideia_votos_pkey" PRIMARY KEY ("ideia","userId")
);

-- CreateIndex
CREATE INDEX "ideia_votos_userId_idx" ON "ideia_votos"("userId");

-- AddForeignKey
ALTER TABLE "ideia_votos" ADD CONSTRAINT "ideia_votos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
