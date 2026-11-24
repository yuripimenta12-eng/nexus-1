'use client';

// Quem ainda não aceitou a versão atual dos Termos/Privacidade (contas antigas, ou texto
// atualizado) vê esta janela uma vez: declara ter 18+ e aceita. O servidor grava a data.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, ScrollText } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { TERMOS_VERSAO } from '@/components/legal/pagina-legal';

export function AceiteTermos() {
  const user = useAuthStore(s => s.user);
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  if (!user || user.termosVersao === TERMOS_VERSAO || typeof document === 'undefined') return null;

  const aceitar = async () => {
    setEnviando(true); setErro('');
    try {
      const { data } = await api.post('/users/@me/termos', { maior18: true });
      const atual = useAuthStore.getState().user;
      if (atual) useAuthStore.getState().setUser({ ...atual, termosVersao: data.termosVersao });
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Não deu certo. Tente de novo.');
    }
    setEnviando(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="termos-titulo"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121018] p-6 shadow-2xl">
        <span className="grid size-11 place-items-center rounded-xl bg-[#ff6a00]/15 text-[#ffb070]"><ScrollText className="size-5" /></span>
        <h2 id="termos-titulo" className="mt-4 text-lg font-extrabold text-white">Nossos Termos e a Política de Privacidade</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#b9b2c6]">
          O Nexus agora tem <b className="text-white">Termos de Uso</b> e <b className="text-white">Política de Privacidade</b> oficiais,
          com as regras, os planos, o reembolso em 7 dias e como cuidamos dos seus dados. O Nexus é só para maiores de 18 anos.
        </p>
        <div className="mt-3 flex gap-4 text-sm">
          <a href="/termos" target="_blank" rel="noopener" className="font-semibold text-[#ffb070] underline">Ler os Termos</a>
          <a href="/privacidade" target="_blank" rel="noopener" className="font-semibold text-[#ffb070] underline">Ler a Política</a>
        </div>
        <label className="mt-5 flex cursor-pointer select-none items-start gap-2.5 rounded-xl border border-white/10 bg-black/20 p-3">
          <input type="checkbox" checked={marcado} onChange={e => setMarcado(e.target.checked)} className="mt-0.5 size-4 accent-[#ff6a00]" />
          <span className="text-sm text-[#d9d3e3]">Tenho <b className="text-white">18 anos ou mais</b> e aceito os Termos de Uso e a Política de Privacidade.</span>
        </label>
        {erro && <p className="mt-2 text-sm text-red-300">{erro}</p>}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => useAuthStore.getState().logout()} className="text-sm font-semibold text-[#8d84a0] hover:text-white">
            Sair da conta
          </button>
          <button type="button" disabled={!marcado || enviando} onClick={aceitar}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ff6a00] px-5 py-2.5 text-sm font-extrabold text-white hover:brightness-110 disabled:opacity-40">
            {enviando && <Loader2 className="size-4 animate-spin" />}Aceitar e continuar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
