'use client';

import { usePrefsStore } from '@/stores/prefs.store';

// Som curto de notificação gerado por WebAudio (sem depender de arquivo)
export function playPing() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    [[880, 0], [1174.66, 0.09]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch { /* autoplay bloqueado — ok */ }
}

export function showDesktopNotification(title: string, body: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/nexus-logo.png', silent: true });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* sem suporte */ }
}

// Notifica uma mensagem recebida respeitando as preferências do usuário.
// Só dispara quando a janela não está em foco (para não incomodar em uso ativo).
export function notifyIncomingMessage(senderName: string, content: string) {
  const { notifDesktop, notifSound } = usePrefsStore.getState();
  const unfocused = typeof document !== 'undefined' && (document.hidden || !document.hasFocus());
  if (!unfocused) return;
  if (notifSound) playPing();
  if (notifDesktop) {
    showDesktopNotification(
      `Nova mensagem de ${senderName}`,
      content.length > 80 ? `${content.slice(0, 80)}…` : content,
    );
  }
}
