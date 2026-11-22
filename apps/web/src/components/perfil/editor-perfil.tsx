'use client';

// Editor do perfil gamer com prévia ao vivo: jogos, "procurando duo", conexões
// e cor do nome (Nexus+/Pro). Clicar numa parte da prévia pula para o ajuste.
import { FaixaConquistas } from '@/components/voice/placar';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2, Loader2, Lock, Check } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/ui/avatar';
import { SeloPlano } from '@/components/ui/selo-plano';
import { NomeComItens } from '@/components/nex/itens-visuais';
import { EfeitoPerfil } from '@/components/nex/efeito-perfil';
import { corSegura } from '@/lib/seguro';
import { BENEFICIOS, NOME_PLANO, planoAtivo, type Plano } from '@/lib/planos';
import { JOGOS_SUGERIDOS, REDES, type Conexoes, type JogoPerfil, type PerfilCompleto } from '@/lib/perfil-gamer';
import { JogandoAgora, SecoesPerfilGamer, type SecaoPerfil } from './secoes-perfil';

// Cores prontas do nome (uma cor ou degradê)
const CORES_NOME = [
  '#ff6a00', '#ff4f79', '#c8f53b', '#3ee0ff', '#b98aff', '#ffc23d',
  '#ff6a00,#7a2cff', '#21d4fd,#b721ff', '#ffc23d,#ff4f79', '#3dffb0,#00d4ff', '#ff8cc6,#ffd36e', '#c8f53b,#3ee0ff',
];
// Moldura que vem com cada plano (some na prévia se o plano simulado não cobre)
const MOLDURA_DO_PLANO: Record<string, Plano> = { 'm-mais': 'mais', 'm-pro': 'pro', 'm-pro-eletrica': 'pro' };
const NIVEL: Record<Plano, number> = { gratis: 0, mais: 1, pro: 2 };

const campo = 'w-full bg-[var(--th-panel-2)] border border-[var(--th-line-2)] rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-[#5c5468] outline-none focus:border-[#7a2cff]';

