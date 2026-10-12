'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useSpring, useTransform, useVelocity, type PanInfo } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COR_HEX, FacesCarta, nomeCarta } from '../carta';
import type { Carta } from '../unidos.store';
import { audio, vibrar } from '../efeitos/audio';
import type { ModoEfeitos } from '../efeitos/config';
import { pontoDe, rectDe } from '../efeitos/posicoes';

const MOLA = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 } as const;

export type EstadoArrasto = 'nao' | 'arrastando' | 'sobre';

interface Pos { x: number; y: number; rot: number }

// Posições do leque: espaçamento automático, giro leve e uma curvinha,
// sempre deixando o canto de cada carta à vista
function leque(n: number, w: number, largura: number): { pos: Pos[]; passo: number; total: number } {
  const espaco = Math.max(w, largura - 24);
  let passo = n > 1 ? Math.min(w * 0.7, (espaco - w) / (n - 1)) : 0;
  passo = Math.max(passo, w * 0.24);
  const meio = (n - 1) / 2;
  const ang = n > 1 ? Math.min(28, n * 3.2) / (n - 1) : 0;
  const curva = Math.min(18, n * 2);
  const pos = Array.from({ length: n }, (_, i) => {
    const t = meio ? (i - meio) / meio : 0;
    return { x: (i - meio) * passo, y: (t * t - 1) * curva, rot: (i - meio) * ang }; // o meio sobe, as pontas ficam na base
  });
  return { pos, passo, total: (n - 1) * passo + w };
}

function corBrilho(c: Carta) {
  return c.cor ? COR_HEX[c.cor].base : '#A56BFF';
}

interface PropsCarta {
  c: Carta; i: number; w: number; pos: Pos; z: number;
  pode: boolean; minhaVez: boolean; apagada: boolean;
  sobe: number; escala: number; giro: number; destaque: boolean;
  selecionada: boolean; pendente: boolean; erro: boolean;
  novo: { x: number; y: number; atraso: number } | null;
  arrastavel: boolean; modo: ModoEfeitos;
  registrar: (i: number, el: HTMLButtonElement | null) => void;
  onFoco: (i: number | null) => void;
  onAcionar: (c: Carta, el: HTMLElement) => void;
  onConfirmar: (c: Carta, el: HTMLElement) => void;
  onTecla: (e: React.KeyboardEvent, i: number) => void;
  onArrasto: (c: Carta, fase: 'inicio' | 'movendo' | 'fim', e: PointerEvent | MouseEvent | TouchEvent, el: HTMLElement, info?: PanInfo) => void;
  tremer: number; // muda para tremer esta carta (jogada recusada)
  voltar: number; // muda para a carta voltar ao leque (soltou fora da pilha)
}

