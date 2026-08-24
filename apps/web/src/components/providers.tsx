'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useSocketStore } from '@/stores/socket.store';
import { usePrefsStore, applyAccent } from '@/stores/prefs.store';
import { Toaster } from '@/components/ui/toaster';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, accessToken, refreshUser } = useAuthStore();
  const accent = usePrefsStore(s => s.accent);
  const initialized = useRef(false);

  // Tema de acento escolhido em Aparência
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Reconecta sessão ao recarregar a página
    if (isAuthenticated && accessToken) {
      refreshUser();
      // Use socket store so DM handlers (dm:new, dm:updated, dm:deleted)
      // are registered globally on page load / refresh
      useSocketStore.getState().init(accessToken);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
