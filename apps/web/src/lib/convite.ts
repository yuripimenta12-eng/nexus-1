// Links de convite do Nexus (…/invite/CÓDIGO): achar no texto das mensagens,
// ler o que a pessoa colou e avisar a lista de servidores quando entrar num novo.

const CODIGO = '[A-Za-z0-9_-]{4,32}';

// Domínios em que um link /invite/ é um convite do Nexus
function hostsDoNexus(): string[] {
  const hosts = ['nexuslink.art', 'www.nexuslink.art'];
  if (typeof window !== 'undefined' && window.location.host) hosts.push(window.location.host);
  return hosts;
}

function escapar(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** É um link de convite do próprio Nexus? Devolve o código (ou null). */
export function codigoDoLinkDeConvite(url: string): string | null {
  const hosts = hostsDoNexus().map(escapar).join('|');
  const m = url.match(new RegExp(`^https?://(?:${hosts})/(?:app/)?invite/(${CODIGO})/?$`, 'i'));
  return m ? m[1] : null;
}

/** Códigos de convite encontrados numa mensagem (sem repetir, no máximo 3) */
export function codigosDeConviteNoTexto(texto: string | null | undefined): string[] {
  if (!texto || !texto.includes('/invite/')) return [];
  const achados = new Set<string>();
  for (const url of texto.match(/https?:\/\/[^\s<>"']+/g) || []) {
    const c = codigoDoLinkDeConvite(url.replace(/[.,!?;:)\]]+$/, ''));
    if (c) achados.add(c);
    if (achados.size >= 3) break;
  }
  return Array.from(achados);
}

/** O que a pessoa colou (link inteiro ou só o código) → código, ou null */
export function lerCodigoColado(entrada: string): string | null {
  const t = entrada.trim();
  if (!t) return null;
  const doLink = t.match(new RegExp(`/invite/(${CODIGO})(?:[/?#].*)?$`));
  if (doLink) return doLink[1];
  return new RegExp(`^${CODIGO}$`).test(t) ? t : null;
}

/** Pede para a barra de servidores (à esquerda) recarregar a lista */
export function avisarServidoresMudaram() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('nexus:servers-changed'));
}
