'use client';

// Seções do perfil gamer: jogando agora, jogos, conexões, números e em comum.
// Usadas no cartão do membro e na prévia ao vivo do editor (onEditar mostra o lápis).
import { useEffect, useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REDES, mesAno, tempoDesde, type PerfilCompleto } from '@/lib/perfil-gamer';

export type SecaoPerfil = 'jogos' | 'conexoes' | 'bio';

function Caixa({ titulo, secao, onEditar, children, className }: {
  titulo?: string; secao?: SecaoPerfil; onEditar?: (s: SecaoPerfil) => void; children: React.ReactNode; className?: string;
}) {
  const editavel = !!(onEditar && secao);
  return (
    <div
      className={cn('group/sec relative rounded-xl bg-[var(--th-panel-2)] px-3 py-2.5', editavel && 'cursor-pointer hover:ring-1 hover:ring-[#7a2cff]/60', className)}
      onClick={editavel ? () => onEditar!(secao!) : undefined}
    >
      {titulo && <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#8a8095] mb-1.5">{titulo}</p>}
      {children}
      {editavel && (
        <span className="absolute top-2 right-2 grid place-items-center w-6 h-6 rounded-full bg-[#7a2cff] text-white opacity-0 group-hover/sec:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity" aria-label={`Editar ${titulo}`}>
          <Pencil className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}

/** "Jogando Valorant · 1h20" (atualiza sozinho a cada minuto). */
export function JogandoAgora({ nome, desde }: { nome: string; desde?: number | null }) {
  const [, tic] = useState(0);
  useEffect(() => { const t = setInterval(() => tic(n => n + 1), 60_000); return () => clearInterval(t); }, []);
  const tempo = tempoDesde(desde);
  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ background: 'rgba(67,227,163,0.08)', border: '1px solid rgba(67,227,163,0.25)' }}>
      <span className="text-xl" aria-hidden>🎮</span>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#43e3a3]">Jogando agora{tempo ? ` · ${tempo}` : ''}</p>
        <p className="text-[13px] text-white font-semibold truncate">{nome}</p>
      </div>
    </div>
  );
}

export function SecoesPerfilGamer({ perfil, onEditar }: { perfil: PerfilCompleto; onEditar?: (s: SecaoPerfil) => void }) {
  const pf = perfil.profile;
  const jogos = pf?.jogos ?? [];
  const conexoes = REDES.filter(r => pf?.conexoes?.[r.id]);
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = (texto: string) => {
    navigator.clipboard?.writeText(texto).then(() => { setCopiado(texto); setTimeout(() => setCopiado(null), 1500); }).catch(() => {});
  };

  return (
    <div className="space-y-2.5">
      {(jogos.length > 0 || pf?.procurandoDuo || onEditar) && (
        <Caixa titulo="Jogos" secao="jogos" onEditar={onEditar}>
          {pf?.procurandoDuo && (
            <span className="inline-flex items-center gap-1.5 mb-2 rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold text-[#18131f] bg-[#c8f53b]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#18131f] animate-pulse" /> Procurando duo
            </span>
          )}
          {jogos.length === 0 ? (
            <p className="text-[12.5px] text-[#6f6478]">{onEditar ? 'Adicione os jogos que você joga' : 'Nenhum jogo ainda'}</p>
          ) : (
            <ul className="space-y-1">
              {jogos.map(j => (
                <li key={j.jogo} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-white font-semibold truncate">{j.jogo}</span>
                  <span className="text-[#a99cb8] text-[12px] truncate text-right">{[j.rank, j.nick].filter(Boolean).join(' · ')}</span>
                </li>
              ))}
            </ul>
          )}
        </Caixa>
      )}

      {(conexoes.length > 0 || onEditar) && (
        <Caixa titulo="Conexões" secao="conexoes" onEditar={onEditar}>
          {conexoes.length === 0 ? (
            <p className="text-[12.5px] text-[#6f6478]">Twitch, YouTube, Steam, Riot ID…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {conexoes.map(r => {
                const u = pf!.conexoes![r.id]!;
                const conteudo = (
                  <>
                    <span className="grid place-items-center min-w-[20px] h-5 px-1 rounded-md text-[9.5px] font-black text-[#0c0a10]" style={{ background: r.cor }}>{r.letra}</span>
                    <span className="truncate max-w-[130px]">{copiado === u ? 'Copiado!' : u}</span>
                    {copiado === u && <Check className="w-3 h-3 text-[#43e3a3]" />}
                  </>
                );
                const cls = 'inline-flex items-center gap-1.5 rounded-lg pl-1 pr-2 py-1 text-[12px] font-semibold text-[#e3dbeb] bg-black/25 border border-white/5 hover:border-white/20 transition-colors';
                // Na prévia do editor o clique abre o editor, não o link
                if (onEditar) return <span key={r.id} className={cls} title={r.nome}>{conteudo}</span>;
                return r.link
                  ? <a key={r.id} href={r.link(u)} target="_blank" rel="noopener noreferrer nofollow" className={cls} title={`${r.nome}: ${u}`}>{conteudo}</a>
                  : <button key={r.id} type="button" onClick={() => copiar(u)} className={cls} title={`${r.nome}: clique para copiar`}>{conteudo}</button>;
              })}
            </div>
          )}
        </Caixa>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          { valor: mesAno(perfil.createdAt), rotulo: 'No Nexus desde' },
          { valor: `${perfil.numeros?.horasCall ?? 0}h`, rotulo: 'Em call' },
          { valor: String(perfil.numeros?.vitoriasUnidos ?? 0), rotulo: 'Vitórias UNidos' },
        ].map(n => (
          <div key={n.rotulo} className="rounded-xl bg-[var(--th-panel-2)] px-1.5 py-2.5 text-center">
            <p className="text-[16px] font-extrabold text-white leading-tight">{n.valor}</p>
            <p className="text-[9.5px] font-bold uppercase tracking-wide text-[#8a8095] mt-0.5 leading-tight">{n.rotulo}</p>
          </div>
        ))}
      </div>

      {perfil.emComum && (perfil.emComum.servidores.length > 0 || perfil.emComum.amigos > 0) && (
        <p className="text-[12px] text-[#8a8095]" title={perfil.emComum.servidores.map(s => s.name).join(', ')}>
          Em comum: {[
            perfil.emComum.servidores.length && `${perfil.emComum.servidores.length} ${perfil.emComum.servidores.length === 1 ? 'servidor' : 'servidores'}`,
            perfil.emComum.amigos && `${perfil.emComum.amigos} ${perfil.emComum.amigos === 1 ? 'amigo' : 'amigos'}`,
          ].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  );
}
