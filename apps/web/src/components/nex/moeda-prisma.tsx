'use client';

import { cn } from '@/lib/utils';

// Prisma: a moeda AZUL, comprada com dinheiro. Arte 3D em public/itens/moeda-prisma.webp.
export function MoedaPrisma({ className, titulo }: { className?: string; titulo?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/itens/moeda-prisma.webp" alt={titulo ?? ''} aria-hidden={titulo ? undefined : true} title={titulo} draggable={false}
      className={cn('inline-block shrink-0 object-contain select-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]', className)} />
  );
}
