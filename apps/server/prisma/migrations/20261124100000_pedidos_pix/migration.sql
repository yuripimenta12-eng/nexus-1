CREATE TABLE "pedidos_pix" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "txid" VARCHAR(35) NOT NULL,
    "ambiente" VARCHAR(12) NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "item" VARCHAR(24) NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pendente',
    "copiaECola" TEXT NOT NULL,
    "qrImagem" TEXT,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "pagoEm" TIMESTAMP(3),
    "e2eId" VARCHAR(40),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pedidos_pix_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pedidos_pix_txid_key" ON "pedidos_pix"("txid");
CREATE INDEX "pedidos_pix_userId_criadoEm_idx" ON "pedidos_pix"("userId", "criadoEm");
CREATE INDEX "pedidos_pix_status_ambiente_idx" ON "pedidos_pix"("status", "ambiente");

ALTER TABLE "pedidos_pix" ADD CONSTRAINT "pedidos_pix_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
