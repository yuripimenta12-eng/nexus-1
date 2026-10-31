-- Emblema BETA NEXT: todas as contas que já existem ganham
ALTER TABLE "users" ADD COLUMN "isBetaTester" BOOLEAN NOT NULL DEFAULT false;
UPDATE "users" SET "isBetaTester" = true;
