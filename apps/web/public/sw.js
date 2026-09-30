// Service worker do Nexus — deixa o app instalável e recebe as notificações
// com o Nexus fechado (Web Push).
// Não guarda cache do app: sempre busca da rede (evita versão velha presa).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // passthrough: o navegador segue o fluxo normal de rede
});

// Chegou um aviso do servidor (mensagem direta ou menção)
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data && event.data.text() }; }
  const title = data.title || 'Nexus';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Você tem uma nova mensagem',
      icon: data.icon || '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || '/app' },
    }),
  );
});

// Tocou na notificação: reaproveita uma janela do Nexus aberta ou abre uma nova
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/app', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
        await w.focus();
        if ('navigate' in w) await w.navigate(url).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
