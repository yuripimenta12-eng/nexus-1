import { cn } from '@/lib/utils';

// Selo da equipe do Nexus (cargo Staff), no perfil ao lado do BETA NEXT e do plano.
export function SeloStaff({ className }: { className?: string }) {
  return (
    <span title="Staff · equipe do Nexus"
      className={cn('inline-flex items-center rounded-full p-[1px] select-none', className)}
      style={{ background: 'linear-gradient(110deg, #ff9a1f, #a64dff 55%, #4f6bff)' }}>
      <span className="inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 py-[2px] bg-[#130d1d]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/itens/icones/i-staff.webp" alt="" aria-hidden className="w-[20px] h-[20px] object-contain" draggable={false} />
        <span className="text-[10.5px] font-black tracking-[0.14em] leading-none bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(90deg, #ffc070, #d29bff 50%, #8fa2ff)' }}>
          STAFF
        </span>
      </span>
    </span>
  );
}
