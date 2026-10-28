-- @everyone / @here: quem tem "Mencionar todos" avisa o servidor inteiro
ALTER TABLE "messages" ADD COLUMN "mentionAll" VARCHAR(10);
