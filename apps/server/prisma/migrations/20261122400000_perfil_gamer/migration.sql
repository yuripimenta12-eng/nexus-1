-- Perfil gamer: cor do nome (planos pagos), jogos, conexões e "procurando duo"
ALTER TABLE "profiles" ADD COLUMN "corNome" VARCHAR(32);
ALTER TABLE "profiles" ADD COLUMN "jogos" JSONB;
ALTER TABLE "profiles" ADD COLUMN "conexoes" JSONB;
ALTER TABLE "profiles" ADD COLUMN "procurandoDuo" BOOLEAN NOT NULL DEFAULT false;
