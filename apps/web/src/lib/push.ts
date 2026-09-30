'use client';

import api from '@/lib/api';

// Notificações com o Nexus fechado (Web Push).
// A inscrição fica no navegador/aparelho; o servidor só guarda o endereço dela
// ligado à conta logada. No iPhone só funciona com o Nexus instalado na tela
// de início (Compartilhar → Adicionar à Tela de Início), iOS 16.4+.

export type PushSupport = 'ok' | 'unsupported' | 'ios-needs-install';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
    return isIos && !standalone ? 'ios-needs-install' : 'unsupported';
  }
  if (isIos && !standalone) return 'ios-needs-install';
  return 'ok';
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function registration() {
  // o PwaRegister já registra /sw.js; aqui garantimos que está pronto
  await navigator.serviceWorker.register('/sw.js').catch(() => {});
  return navigator.serviceWorker.ready;
}

async function sendToServer(sub: PushSubscription) {
  const json = sub.toJSON();
  await api.post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys });
}

export async function isPushEnabled(): Promise<boolean> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return false;
  const reg = await registration();
  return !!(await reg.pushManager.getSubscription());
}

// Liga: pede permissão (precisa vir de um toque do usuário) e inscreve
export async function enablePush(): Promise<'ok' | 'denied' | 'unsupported'> {
  if (pushSupport() !== 'ok') return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data } = await api.get('/push/public-key');
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });
  }
  await sendToServer(sub);
  return 'ok';
}

export async function disablePush() {
  if (pushSupport() !== 'ok') return;
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

// Ao abrir o app logado: se este aparelho já tem inscrição, reafirma para a
// conta atual (cobre troca de conta no mesmo aparelho e renovação da inscrição)
export async function syncPush() {
  try {
    if (!(await isPushEnabled())) return;
    const reg = await registration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sendToServer(sub);
  } catch { /* opcional */ }
}

// No logout: este aparelho para de receber avisos da conta que saiu
// (a inscrição do navegador continua; volta a valer no próximo login)
export async function detachPushFromAccount() {
  try {
    if (pushSupport() !== 'ok') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
  } catch { /* opcional */ }
}
