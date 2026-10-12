'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useVoiceStore } from '@/stores/voice.store';
import { cn } from '@/lib/utils';
import { useUnidos, type Tipo } from '../unidos.store';
import {
  cartaAleatoria, comprarSim, criarSim, forcarJogada, gritarSim, jogadaDoBot, jogarSim, mexer, passarSim, pegarSim, visaoSim, type Sim,
} from './simulador';

// Painel da página de demonstração: dispara cada efeito do UNidos numa mesa
// simulada no navegador (nada vai para o servidor).
export function PainelDemo() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const emChamada = useVoiceStore(s => s.isConnected);
  const meuId = user?.id || 'eu';
  const sim = useRef<Sim | null>(null);
  const timerBot = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aberto, setAberto] = useState(true);
  const [bots, setBots] = useState(true);
  const [falhar, setFalhar] = useState(false);
  const [latencia, setLatencia] = useState(250);
  const [jogadores, setJogadores] = useState(4);
  const op = useRef({ bots, falhar, latencia });
  op.current = { bots, falhar, latencia };

  const publicar = (s: Sim) => {
    sim.current = s;
    useUnidos.setState({ partida: visaoSim(s, meuId) });
    if (timerBot.current) clearTimeout(timerBot.current);
    if (op.current.bots && s.status === 'jogando' && s.jogadores[s.vez].id !== meuId) {
      timerBot.current = setTimeout(() => { if (sim.current) publicar(jogadaDoBot(sim.current)); }, 1400);
    }
  };
  const resultado = (r: Sim | string) => {
    if (typeof r === 'string') { useUnidos.setState({ erro: r }); return false; }
    publicar(r);
    return true;
  };

  useEffect(() => {
    if (emChamada || !user) return;
    const original = useUnidos.getState();
    const salvo = { acao: original.acao, sair: original.sair, voiceRoomId: original.voiceRoomId };
    const participantes = useVoiceStore.getState().participants;
    const eu = { id: meuId, nome: user.profile?.displayName || user.username || 'Você', avatarUrl: user.profile?.avatarUrl || null };
    useUnidos.setState({
      voiceRoomId: 'demo', sala: null, aberta: true, erro: null,
      acao: async (evento, dados: any = {}) => {
        await new Promise(r => setTimeout(r, op.current.latencia));
        if (op.current.falhar) { useUnidos.setState({ erro: 'Falha simulada do servidor: a carta voltou para a mão' }); return false; }
        const s = sim.current!;
        switch (evento) {
          case 'jogar': return resultado(jogarSim(s, meuId, dados.cartaId, { cor: dados.cor, alvoId: dados.alvoId }));
          case 'comprar': return resultado(comprarSim(s, meuId));
          case 'passar': return resultado(passarSim(s, meuId));
          case 'gritar': return resultado(gritarSim(s, meuId));
          case 'pegar': return resultado(pegarSim(s, meuId, dados.alvoId));
          case 'revanche': publicar(criarSim(eu, s.jogadores.length)); return true;
          default: return true;
        }
      },
      sair: async () => { router.push('/app'); },
    });
    // Na demo o tempo da vez não acaba: quando zera, renova
    const relogio = setInterval(() => {
      const x = sim.current;
      if (x && x.status === 'jogando' && x.prazo < Date.now()) publicar({ ...x, prazo: Date.now() + 30_000 });
    }, 1000);
    const inicial = criarSim(eu, jogadores);
    // Primeiro mostra a mesa esperando; depois "começa", para ver a distribuição
    publicar({ ...inicial, status: 'lobby', seq: 0 });
    setTimeout(() => publicar(inicial), 400);
    return () => {
      if (timerBot.current) clearTimeout(timerBot.current);
      clearInterval(relogio);
      useVoiceStore.setState({ participants: participantes } as any);
      useUnidos.setState({ partida: null, aberta: false, erro: null, ...salvo });
    };
  }, [emChamada, user?.id, jogadores]); // eslint-disable-line react-hooks/exhaustive-deps

  if (emChamada) {
    return (
      <div className="m-6 max-w-md rounded-2xl border border-white/10 bg-[#140d22] p-5 text-white">
        <p className="font-black">Demonstração do UNidos</p>
        <p className="text-sm text-[#a99cb8] mt-1">Saia da chamada de voz para usar a demonstração (ela simula uma mesa só no seu navegador).</p>
      </div>
    );
  }

  const s = () => sim.current!;
  const id = (k: number) => s().jogadores[k % s().jogadores.length].id;
  const ana = () => id(1);
  const beto = () => id(2);
  const caio = () => id(3);
  const especial = (tipo: Tipo, alvo?: string) => publicar(forcarJogada(s(), ana(), tipo, { alvoId: alvo }));

  const grupos: { titulo: string; botoes: [string, () => void][] }[] = [
    {
      titulo: 'Cartas especiais (Ana joga)',
      botoes: [
        ['Bloqueio', () => especial('bloqueio')],
        ['Troca (inverte)', () => especial('troca')],
        ['+2', () => especial('mais2')],
        ['Call → você', () => especial('call', meuId)],
        ['Conexão', () => especial('conexao')],
        ['Todos Unidos +4', () => especial('todosunidos')],
      ],
    },
    {
      titulo: 'Comprar',
      botoes: [
        ['Eu compro 1', () => resultado(comprarSim(mexer(s(), x => { x.vez = 0; x.comprada = null; x.acumulado = 0; }), meuId))],
        ['Eu compro 4', () => resultado(comprarSim(mexer(s(), x => { x.vez = 0; x.comprada = null; x.acumulado = 4; x.topo = cartaAleatoria('todosunidos'); }), meuId))],
        ['Beto compra 2', () => publicar(mexer(s(), x => { const j = x.jogadores.find(p => p.id === beto())!; j.mao.push(cartaAleatoria(), cartaAleatoria()); x.ultima = { jogadorId: j.id, acao: 'comprou', qtd: 2 }; }))],
        ['Me dar especiais', () => publicar(mexer(s(), x => {
          x.jogadores[0].mao.push(...(['bloqueio', 'troca', 'mais2', 'call', 'conexao', 'todosunidos'] as Tipo[]).map(t => cartaAleatoria(t, x.corAtual)));
          x.vez = 0; x.comprada = null; x.acumulado = 0; x.prazo = Date.now() + 30_000;
        }))],
      ],
    },
    {
      titulo: 'Jogadores e vez',
      botoes: [
        ['Minha vez', () => publicar(mexer(s(), x => { x.vez = 0; x.comprada = null; x.acumulado = 0; x.prazo = Date.now() + 30_000; }))],
        ['Passar para o próximo', () => publicar(mexer(s(), x => { const q = x.jogadores.length; x.vez = (((x.vez + x.sentido) % q) + q) % q; x.comprada = null; x.prazo = Date.now() + 30_000; }))],
        ['Tempo acabando', () => publicar(mexer(s(), x => { x.vez = 0; x.prazo = Date.now() + 7_000; }))],
        ['Beto: última carta', () => publicar(forcarJogada(mexer(s(), x => { const j = x.jogadores.find(p => p.id === beto())!; j.mao = j.mao.slice(0, 2); }), beto(), 'numero'))],
        ['Caio grita UNidos!', () => { const x = mexer(s(), y => { const j = y.jogadores.find(p => p.id === caio())!; j.mao = j.mao.slice(0, 2); }); const r = gritarSim(x, caio()); resultado(r); }],
        ['Caio cai / volta', () => publicar(mexer(s(), x => { const j = x.jogadores.find(p => p.id === caio()); if (j) j.ausente = !j.ausente; }))],
        ['Ana falando', () => {
          const m = new Map(useVoiceStore.getState().participants);
          const atual = m.get(ana()) as any;
          m.set(ana(), { identity: ana(), isSpeaking: !atual?.isSpeaking, micEnabled: true, camEnabled: false, screenSharing: false, localVolume: 1 } as any);
          useVoiceStore.setState({ participants: m } as any);
        }],
      ],
    },
    {
      titulo: 'Fim de partida',
      botoes: [
        ['Eu venço', () => {
          const x = mexer(s(), y => { const c = cartaAleatoria('numero', y.corAtual); y.jogadores[0].mao = [c]; y.vez = 0; y.comprada = null; y.acumulado = 0; });
          resultado(jogarSim(x, meuId, x.jogadores[0].mao[0].id));
        }],
        ['Ana vence', () => {
          const x = mexer(s(), y => { const j = y.jogadores.find(p => p.id === ana())!; j.mao = [cartaAleatoria('numero', y.corAtual)]; y.vez = y.jogadores.indexOf(j); y.comprada = null; y.acumulado = 0; });
          resultado(jogarSim(x, ana(), x.jogadores[1].mao[0].id));
        }],
      ],
    },
  ];

  return (
    <div className="fixed z-[80] left-3 top-[calc(env(safe-area-inset-top)+64px)] w-[270px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#F2C35B]/30 bg-[#140d22]/95 text-white shadow-2xl backdrop-blur">
      <button onClick={() => setAberto(a => !a)} className="w-full flex items-center gap-2 px-3 h-10 font-black text-[13px]">
        <FlaskConical className="w-4 h-4 text-[#F2C35B]" /> Demonstração de efeitos
        <span className="ml-auto">{aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {aberto && (
        <div className="px-3 pb-3 space-y-3 max-h-[64vh] overflow-y-auto">
          <p className="text-[11px] text-[#a99cb8]">Mesa simulada no seu navegador (não vai para o servidor). Jogue as suas cartas normalmente ou use os botões.</p>
          {grupos.map(g => (
            <div key={g.titulo}>
              <p className="text-[11px] font-bold text-[#cbb3ff] mb-1">{g.titulo}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {g.botoes.map(([rotulo, fn]) => (
                  <button key={rotulo} onClick={fn} className="h-8 px-2 rounded-lg text-[11.5px] font-semibold bg-white/[0.07] hover:bg-white/[0.14] text-left truncate">{rotulo}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="space-y-1.5 text-[12px]">
            <p className="text-[11px] font-bold text-[#cbb3ff]">Simulação</p>
            <label className="flex items-center gap-2"><input type="checkbox" checked={bots} onChange={e => setBots(e.target.checked)} /> Adversários jogam sozinhos</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={falhar} onChange={e => setFalhar(e.target.checked)} /> Servidor recusa a jogada</label>
            <label className="flex items-center gap-2">Atraso da rede
              <select value={latencia} onChange={e => setLatencia(Number(e.target.value))} className="ml-auto bg-white/10 rounded px-1 py-0.5">
                <option value={0}>0 ms</option><option value={250}>250 ms</option><option value={800}>800 ms</option><option value={1500}>1,5 s</option>
              </select>
            </label>
            <div className="flex gap-1.5">
              {[2, 4, 6].map(q => (
                <button key={q} onClick={() => setJogadores(q)} className={cn('flex-1 h-8 rounded-lg text-[12px] font-bold', jogadores === q ? 'bg-[#7A2CFF]' : 'bg-white/[0.07] hover:bg-white/[0.14]')}>{q} jogadores</button>
              ))}
            </div>
            <button onClick={() => useUnidos.setState({ aberta: true })} className="w-full h-8 rounded-lg text-[12px] font-bold bg-white/[0.07] hover:bg-white/[0.14]">Abrir a mesa de novo</button>
          </div>
        </div>
      )}
    </div>
  );
}
