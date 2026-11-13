'use client';

// "O que você acha do Nexus?": o comentário vai para a página inicial
// depois que o dono aprova (com o nome e a foto da pessoa).
import { useEffect, useState } from 'react';
import { Loader2, MessageSquareHeart, Star } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toaster';

export function DepoimentoForm() {
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState(5);
  const [estado, setEstado] = useState<'novo' | 'pendente' | 'aprovado'>('novo');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api.get('/depoimentos/meu').then(({ data }) => {
      if (!data) return;
      setTexto(data.texto); setNota(data.nota); setEstado(data.aprovado ? 'aprovado' : 'pendente');
    }).catch(() => {});
  }, []);

  const enviar = async () => {
    setEnviando(true);
    try {
      await api.post('/depoimentos', { texto, nota });
      setEstado('pendente');
      toast('Valeu! Seu comentário vai para a página inicial depois de aprovado.', 'success');
    } catch (e: any) {
      toast(e?.response?.data?.message || 'Não deu para enviar agora.', 'error');
    } finally { setEnviando(false); }
  };

  const tamanho = texto.trim().length;
  return (
    <section className="rounded-2xl border border-[var(--th-line-2)] bg-[var(--th-panel)] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageSquareHeart className="size-5 text-[#ff8aa8]" />
        <h2 className="text-lg font-extrabold text-white">O que você acha do Nexus?</h2>
      </div>
      <p className="mt-1 text-sm text-[#a99cb8]">
        Os comentários aparecem na página inicial do Nexus, com o seu nome e a sua foto, depois que o dono aprova.
        {estado === 'pendente' && <b className="text-white"> O seu está esperando aprovação.</b>}
        {estado === 'aprovado' && <b className="text-[#c8f53b]"> O seu já está na página inicial!</b>}
      </p>
      <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label="Nota">
        {Array.from({ length: 5 }, (_, i) => (
          <button key={i} type="button" role="radio" aria-checked={nota === i + 1} aria-label={`${i + 1} de 5`}
            onClick={() => setNota(i + 1)} className="p-1">
            <Star className={cn('size-6 transition-colors', i < nota ? 'fill-[#ffc23d] text-[#ffc23d]' : 'text-white/25')} />
          </button>
        ))}
      </div>
      <textarea
        value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 280))} rows={3} maxLength={280}
        placeholder="Conte como é usar o Nexus com a sua turma…" aria-label="Seu comentário"
        className="mt-2 w-full resize-none rounded-xl border border-[var(--th-line-2)] bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-[#6f6680]"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-[#8a8095] tabular-nums">{tamanho}/280</span>
        <button type="button" onClick={enviar} disabled={enviando || tamanho < 10}
          className="inline-flex items-center gap-2 rounded-xl bg-[#c8f53b] px-4 py-2 text-sm font-extrabold text-[#18131f] hover:brightness-110 disabled:opacity-40">
          {enviando && <Loader2 className="size-4 animate-spin" />}
          {estado === 'novo' ? 'Enviar comentário' : 'Atualizar comentário'}
        </button>
      </div>
    </section>
  );
}
