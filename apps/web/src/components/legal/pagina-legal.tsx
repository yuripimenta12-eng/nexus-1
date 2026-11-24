// Moldura das páginas públicas de Termos de Uso e Política de Privacidade.
import Link from 'next/link';
import type { ReactNode } from 'react';

// Mudou o texto de forma importante? Troque a data aqui E em apps/server/src/common/termos.ts
export const TERMOS_VERSAO = '2026-11-24';
export const CONTATO = 'suporte@nexuslink.art';
// shortcut: dados do responsável ainda a preencher pelo dono antes de valer de fato
export const RESPONSAVEL = '[NOME COMPLETO DO RESPONSÁVEL]';
export const CIDADE_UF = '[CIDADE/UF]';

export function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f0c14] text-[#d9d3e3]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-black tracking-tight text-white">Nexus</Link>
          <nav className="flex gap-4 text-sm text-[#a99cb8]">
            <Link href="/termos" className="hover:text-white">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight text-white">{titulo}</h1>
        <p className="mt-2 text-sm text-[#8d84a0]">Versão de {TERMOS_VERSAO.split('-').reverse().join('/')}</p>
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed [&_a]:text-[#ffb070] [&_a]:underline [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:text-white [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-white [&_ul]:space-y-1.5">
          {children}
        </div>
        <p className="mt-12 border-t border-white/10 pt-6 text-sm text-[#8d84a0]">
          Dúvidas, pedidos ou reclamações: <a className="text-[#ffb070] underline" href={`mailto:${CONTATO}`}>{CONTATO}</a>
        </p>
      </main>
    </div>
  );
}