export function EditorPerfilGamer() {
  const { user, setUser } = useAuthStore();
  const pf = user?.profile;
  const meuPlano = planoAtivo(user);

  const [jogos, setJogos] = useState<JogoPerfil[]>(pf?.jogos ?? []);
  const [duo, setDuo] = useState(!!pf?.procurandoDuo);
  const [conexoes, setConexoes] = useState<Conexoes>((pf?.conexoes as Conexoes) ?? {});
  const [corNome, setCorNome] = useState<string | null>(pf?.corNome ?? null);
  const [simulado, setSimulado] = useState<Plano>(meuPlano);
  const [extra, setExtra] = useState<Pick<PerfilCompleto, 'numeros' | 'jogando' | 'createdAt'>>({});
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  // Números e jogo aberto vêm do perfil público (não ficam no login)
  useEffect(() => {
    if (!user?.id) return;
    api.get(`/users/${user.id}/profile`).then(({ data }) => setExtra({ numeros: data?.numeros, jogando: data?.jogando, createdAt: data?.createdAt })).catch(() => {});
  }, [user?.id]);

  const podeCor = BENEFICIOS[meuPlano].corNome;
  const mudou = JSON.stringify([jogos, duo, conexoes, corNome]) !== JSON.stringify([pf?.jogos ?? [], !!pf?.procurandoDuo, pf?.conexoes ?? {}, pf?.corNome ?? null]);

  const pular = (s: SecaoPerfil) => {
    const el = document.getElementById(`ed-${s}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
  };

  const salvar = async () => {
    setSalvando(true); setAviso(null);
    const limpos = jogos.filter(j => j.jogo.trim()).map(j => ({ jogo: j.jogo.trim(), rank: j.rank?.trim() || undefined, nick: j.nick?.trim() || undefined }));
    const conx = Object.fromEntries(Object.entries(conexoes).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()]));
    try {
      const { data } = await api.patch('/users/@me/profile', {
        jogos: limpos.length ? limpos : null,
        conexoes: Object.keys(conx).length ? conx : null,
        procurandoDuo: duo,
        ...(podeCor || corNome === null ? { corNome } : {}),
      });
      // O servidor devolve o que ficou salvo (já limpo)
      setUser({ ...user!, profile: { ...user!.profile!, ...data } });
      setJogos(data.jogos ?? []); setConexoes(data.conexoes ?? {}); setCorNome(data.corNome ?? null); setDuo(!!data.procurandoDuo);
      setAviso({ ok: true, texto: 'Perfil salvo!' });
    } catch (e: any) {
      const m = e?.response?.data?.message;
      setAviso({ ok: false, texto: Array.isArray(m) ? m[0] : m || 'Não deu para salvar' });
    } finally {
      setSalvando(false);
    }
  };

  // Prévia: o perfil como os outros vão ver, no plano escolhido em "Ver como fica"
  const moldura = pf?.moldura && MOLDURA_DO_PLANO[pf.moldura] && NIVEL[simulado] < NIVEL[MOLDURA_DO_PLANO[pf.moldura]] ? null : pf?.moldura;
  const previa: PerfilCompleto = useMemo(() => ({
    id: user?.id ?? '', username: user?.username ?? '', createdAt: extra.createdAt, numeros: extra.numeros,
    profile: { ...pf, jogos: jogos.filter(j => j.jogo.trim()), conexoes, procurandoDuo: duo },
  }), [user?.id, user?.username, extra, pf, jogos, conexoes, duo]);
  const nome = pf?.displayName || user?.username || '';
  const [b1, b2] = (pf?.bannerColor || '').split(',').map(c => corSegura(c, ''));
  const banner = pf?.bannerUrl ? `center / cover no-repeat url(${pf.bannerUrl})` : b1 && b2 ? `linear-gradient(120deg, ${b1}, ${b2})` : 'linear-gradient(120deg, #7a2cff, #ff6a00)';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      {/* ── Ajustes ── */}
      <div className="space-y-5 order-2 lg:order-1">
        <section id="ed-jogos" className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Jogos</h3>
            <span className="text-[12px] text-[#8a8095]">{jogos.length}/6</span>
          </div>
          <datalist id="nx-jogos-sugeridos">{JOGOS_SUGERIDOS.map(j => <option key={j} value={j} />)}</datalist>
          {jogos.map((j, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1.3fr_1fr_1fr_auto] gap-2 items-center pb-2 sm:pb-0 border-b sm:border-0 border-[var(--th-line)]">
              <input className={cn(campo, 'col-span-2 sm:col-span-1')} list="nx-jogos-sugeridos" maxLength={40} placeholder="Jogo" value={j.jogo}
                onChange={e => setJogos(js => js.map((x, k) => (k === i ? { ...x, jogo: e.target.value } : x)))} />
              <input className={campo} maxLength={30} placeholder="Rank (ex.: Ouro 2)" value={j.rank ?? ''}
                onChange={e => setJogos(js => js.map((x, k) => (k === i ? { ...x, rank: e.target.value } : x)))} />
              <input className={campo} maxLength={40} placeholder="Nick no jogo" value={j.nick ?? ''}
                onChange={e => setJogos(js => js.map((x, k) => (k === i ? { ...x, nick: e.target.value } : x)))} />
              <button type="button" onClick={() => setJogos(js => js.filter((_, k) => k !== i))} aria-label="Tirar jogo"
                className="w-9 h-9 grid place-items-center rounded-lg text-[#8a8095] hover:text-destructive hover:bg-destructive/10 row-start-1 col-start-3 sm:row-auto sm:col-auto">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {jogos.length < 6 && (
            <button type="button" onClick={() => setJogos(js => [...js, { jogo: '' }])}
              className="flex items-center gap-1.5 text-[13px] font-bold text-[#c9a8ff] hover:text-white">
              <Plus className="w-4 h-4" /> Adicionar jogo
            </button>
          )}
          <label className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--th-line)] cursor-pointer">
            <span>
              <span className="block text-[13.5px] font-semibold text-white">Procurando duo</span>
              <span className="block text-[12px] text-[#8a8095]">Mostra um selo verde no seu perfil para a galera te chamar</span>
            </span>
            <input type="checkbox" checked={duo} onChange={e => setDuo(e.target.checked)} className="w-5 h-5 accent-[#c8f53b]" />
          </label>
        </section>

        <section id="ed-conexoes" className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Conexões</h3>
          <p className="text-[12px] text-[#8a8095] -mt-1">Só o nome de usuário. Quem clicar abre o seu canal ou perfil.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {REDES.map(r => (
              <label key={r.id} className="flex items-center gap-2">
                <span className="grid place-items-center min-w-[30px] h-[30px] rounded-lg text-[10px] font-black text-[#0c0a10] shrink-0" style={{ background: r.cor }} title={r.nome}>{r.letra}</span>
                <input className={campo} maxLength={40} placeholder={`${r.nome}: ${r.dica}`} value={conexoes[r.id] ?? ''}
                  onChange={e => setConexoes(c => ({ ...c, [r.id]: e.target.value }))} />
              </label>
            ))}
          </div>
        </section>

        <section id="ed-cor" className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Cor do nome</h3>
            <span className="text-[11px] font-extrabold rounded-full px-2 py-0.5 bg-[#21d4fd]/15 text-[#8ff0ff]">Nexus+ e Pro</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCorNome(null)} title="Sem cor"
              className={cn('h-9 px-3 rounded-lg text-[12px] font-bold border', corNome === null ? 'border-white text-white' : 'border-[var(--th-line-2)] text-[#8a8095]')}>
              Padrão
            </button>
            {CORES_NOME.map(c => {
              const [x, y] = c.split(',');
              return (
                <button key={c} type="button" disabled={!podeCor} onClick={() => setCorNome(c)} title={podeCor ? c : 'Vem com o Nexus+ ou o Pro'}
                  className={cn('w-9 h-9 rounded-lg border-2 transition-transform', corNome === c ? 'border-white scale-110' : 'border-transparent', podeCor ? 'hover:scale-110' : 'opacity-40 cursor-not-allowed')}
                  style={{ background: y ? `linear-gradient(135deg, ${x}, ${y})` : x }} />
              );
            })}
          </div>
          {!podeCor && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-[#a99cb8]">
              <Lock className="w-3.5 h-3.5" /> Seu nome colorido em todo lugar (chat, call e lista) com o{' '}
              <Link href="/app/planos" className="font-bold text-[#8ff0ff] hover:underline">Nexus+ ou o Pro</Link>.
            </p>
          )}
        </section>

        <p className="text-[12.5px] text-[#8a8095]">
          Moldura, ícone e placa do nome você escolhe na <Link href="/app/loja" className="font-bold text-[#c9a8ff] hover:underline">Loja Nexus</Link>.
          Foto, capa e bio ficam em Minha Conta.
        </p>

        <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-xl border border-[var(--th-line-2)] bg-[var(--th-panel)]/95 backdrop-blur px-4 py-3">
          <button type="button" onClick={salvar} disabled={salvando || !mudou}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] disabled:opacity-40 hover:brightness-110">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar perfil
          </button>
          {aviso ? <span className={cn('text-[13px]', aviso.ok ? 'text-success' : 'text-destructive')}>{aviso.texto}</span>
            : mudou && <span className="text-[12.5px] text-[#a99cb8]">Você tem mudanças não salvas</span>}
        </div>
      </div>

      {/* ── Prévia ao vivo ── */}
      <aside className="order-1 lg:order-2 lg:sticky lg:top-4 space-y-2.5">
        <div className="flex items-center gap-1 rounded-xl bg-[var(--th-panel)] border border-[var(--th-line)] p-1" role="tablist" aria-label="Ver como fica no plano">
          {(['gratis', 'mais', 'pro'] as Plano[]).map(p => (
            <button key={p} type="button" role="tab" aria-selected={simulado === p} onClick={() => setSimulado(p)}
              className={cn('flex-1 rounded-lg py-1.5 text-[12.5px] font-bold transition-colors', simulado === p ? 'bg-white/10 text-white' : 'text-[#8a8095] hover:text-white')}>
              {p === 'gratis' ? 'Grátis' : NOME_PLANO[p]}
            </button>
          ))}
        </div>
        <div className="relative rounded-[18px] overflow-hidden border border-[var(--th-line-2)] bg-[var(--th-panel)] shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
          <EfeitoPerfil id={pf?.efeitoPerfil} />
          <div className="relative h-[92px]" style={{ background: banner }}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--th-panel)]/70" />
          </div>
          <div className="px-4 pb-4 -mt-11">
            <div className="relative inline-block">
              <Avatar src={pf?.avatarUrl} name={nome} size="xl" moldura={moldura}
                className="!w-[84px] !h-[84px] ring-[5px] ring-[var(--th-panel)] rounded-full" />
            </div>
            <div className="mt-2">
              <NomeComItens nome={nome} icone={pf?.icone} placa={pf?.placa}
                corNome={BENEFICIOS[simulado].corNome ? corNome : null} className="text-lg font-extrabold text-white" />
            </div>
            <p className="text-[#8a8095] text-[12.5px]">@{user?.username}</p>
            <SeloPlano usuario={{ plano: simulado }} className="mt-2" />
            <FaixaConquistas userId={user?.id} className="mt-3" />
            {extra.jogando && <div className="mt-3"><JogandoAgora nome={extra.jogando.nome} desde={extra.jogando.desde} /></div>}
            {(pf?.customStatus || pf?.bio) && (
              <div className="mt-3 rounded-xl bg-[var(--th-panel-2)] px-3 py-2.5 space-y-1">
                {pf?.customStatus && <p className="text-[13px] text-[#e3dbeb] break-words">{pf.customStatus}</p>}
                {pf?.bio && <p className="text-[12px] text-[#a99cb8] whitespace-pre-line break-words">{pf.bio}</p>}
              </div>
            )}
            <div className="mt-3"><SecoesPerfilGamer perfil={previa} onEditar={pular} /></div>
          </div>
        </div>
        {simulado !== meuPlano && (
          <p className="text-[12px] text-center text-[#a99cb8]">
            Prévia do {simulado === 'gratis' ? 'Grátis' : NOME_PLANO[simulado]}. {NIVEL[simulado] > NIVEL[meuPlano] && <Link href="/app/planos" className="font-bold text-[#8ff0ff] hover:underline">Ver planos</Link>}
          </p>
        )}
      </aside>
    </div>
  );
}
