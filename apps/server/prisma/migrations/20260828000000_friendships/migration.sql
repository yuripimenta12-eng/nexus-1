-- Amizades (idempotente: o banco de prod foi criado via db push, sem histórico)
CREATE TABLE IF NOT EXISTS "friendships" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "friendships_requesterId_addresseeId_key"
    ON "friendships"("requesterId", "addresseeId");
CREATE INDEX IF NOT EXISTS "friendships_addresseeId_idx" ON "friendships"("addresseeId");

DO $$ BEGIN
    ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requesterId_fkey"
        FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addresseeId_fkey"
        FOREIGN KEY ("addresseeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