function CartaMao(p: PropsCarta) {
  const { c, w } = p;
  const h = w * 1.5;
  const btn = useRef<HTMLButtonElement>(null);
  // Arrasto: inclina conforme a velocidade da mão
  const dx = useMotionValue(0);
  const dy = useMotionValue(0);
  const vel = useVelocity(dx);
  const inclina = useSpring(useTransform(vel, [-1400, 0, 1400], [-18, 0, 18]), { stiffness: 300, damping: 28 });
  const [arrastando, setArrastando] = useState(false);
  const arrastou = useRef(false); // depois de arrastar, o "toque" do soltar não conta como clique

  // Recusada: volta para o lugar e treme de lado (ou só pisca, sem tremor)
  useEffect(() => {
    if (!p.tremer) return;
    animate(dx, 0, MOLA);
    animate(dy, 0, MOLA);
    if (p.modo.tremor) animate(dx, [0, -9, 9, -6, 6, -2, 0], { duration: 0.34 });
  }, [p.tremer]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!p.voltar) return;
    animate(dx, 0, MOLA);
    animate(dy, 0, MOLA);
  }, [p.voltar]); // eslint-disable-line react-hooks/exhaustive-deps

  const brilho = corBrilho(c);
  const sombra = p.destaque && p.pode
    ? `0 0 0 2px ${brilho}, 0 0 26px 5px ${brilho}99, 0 ${18 + p.sobe * 0.4}px 30px rgba(0,0,0,.55)`
    : p.destaque
      ? `0 ${12 + p.sobe * 0.4}px 24px rgba(0,0,0,.5)`
      : '0 6px 16px rgba(0,0,0,.45)';

  return (
    <motion.div
      className="absolute bottom-0"
      style={{ left: `calc(50% - ${w / 2}px)`, width: w, height: h, zIndex: arrastando ? 200 : p.z }}
      initial={p.novo ? { x: p.novo.x, y: p.novo.y, rotate: -25, scale: 0.6, opacity: 0 } : false}
      animate={{ x: p.pos.x, y: p.pos.y - p.sobe, rotate: p.giro, scale: p.escala, opacity: 1 }}
      transition={p.novo ? { ...MOLA, delay: p.novo.atraso, opacity: { duration: 0.12, delay: p.novo.atraso } } : MOLA}
    >
      {/* Confirmar a jogada da carta selecionada */}
      {(p.selecionada || p.pendente) && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          onClick={() => btn.current && p.onConfirmar(c, btn.current)}
          disabled={p.pendente}
          className="absolute left-1/2 -translate-x-1/2 -top-10 h-8 px-3 rounded-full text-[12px] font-black flex items-center gap-1.5 whitespace-nowrap text-[#120a22] bg-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff6a00]"
          aria-label={`Jogar ${nomeCarta(c)}`}
        >
          {p.pendente ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</> : <><Check className="w-3.5 h-3.5" /> Jogar</>}
        </motion.button>
      )}
      <motion.button
        ref={(el) => { (btn as any).current = el; p.registrar(p.i, el); }}
        type="button"
        data-carta-id={c.id}
        className={cn('relative block rounded-[10px] outline-none touch-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#120a22]',
          p.pode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default')}
        style={{ x: dx, y: dy, rotate: arrastando ? inclina : 0, width: w, height: h, transformStyle: 'preserve-3d' }}
        drag={p.arrastavel}
        dragMomentum={false}
        dragElastic={0.9}
        onPointerDown={() => { arrastou.current = false; }}
        onDragStart={(e, info) => { arrastou.current = true; setArrastando(true); p.onArrasto(c, 'inicio', e, btn.current!, info); }}
        onDrag={(e, info) => p.onArrasto(c, 'movendo', e, btn.current!, info)}
        onDragEnd={(e, info) => {
          setArrastando(false);
          p.onArrasto(c, 'fim', e, btn.current!, info);
        }}
        onTap={() => { if (!arrastou.current && btn.current) p.onAcionar(c, btn.current); }}
        onKeyDown={(e) => p.onTecla(e, p.i)}
        onFocus={() => p.onFoco(p.i)}
        onBlur={() => p.onFoco(null)}
        onHoverStart={() => p.onFoco(p.i)}
        onHoverEnd={() => p.onFoco(null)}
        aria-label={`${nomeCarta(c)}${p.pode ? '' : p.minhaVez ? ', não combina com a mesa' : ''}${p.selecionada ? ', selecionada: aperte Enter para jogar' : ''}`}
        aria-pressed={p.selecionada}
        aria-disabled={!p.pode}
      >
        {/* Virada: só eu vejo a frente; ao comprar ela chega de costas e vira */}
        <motion.div className="relative w-full h-full" style={{ transformStyle: 'preserve-3d', borderRadius: w * 0.075, boxShadow: sombra, transition: 'box-shadow .18s' }}
          initial={p.novo && p.modo.movimento ? { rotateY: 180 } : false}
          animate={{ rotateY: 0 }}
          transition={{ duration: 0.45, delay: p.novo ? p.novo.atraso + 0.12 : 0, ease: 'easeOut' }}>
          <FacesCarta carta={c} tamanho={w} jogavel={p.pode && !p.selecionada} apagada={p.apagada} />
        </motion.div>
        {p.selecionada && !p.pendente && (
          <span className="absolute -inset-[3px] rounded-[12px] pointer-events-none unidos-contorno" style={{ ['--unidos-cor' as any]: brilho }} aria-hidden />
        )}
        {p.erro && <span className="absolute -inset-[3px] rounded-[12px] pointer-events-none border-[3px] border-[#ff4d6d] shadow-[0_0_18px_#ff4d6d]" aria-hidden />}
        {p.pendente && (
          <span className="absolute inset-0 grid place-items-center rounded-[10px] bg-black/25" aria-hidden>
            <Loader2 className="w-6 h-6 text-white animate-spin drop-shadow" />
          </span>
        )}
      </motion.button>
    </motion.div>
  );
}

