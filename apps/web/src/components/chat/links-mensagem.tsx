'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Users } from 'lucide-react';
import api from '@/lib/api';
import { avisarServidoresMudaram, codigoDoLinkDeConvite } from '@/lib/convite';
import { Avatar } from '@/components/ui/avatar';

// Links clicáveis nas mensagens + cartão de convite (estilo Discord):
// quem recebe um link de convite entra no servidor com UM clique, sem
// precisar copiar e colar (no app de PC nem existe barra de endereço).

/** Link dentro da mensagem. Convite do Nexus abre dentro do próprio app. */
export function LinkMensagem({ url, claro }: { url: string; claro?: boolean }) {
  const router = useRouter();
  // Pontuação no fim ("veja isso: https://…/x.") não faz parte do link
  const fim = url.match(/[.,!?;:)\]]+$/)?.[0] || '';
  const href = fim ? url.slice(0, -fim.length) : url;
  const codigo = codigoDoLinkDeConvite(href);
  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={codigo ? (e) => { e.preventDefault(); router.push(`/invite/${codigo}`); } : undefined}
        className={claro ? 'text-white underline break-all' : 'text-[#7cc4ff] hover:underline break-all'}
      >
        {href}
      </a>
      {fim}
    </>
  );
}

/** Texto com os links (http/https) clicáveis. `claro`: sobre fundo roxo (minha bolha) */
export function textoComLinks(texto: string, claro?: boolean): React.ReactNode {
  if (!texto || !/https?:\/\//.test(texto)) return texto;
  return texto.split(/(https?:\/\/[^\s<>"']+)/g).map((parte, i) =>
    /^https?:\/\//.test(parte) ? <LinkMensagem key={i} url={parte} claro={claro} /> : parte,
  );
}

interface Previa {
  code: string;
  server: { id: string; name: string; iconUrl: string | null; memberCount: number };
  alreadyMember: boolean;
  invalidReason: string | null;
}

// Cache por código: rolar o chat não refaz a busca de cada cartão
const previas = new Map<string, Promise<Previa | null>>();
function buscarPrevia(code: string) {
  let p = previas.get(code);
  if (!p) {
    p = api.get(`/invites/${code}`).then(r => r.data as Previa).catch(() => null);
    previas.set(code, p);
  }
  return p;
}

export function CartaoConvite({ code }: { code: string }) {
  const router = useRouter();
  const [previa, setPrevia] = useState<Previa | null | undefined>(undefined);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    buscarPrevia(code).then(p => { if (vivo) setPrevia(p); });
    return () => { vivo = false; };
  }, [code]);

  const entrar = async () => {
    if (!previa) return;
    if (previa.alreadyMember) { router.push(`/app/servers/${previa.server.id}`); return; }
    setEntrando(true);
    setErro(null);
    try {
      const { data } = await api.post(`/invites/${code}/use`);
      previas.delete(code);
      avisarServidoresMudaram();
      router.push(`/app/servers/${data?.server?.id || previa.server.id}`);
    } catch (e: any) {
      setErro(e?.response?.data?.message || 'Não foi possível entrar agora');
      setEntrando(false);
    }
  };

  const invalido = previa === null || !!previa?.invalidReason;
  return (
    <div className="mt-2 w-full max-w-[400px] rounded-xl border border-[#2a1f40] bg-[#120e1b] p-3.5">
      <p className="text-[10px] font-black tracking-wider text-[#9a8fab] uppercase mb-2.5">
        {invalido ? 'Convite' : previa?.alreadyMember ? 'Convite para um servidor seu' : 'Você recebeu um convite para um servidor'}
      </p>
      {previa === undefined ? (
        <div className="flex items-center gap-2 text-[13px] text-[#9a8fab]">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando convite…
        </div>
      ) : invalido ? (
        <p className="text-[13px] text-[#ff8a8a]">{previa?.invalidReason || 'Este convite não existe mais ou foi apagado.'}</p>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar src={previa.server.iconUrl} name={previa.server.name} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-white truncate">{previa.server.name}</p>
            <p className="text-[12px] text-[#9a8fab] flex items-center gap-1">
              <Users className="w-3 h-3" aria-hidden />
              {previa.server.memberCount} membro{previa.server.memberCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={entrar}
            disabled={entrando}
            className="shrink-0 h-9 px-4 rounded-lg text-[13px] font-extrabold text-white bg-[#23a55a] hover:bg-[#1f9150] disabled:opacity-60 flex items-center gap-1.5"
          >
            {entrando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {previa.alreadyMember ? 'Abrir' : 'Entrar'}
          </button>
        </div>
      )}
      {erro && <p className="text-[12px] text-[#ff8a8a] mt-2">{erro}</p>}
    </div>
  );
}
