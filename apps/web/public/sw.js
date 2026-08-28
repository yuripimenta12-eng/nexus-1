// Service worker mínimo do Nexus — só o suficiente para o app ser instalável.
// Não guarda cache do app: sempre busca da rede (evita versão velha presa).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // passthrough: o navegador segue o fluxo normal de rede
});
