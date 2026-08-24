'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { ServersSidebar } from '@/components/layout/servers-sidebar';
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, hasHydrated } = useAuthStore();

  useEffect(() => {
    // Espera o estado persistido carregar antes de decidir redirecionar,
    // senão todo reload cai no login mesmo com sessão válida
    if (hasHydrated && !isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, hasHydrated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Coluna de servidores (72px) */}
      <ErrorBoundary>
        <ServersSidebar />
      </ErrorBoundary>

      {/* Sidebar de canais */}
      <ErrorBoundary>
        <AppSidebar />
      </ErrorBoundary>

      {/* Conteúdo principal */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
