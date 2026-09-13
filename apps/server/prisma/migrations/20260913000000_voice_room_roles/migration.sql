-- Salas de voz restritas a cargos (lista vazia = aberta a todos)
-- CreateTable
CREATE TABLE "_VoiceRoomAllowedRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_VoiceRoomAllowedRoles_AB_unique" ON "_VoiceRoomAllowedRoles"("A", "B");

-- CreateIndex
CREATE INDEX "_VoiceRoomAllowedRoles_B_index" ON "_VoiceRoomAllowedRoles"("B");

-- AddForeignKey
ALTER TABLE "_VoiceRoomAllowedRoles" ADD CONSTRAINT "_VoiceRoomAllowedRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VoiceRoomAllowedRoles" ADD CONSTRAINT "_VoiceRoomAllowedRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "voice_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
