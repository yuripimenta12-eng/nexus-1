'use client';

// Emblema do plano pago (Nexus+ / Nexus Pro) ao lado do nome e no perfil.
// Grátis não mostra nada.
import { Crown, Gem } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeloLiquido } from '@/components/ui/selo-liquido';
import { NOME_PLANO, planoAtivo } from '@/lib/planos';

type ComPlano = { plano?: string | null; planoAte?: string | Date | null } | null | undefined;

const VISUAL = {
  mais: { Icone: Gem, cor: '#3ee0ff', borda: 'linear-gradient(110deg, #21d4fd, #7a2cff)', texto: 'linear-gradient(90deg, #8ff0ff, #c49bff)' },
  pro: { Icone: Crown, cor: '#ffc23d', borda: 'linear-gradient(110deg, #ffc23d, #ff6a00 55%, #ff4f79)', texto: 'linear-gradient(90deg, #ffe08a, #ffb070 50%, #ff8aa8)' },
} as const;

export function EmblemaPlano({ usuario, size = 14, className }: { usuario: ComPlano; size?: number; className?: string }) {
  const plano = planoAtivo(usuario);
  if (plano === 'gratis') return null;
  const { Icone, cor } = VISUAL[plano];
  return (
    <span title={NOME_PLANO[plano]} role="img" aria-label={NOME_PLANO[plano]} className={cn('inline-flex shrink-0', className)}>
      <Icone style={{ width: size, height: size, color: cor }} strokeWidth={2.4} />
    </span>
  );
}

export function SeloPlano({ usuario, className }: { usuario: ComPlano; className?: string }) {
  const plano = planoAtivo(usuario);
  if (plano === 'gratis') return null;
  const { Icone, cor } = VISUAL[plano];
  return (
    <SeloLiquido cor={plano} titulo={NOME_PLANO[plano]} className={className}
      icone={plano === 'pro'
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src="/itens/icones/i-pro.webp" alt="" aria-hidden draggable={false} className="h-[18px] w-[30px] -my-1 object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
        : <Icone style={{ width: 15, height: 15, color: cor }} strokeWidth={2.4} aria-hidden />}>
      {NOME_PLANO[plano]}
    </SeloLiquido>
  );
}
