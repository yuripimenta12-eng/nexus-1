'use client';

import { Menu } from 'lucide-react';
import { useUiStore } from '@/stores/ui.store';
import { cn } from '@/lib/utils';

// Botão ☰ que abre a gaveta de servidores/canais no celular.
// Fica no começo do cabeçalho de cada tela (some no desktop, onde a
// navegação é fixa) — assim nunca cobre a caixa de mensagem nem os controles.
export function MobileMenuButton({ className }: { className?: string }) {
  const toggleMobileNav = useUiStore(s => s.toggleMobileNav);
  return (
    <button
      type="button"
      onClick={toggleMobileNav}
      aria-label="Abrir menu"
      title="Abrir menu"
      className={cn(
        'md:hidden shrink-0 w-10 h-10 -ml-1 mr-1.5 rounded-xl grid place-items-center',
        'text-[#cfc5d8] hover:text-white hover:bg-white/5 active:scale-95 transition',
        className,
      )}
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
