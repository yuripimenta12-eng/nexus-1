'use client';

// Primeiros passos de quem acabou de criar um servidor: um cartão com o
// progresso na lista de canais e uma janela de boas-vindas logo depois de criar.
// O progresso sai dos dados reais do servidor (membros, ícone, descrição);
// só "entrou numa sala de voz" fica guardado no navegador.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, UserPlus, ImagePlus, PenLine, Volume2, X, Sparkles, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { cn, getInitials } from '@/lib/utils';

const ler = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

/** Chamar na página da sala de voz: marca o passo "abra uma sala de voz". */
export function marcarEntrouNaVoz(serverId: string) { gravar(`nx-pp-voz:${serverId}`, '1'); }
/** Chamar logo depois de criar o servidor: abre as boas-vindas ao chegar nele. */
export function pedirBoasVindas(serverId: string) { try { sessionStorage.setItem(`nx-pp-boasvindas:${serverId}`, '1'); } catch { /* ok */ } }

interface ServidorPP {
  id: string; name: string; ownerId: string; iconUrl?: string | null; description?: string | null;
  members?: { user?: { id: string; username: string; profile?: { displayName?: string; avatarUrl?: string | null } } }[];
  voiceRooms?: { id: string; name: string }[];
}

function passosDe(s: ServidorPP) {
  return [
    { id: 'convidar', titulo: 'Chame a galera', desc: 'Mande o link do servidor no grupo da turma.', feito: (s.members?.length || 0) > 1 || ler(`nx-pp-convite:${s.id}`) === '1', botao: 'Convidar', icone: UserPlus },
    { id: 'icone', titulo: 'Ponha um ícone', desc: 'Uma foto ou GIF para o servidor aparecer bonito na barra.', feito: !!s.iconUrl, botao: 'Escolher', icone: ImagePlus },
    { id: 'descricao', titulo: 'Escreva a descrição', desc: 'Conte do que é o servidor. Aparece no convite.', feito: !!s.description?.trim(), botao: 'Escrever', icone: PenLine },
    { id: 'voz', titulo: 'Abra uma sala de voz', desc: 'Entre numa sala e espere a galera chegar.', feito: ler(`nx-pp-voz:${s.id}`) === '1', botao: 'Entrar', icone: Volume2 },
  ];
}

