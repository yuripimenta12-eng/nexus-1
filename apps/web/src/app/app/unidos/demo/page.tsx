'use client';

import { PainelDemo } from '@/components/games/unidos/demo/painel-demo';

// Demonstração dos efeitos do UNidos: mesa simulada no navegador para testar
// cada animação separadamente (cartas especiais, compras, vez, vitória…).
export default function DemoUnidosPage() {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center text-[#a99cb8] text-sm p-6 text-center">
      A mesa de demonstração abre por cima desta página. Se você fechar, use “Abrir a mesa de novo” no painel.
      <PainelDemo />
    </div>
  );
}
