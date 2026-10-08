// O app de PC (Electron, apps/desktop) acrescenta "NexusDesktop/<versão>" ao user agent
export function isDesktopApp(): boolean {
  return typeof navigator !== 'undefined' && /NexusDesktop\//.test(navigator.userAgent);
}

interface DesktopBridge {
  getGame?: () => Promise<string | null>;
  onGame?: (cb: (name: string | null) => void) => () => void;
}

function bridge(): DesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return ((window as any).nexusDesktop as DesktopBridge) || null;
}

// "Jogando …": o app de PC diz qual jogo está aberto e o site repassa ao
// servidor. Renova a cada minuto (o servidor esquece sozinho em 3 min se o
// app fechar). Versões antigas do app não têm a função: nada acontece.
export function startGameActivity(emit: (name: string | null) => void): () => void {
  const b = bridge();
  if (!b?.onGame || !b.getGame) return () => {};
  let current: string | null = null;
  const send = (name: string | null) => { current = name; emit(name); };
  const off = b.onGame(send);
  b.getGame().then(n => { if (n) send(n); }).catch(() => {});
  const t = setInterval(() => { if (current) emit(current); }, 60_000);
  return () => { off(); clearInterval(t); if (current) emit(null); };
}

export function currentGameResend(emit: (name: string | null) => void) {
  const b = bridge();
  b?.getGame?.().then(n => { if (n) emit(n); }).catch(() => {});
}