/** Cartão na lista de canais (só para o dono, até completar ou fechar). */
export function PrimeirosPassos({ server, userId, userName }: { server: ServidorPP | null; userId?: string; userName?: string }) {
  const router = useRouter();
  const [dados, setDados] = useState<ServidorPP | null>(server);
  const [aberto, setAberto] = useState(false);
  const [fechado, setFechado] = useState(true);
  const [copiando, setCopiando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => { setDados(server); }, [server]);
  useEffect(() => {
    if (!server) return;
    setFechado(ler(`nx-pp-fechado:${server.id}`) === '1');
    try {
      if (sessionStorage.getItem(`nx-pp-boasvindas:${server.id}`) === '1') {
        sessionStorage.removeItem(`nx-pp-boasvindas:${server.id}`);
        setAberto(true);
      }
    } catch { /* ok */ }
    // Voltou das configurações (ícone/descrição)? relê o servidor
    const reler = () => api.get(`/servers/${server.id}`).then(({ data }) => setDados(data)).catch(() => {});
    window.addEventListener('focus', reler);
    return () => window.removeEventListener('focus', reler);
  }, [server]);

  if (!dados || !userId || dados.ownerId !== userId) return null;
  const passos = passosDe(dados);
  const feitos = passos.filter(p => p.feito).length;
  const completo = feitos === passos.length;

  const agir = async (id: string) => {
    if (id === 'convidar') {
      setCopiando(true);
      try {
        const { data } = await api.post(`/invites/servers/${dados.id}`, { expiresInHours: 168 });
        await navigator.clipboard.writeText(`${window.location.origin}/invite/${data.code}`);
        gravar(`nx-pp-convite:${dados.id}`, '1');
        setAviso('Link copiado! Cole no grupo da galera.');
        setDados({ ...dados });
      } catch { setAviso('Não deu para criar o convite agora.'); }
      setCopiando(false);
      setTimeout(() => setAviso(''), 2600);
      return;
    }
    if (id === 'icone' || id === 'descricao') { setAberto(false); router.push(`/app/servers/${dados.id}/settings`); return; }
    if (id === 'voz') {
      const sala = dados.voiceRooms?.[0];
      setAberto(false);
      if (sala) router.push(`/app/servers/${dados.id}/voice/${sala.id}`);
    }
  };

  const fecharDeVez = () => { gravar(`nx-pp-fechado:${dados.id}`, '1'); setFechado(true); };
  const membros = (dados.members || []).slice(0, 8);

  return (
    <>
      {!fechado && !completo && (
        <div className="mx-2 mb-2 rounded-[14px] border border-[#3a2a4d] bg-gradient-to-br from-[#221533] to-[#150e1f] p-3 relative">
          <button onClick={fecharDeVez} aria-label="Esconder primeiros passos" title="Esconder"
            className="absolute right-2 top-2 text-[#8d82a0] hover:text-white"><X className="w-3.5 h-3.5" /></button>
          <button onClick={() => setAberto(true)} className="w-full text-left">
            <div className="flex items-center gap-2 text-[12px] font-black text-white">
              <Sparkles className="w-3.5 h-3.5 text-[#ffb070]" /> Primeiros passos
              <span className="ml-auto mr-5 text-[11px] text-[#c9a6ff]">{feitos} de {passos.length}</span>
            </div>
            <div className="h-1.5 mt-2 rounded-full bg-[#2e2340] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] transition-all duration-500"
                style={{ width: `${(feitos / passos.length) * 100}%` }} />
            </div>
            <div className="text-[11px] text-[#a99fc0] mt-1.5 truncate">
              Próximo: {passos.find(p => !p.feito)?.titulo}
            </div>
          </button>
        </div>
      )}

      <AnimatePresence>
        {aberto && (
          <motion.div className="fixed inset-0 z-[60] bg-black/65 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAberto(false)}>
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              onClick={e => e.stopPropagation()}
              role="dialog" aria-label="Boas-vindas ao servidor"
              className="w-full max-w-[520px] max-h-[calc(100dvh-32px)] overflow-y-auto nx-no-scrollbar rounded-[22px] border border-[#3a2a4d] bg-[#120d1c] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
            >
              <div className="h-[110px] relative" style={{ background: 'linear-gradient(120deg, #7a2cff 0%, #b142f5 45%, #ff6a00 100%)' }}>
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_120%,rgba(0,0,0,0.45),transparent_60%)]" />
                <button onClick={() => setAberto(false)} aria-label="Fechar"
                  className="absolute right-3 top-3 w-8 h-8 rounded-full bg-black/30 text-white grid place-items-center hover:bg-black/50">
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-8 w-16 h-16 rounded-[20px] border-4 border-[#120d1c] bg-[#1d1428] overflow-hidden grid place-items-center text-white text-lg font-black">
                  {dados.iconUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={dados.iconUrl} alt="" className="w-full h-full object-cover" />
                    : getInitials(dados.name)}
                </div>
              </div>

              <div className="px-6 pt-11 pb-6">
                <h2 className="text-white text-xl font-black text-center leading-snug">
                  Bem-vindo ao <span className="text-[#c9a6ff]">{dados.name}</span>{userName ? <>, <span className="text-[#ffb070]">{userName}</span></> : null}!
                </h2>
                <p className="text-[#a99fc0] text-sm text-center mt-1.5">
                  O servidor é seu: crie canais e cargos, convide e modere. Faça os passos abaixo e chame a galera.
                </p>

                <div className="flex items-center justify-center gap-2 mt-4">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#8d82a0]">Quem já está aqui ({dados.members?.length || 1})</span>
                  <div className="flex -space-x-2">
                    {membros.map((m, i) => (
                      m.user?.profile?.avatarUrl
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img key={i} src={m.user.profile.avatarUrl} alt="" className="w-7 h-7 rounded-full border-2 border-[#120d1c] object-cover" />
                        : <span key={i} className="w-7 h-7 rounded-full border-2 border-[#120d1c] bg-[#7a2cff] text-white text-[10px] font-black grid place-items-center">
                            {getInitials(m.user?.profile?.displayName || m.user?.username || '?')}
                          </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-5 mb-2 text-[11px] font-black uppercase tracking-wider">
                  <span className="text-orange">Primeiros passos</span>
                  <span className="text-[#c9a6ff]">{feitos} de {passos.length}</span>
                </div>
                <div className="grid gap-2">
                  {passos.map(p => (
                    <div key={p.id} className={cn('flex items-center gap-3 rounded-[14px] border p-3 transition-colors',
                      p.feito ? 'border-[#2e2340] bg-[#160f20]' : 'border-[#3a2a4d] bg-[#1b1428]')}>
                      <span className={cn('w-9 h-9 rounded-[12px] grid place-items-center shrink-0',
                        p.feito ? 'bg-gradient-to-br from-[#ff6a00] to-[#7a2cff] text-white' : 'bg-[#2a1c45] text-[#c9a6ff]')}>
                        {p.feito ? <Check className="w-4 h-4" /> : <p.icone className="w-4 h-4" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <b className={cn('block text-sm', p.feito ? 'text-[#8d82a0] line-through' : 'text-white')}>{p.titulo}</b>
                        <small className="block text-xs text-[#92879f]">{p.desc}</small>
                      </span>
                      {!p.feito && (
                        <button onClick={() => agir(p.id)}
                          className="shrink-0 h-8 px-3 rounded-[10px] text-xs font-black text-white bg-[#2a1c45] border border-[#4d3560] hover:border-[#8b48ff] hover:bg-[#33204f] flex items-center gap-1.5">
                          {p.id === 'convidar' && copiando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {p.botao}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {aviso && <p className="text-[#3ddc84] text-xs mt-2 text-center" role="status">{aviso}</p>}

                <div className="flex justify-end mt-5">
                  <button onClick={() => setAberto(false)}
                    className="h-10 px-6 rounded-[12px] text-sm font-black text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] hover:brightness-110 active:scale-[0.98] transition">
                    Bora!
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
