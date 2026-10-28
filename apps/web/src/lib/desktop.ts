// O app de PC (Electron, apps/desktop) acrescenta "NexusDesktop/<versão>" ao user agent
export function isDesktopApp(): boolean {
  return typeof navigator !== 'undefined' && /NexusDesktop\//.test(navigator.userAgent);
}

interface DesktopBridge {
  getGame?: () => Promise<string | null>;
  onGame?: (cb: (name: string | null) => void) => () => void;
  getUpdate?: () => Promise<string | null>;
  onUpdate?: (cb: (version: string | null) => void) => () => void;
  installUpdate?: () => void;
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

// Atualização do app de PC (1.5.0+): avisa quando a versão nova já foi
// baixada. Versões antigas do app não têm a função: nada acontece.
export function watchAppUpdate(cb: (version: string) => void): () => void {
  const b = bridge();
  if (!b?.onUpdate || !b.getUpdate) return () => {};
  const off = b.onUpdate(v => { if (v) cb(v); });
  b.getUpdate().then(v => { if (v) cb(v); }).catch(() => {});
  return off;
}

export function installAppUpdate() {
  bridge()?.installUpdate?.();
}
