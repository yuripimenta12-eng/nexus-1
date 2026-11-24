'use client';
// Fundo "líquido" animado (referência: botão Liquid do 21st.dev / ui-layouts).
// Adaptado ao Nexus:
// - não precisa do pacote "motion/react" (a animação agora é CSS);
// - cada SVG tem um id de gradiente próprio (no original todos usavam o mesmo id, e vários
//   selos de cores diferentes na mesma tela ficavam com a cor do primeiro);
// - o gradiente é desenhado UMA vez e o "líquido" se mexe girando/deslizando as camadas com
//   animação de CSS (placa de vídeo). O original redesenhava 7 SVGs grandes a cada quadro:
//   1 selo animado derrubava a página de ~130 para 2 quadros por segundo.
import { useId } from 'react';

type ColorKey =
  | 'color1' | 'color2' | 'color3' | 'color4' | 'color5' | 'color6' | 'color7' | 'color8' | 'color9'
  | 'color10' | 'color11' | 'color12' | 'color13' | 'color14' | 'color15' | 'color16' | 'color17';

export type Colors = Record<ColorKey, string>;

// Caminho do gradiente (ida e volta), igual ao original
const TRANSFORMS = [
  'translate(287.5 280) rotate(-29.0546) scale(689.807 1000)',
  'translate(126.5 418.5) rotate(-64.756) scale(533.444 773.324)',
  'translate(264.5 339.5) rotate(-42.3022) scale(946.451 1372.05)',
  'translate(860.5 420) rotate(-153.984) scale(957.528 1388.11)',
  'translate(264.5 339.5) rotate(-42.3022) scale(946.451 1372.05)',
  'translate(126.5 418.5) rotate(-64.756) scale(533.444 773.324)',
  'translate(287.5 280) rotate(-29.0546) scale(689.807 1000)',
];

const paradas = (c: Colors): [number, string][] => [
  [0, c.color1], [0.188423, c.color2], [0.260417, c.color3], [0.328792, c.color4], [0.328892, c.color5],
  [0.328992, c.color1], [0.442708, c.color6], [0.537556, c.color7], [0.631738, c.color1], [0.725645, c.color8],
  [0.817779, c.color9], [0.84375, c.color10], [0.90569, c.color1], [1, c.color11],
];

function GradientSvg({ className, colors, passo }: { className: string; colors: Colors; passo: number }) {
  const id = 'liq' + useId().replace(/:/g, '');
  return (
    <svg className={className} width="1030" height="280" viewBox="0 0 1030 280" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="1030" height="280" rx="140" fill={`url(#${id})`} />
      <defs>
        {/* Cada camada fica num ponto diferente do caminho original do gradiente */}
        <radialGradient id={id} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={TRANSFORMS[passo % TRANSFORMS.length]}>
          {paradas(colors).map(([offset, cor]) => <stop key={offset} offset={offset} stopColor={cor} />)}
        </radialGradient>
      </defs>
    </svg>
  );
}

const CAMADAS = [
  'w-[443px] h-[121px] -translate-x-1/2 -translate-y-1/2 mix-blend-difference',
  'w-[443px] h-[121px] -translate-x-1/2 -translate-y-1/2 rotate-[164.971deg] mix-blend-difference',
  'w-[443px] h-[121px] -translate-x-[53%] -translate-y-[53%] rotate-[-11.61deg] mix-blend-difference',
  'w-[756px] h-[207px] -translate-x-1/2 -translate-y-[57%] rotate-[-179.012deg] mix-blend-difference',
  'w-[756px] h-[207px] -translate-x-[57%] -translate-y-1/2 rotate-[-29.722deg] mix-blend-difference',
  'w-[756px] h-[207px] -translate-x-[62%] -translate-y-[24%] rotate-[160.227deg] mix-blend-difference',
  'w-[756px] h-[207px] -translate-x-[67%] -translate-y-[29%] rotate-180 mix-blend-hard-light',
];

// isHovered: mexe mais devagar (como no original). parado: sem movimento (Modo leve).
export function Liquid({ isHovered, colors, parado }: { isHovered: boolean; colors: Colors; parado?: boolean }) {
  return (
    <>
      {CAMADAS.map((c, i) => (
        <div key={i} className={`absolute top-1/2 left-1/2 ${c}`}>
          <div className="nx-liquido h-full w-full"
            style={{
              animationDuration: `${(isHovered ? 2.5 : 1) * (8 + i * 1.7)}s`,
              animationDelay: `-${i * 1.3}s`,
              animationDirection: i % 2 ? 'alternate-reverse' : 'alternate',
              animationPlayState: parado ? 'paused' : 'running',
            }}>
            <GradientSvg className="w-full h-full" colors={colors} passo={i} />
          </div>
        </div>
      ))}
    </>
  );
}
