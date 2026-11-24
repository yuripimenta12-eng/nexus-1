import { SeloLiquido } from '@/components/ui/selo-liquido';

// Selo da equipe do Nexus (cargo Staff), no perfil ao lado do BETA NEXT e do plano.
export function SeloStaff({ className }: { className?: string }) {
  return (
    <SeloLiquido cor="staff" titulo="Staff · equipe do Nexus" className={className}
      // eslint-disable-next-line @next/next/no-img-element
      icone={<img src="/itens/icones/i-staff.webp" alt="" aria-hidden className="w-[20px] h-[20px] object-contain" draggable={false} />}>
      STAFF
    </SeloLiquido>
  );
}