export function Mao({ cartas, jogaveis, minhaVez, ocupado, umClique, modo, tamanho, distribuir, aoJogar, aoArrastar, avisar }: {
  cartas: Carta[];
  jogaveis: Set<string>;
  minhaVez: boolean;
  ocupado: boolean;            // esperando resposta do servidor
  umClique: boolean;
  modo: ModoEfeitos;
  tamanho: number;
  distribuir?: boolean;        // a partida acabou de começar: as cartas chegam do monte
  aoJogar: (c: Carta, el: HTMLElement) => Promise<boolean>; // só resolve depois do servidor (ou cancelar)
  aoArrastar: (e: EstadoArrasto) => void;
  avisar: (msg: string) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(800);
  // Só desenha as cartas depois de medir a caixa (antes de pintar a tela),
  // para as que chegam saírem do lugar certo do monte
  const [pronto, setPronto] = useState(false);
  const [foco, setFoco] = useState<number | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [pendente, setPendente] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tremer, setTremer] = useState<Record<string, number>>({});
  const [voltar, setVoltar] = useState<Record<string, number>>({});
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const sobrePilha = useRef(false);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    setLargura(el.clientWidth);
    setPronto(true);
    const ro = new ResizeObserver(() => setLargura(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cartas novas (compra ou distribuição): saem do monte e viram na mão
  const vistas = useRef<Set<string> | null>(distribuir ? new Set() : null);
  const novas = new Map<string, number>();
  if (vistas.current) {
    let k = 0;
    for (const c of cartas) if (!vistas.current.has(c.id)) novas.set(c.id, k++);
  }
  useEffect(() => { if (pronto) vistas.current = new Set(cartas.map(c => c.id)); }, [cartas, pronto]);

  // Seleção some se a carta saiu da mão ou deixou de valer
  useEffect(() => {
    if (selecionada && (!cartas.some(c => c.id === selecionada) || !jogaveis.has(selecionada))) setSelecionada(null);
    if (pendente && !cartas.some(c => c.id === pendente)) setPendente(null);
  }, [cartas, jogaveis, selecionada, pendente]);

  const w = tamanho;
  const { pos, total } = leque(cartas.length, w, largura);
  const larguraInterna = Math.max(largura, total + 24);
  const passoReal = cartas.length > 1 ? Math.abs(pos[1].x - pos[0].x) : w;

  const recusar = (c: Carta, msg?: string) => {
    audio.tocar('invalido');
    vibrar(30);
    setTremer(t => ({ ...t, [c.id]: (t[c.id] || 0) + 1 }));
    if (!modo.tremor) { setErro(c.id); setTimeout(() => setErro(e => (e === c.id ? null : e)), 450); }
    if (msg) avisar(msg);
  };

  const jogar = async (c: Carta, el: HTMLElement) => {
    if (ocupado || pendente) return;
    setPendente(c.id);
    setSelecionada(c.id);
    const ok = await aoJogar(c, el);
    if (!ok) {
      setPendente(null);
      setSelecionada(null);
      recusar(c);
      return;
    }
    // Confirmado: continua "enviando" até o estado novo tirar a carta da mão
    setTimeout(() => setPendente(p => (p === c.id ? null : p)), 2000);
  };

  const acionar = (c: Carta, el: HTMLElement) => {
    audio.destravar();
    if (pendente) return;
    if (!minhaVez) return recusar(c, 'Espere a sua vez');
    if (!jogaveis.has(c.id)) return recusar(c, 'Essa carta não combina com a mesa');
    if (umClique || selecionada === c.id) { jogar(c, el); return; }
    setSelecionada(c.id);
    audio.tocar('selecionar');
    vibrar(8);
  };

  const onTecla = (e: React.KeyboardEvent, i: number) => {
    const ir = (k: number) => { e.preventDefault(); botoes.current[Math.max(0, Math.min(cartas.length - 1, k))]?.focus(); };
    if (e.key === 'ArrowRight') ir(i + 1);
    else if (e.key === 'ArrowLeft') ir(i - 1);
    else if (e.key === 'Home') ir(0);
    else if (e.key === 'End') ir(cartas.length - 1);
    else if (e.key === 'Escape') setSelecionada(null);
    // Enter já vira "toque" pelo framer-motion; o espaço tratamos aqui
    else if (e.key === ' ') { e.preventDefault(); acionar(cartas[i], e.currentTarget as HTMLElement); }
  };

  const onArrasto = (c: Carta, fase: 'inicio' | 'movendo' | 'fim', e: PointerEvent | MouseEvent | TouchEvent, el: HTMLElement) => {
    const pt = 'clientX' in e ? { x: e.clientX, y: e.clientY } : { x: e.changedTouches?.[0]?.clientX ?? 0, y: e.changedTouches?.[0]?.clientY ?? 0 };
    if (fase === 'inicio') { audio.destravar(); audio.tocar('selecionar'); setSelecionada(c.id); aoArrastar('arrastando'); return; }
    const r = rectDe('pilha');
    const folga = 40;
    const sobre = !!r && pt.x > r.left - folga && pt.x < r.right + folga && pt.y > r.top - folga && pt.y < r.bottom + folga;
    if (fase === 'movendo') {
      if (sobre !== sobrePilha.current) { sobrePilha.current = sobre; aoArrastar(sobre ? 'sobre' : 'arrastando'); }
      return;
    }
    sobrePilha.current = false;
    aoArrastar('nao');
    if (sobre) jogar(c, el);
    else {
      // Soltou fora da pilha: volta suave para o leque
      setVoltar(t => ({ ...t, [c.id]: (t[c.id] || 0) + 1 }));
      setSelecionada(null);
    }
  };

  // Origem das cartas que chegam: o monte, em coordenadas da caixa da mão
  const monte = pontoDe('monte');
  const cx = caixa.current ? caixa.current.getBoundingClientRect() : null;
  const origem = monte && cx ? {
    x: monte.x - (cx.left + cx.width / 2 - caixa.current!.scrollLeft + (larguraInterna - cx.width) / 2),
    y: monte.y - (cx.bottom - 8 - w * 0.75),
  } : { x: 0, y: -200 };

  return (
    // Só rola de lado quando a mão não cabe (rolagem corta o que sai da caixa,
    // e as cartas chegando do monte precisam aparecer no caminho)
    <div ref={caixa} className={cn('relative w-full nx-no-scrollbar', larguraInterna > largura + 1 ? 'overflow-x-auto' : 'overflow-visible')} data-unidos-alvo="mao"
      role="group" aria-label={`Sua mão: ${cartas.length} cartas. Use as setas para escolher e Enter para jogar.`}
      onMouseLeave={() => setFoco(null)}>
      <div className="relative mx-auto" style={{ width: larguraInterna, height: w * 1.5 + 54, paddingTop: 46 }}>
        <div className="absolute inset-x-0 bottom-2" style={{ height: w * 1.5 }}>
          {pronto && cartas.map((c, i) => {
            const pode = minhaVez && jogaveis.has(c.id);
            const sel = selecionada === c.id;
            const pend = pendente === c.id;
            const emFoco = foco === i;
            // Afasta as vizinhas da carta em foco quando o leque está apertado
            const afasta = foco !== null && !emFoco && passoReal < w * 0.55 ? Math.sign(i - foco) * Math.min(w * 0.22, (w * 0.55 - passoReal) * 0.7) : 0;
            const sobe = sel || pend ? 30 : emFoco ? (pode ? 18 : 8) : pode ? 6 : 0;
            const ordem = novas.get(c.id);
            return (
              <CartaMao key={c.id}
                c={c} i={i} w={w}
                pos={{ ...pos[i], x: pos[i].x + afasta }}
                z={sel || pend ? 120 : emFoco ? 110 : i}
                pode={pode} minhaVez={minhaVez} apagada={minhaVez && !pode}
                sobe={sobe} escala={sel || pend ? 1.1 : emFoco ? 1.07 : 1}
                giro={sel || pend ? 0 : emFoco ? pos[i].rot * 0.3 : pos[i].rot}
                destaque={emFoco || sel || pend}
                selecionada={sel} pendente={pend} erro={erro === c.id}
                novo={ordem !== undefined ? { ...origem, atraso: ordem * (novas.size > 4 ? 0.07 : 0.12) } : null}
                arrastavel={pode && !ocupado && !pendente}
                modo={modo}
                registrar={(k, el) => { botoes.current[k] = el; }}
                onFoco={setFoco}
                onAcionar={acionar}
                onConfirmar={(cc, el) => jogar(cc, el)}
                onTecla={onTecla}
                onArrasto={onArrasto}
                tremer={tremer[c.id] || 0}
                voltar={voltar[c.id] || 0}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
