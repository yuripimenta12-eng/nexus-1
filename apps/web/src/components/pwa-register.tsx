'use client';

import { useEffect } from 'react';

// Registra o service worker (torna o Nexus instalável como app)
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // sem service worker o site continua funcionando normalmente
      });
    }
  }, []);
  return null;
}
