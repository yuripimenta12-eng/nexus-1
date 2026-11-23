// Parar as animações é escolha do Nexus (Modo leve, ou Modo jogo com um jogo aberto),
// que liga a classe "nx-leve" no <html>. O "mostrar animações" do Windows NÃO conta:
// muita gente desliga isso no "melhor desempenho" e o Nexus ficava todo parado sem a pessoa saber.
export function menosMovimento(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('nx-leve');
}

/** O Windows/sistema pede menos animação? (só para avisar nas Configurações) */
export function sistemaPedeMenosMovimento(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
