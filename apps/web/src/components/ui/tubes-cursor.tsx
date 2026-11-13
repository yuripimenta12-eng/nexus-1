'use client';

// Tubos de luz que seguem o mouse, no fundo do login e do cadastro.
// Fica atrás do conteúdo e não recebe cliques; clicar num espaço vazio troca as cores.
// Não liga no toque (sem mouse), com "reduzir movimento" ou sem WebGL.
import { useEffect, useRef } from 'react';

const CORES_TUBOS = ['#7a2cff', '#ff6a00', '#ff4f79'];
const CORES_LUZES = ['#b05cff', '#ff8a1f', '#21d4fd', '#ff4f79'];

const corAleatoria = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

export default function TubesCursor({ className = 'fixed inset-0 z-0' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const semMouse = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (semMouse || reduzir || document.documentElement.classList.contains('nx-leve')) return;

    let app: any = null;
    let vivo = true;
    // Espera o layout assentar: com o canvas sem tamanho a lib calcula raio NaN
    const t = setTimeout(() => {
      import('threejs-components/build/cursors/tubes1.min.js')
        .then(({ default: Tubes }) => {
          if (!vivo || !canvasRef.current) return;
          app = Tubes(canvasRef.current, { tubes: { colors: CORES_TUBOS, lights: { intensity: 200, colors: CORES_LUZES } } });
        })
        .catch(() => { /* sem WebGL: fica só o fundo normal */ });
    }, 100);

    const trocarCores = (e: MouseEvent) => {
      if (!app || (e.target as HTMLElement)?.closest('a, button, input, label, select, textarea, [role="button"]')) return;
      app.tubes.setColors(Array.from({ length: 3 }, corAleatoria));
      app.tubes.setLightsColors(Array.from({ length: 4 }, corAleatoria));
    };
    window.addEventListener('click', trocarCores);

    return () => {
      vivo = false;
      clearTimeout(t);
      window.removeEventListener('click', trocarCores);
      app?.dispose?.();
    };
  }, []);

  return (
    <div className={className} style={{ pointerEvents: 'none' }} aria-hidden>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
