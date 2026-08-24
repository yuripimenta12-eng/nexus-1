'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { ServersSidebar } from '@/components/layout/servers-sidebar';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, hasHydrated } = useAuthStore();
  const { mobileNavOpen, closeMobileNav, toggleMobileNav } = useUiStore();

  useEffect(() => {
    // Espera o estado persistido carregar antes de decidir redirecionar,
    // senão todo reload cai no login mesmo com sessão válida
    if (hasHydrated && !isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, hasHydrated, router]);

  // Fecha o menu mobile ao navegar para outra tela
  useEffect(() => { closeMobileNav(); }, [pathname, closeMobileNav]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Navegação (trilho + canais): fixa no desktop, gaveta no celular */}
      <div
        className={cn(
          'md:static md:flex md:translate-x-0',
          'fixed inset-y-0 left-0 z-50 flex transition-transform duration-200',
          mobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}
      >
        <ErrorBoundary>
          <ServersSidebar />
        </ErrorBoundary>
        <ErrorBoundary>
          <AppSidebar />
        </ErrorBoundary>
      </div>

      {/* Fundo escurecido atrás da gaveta (só mobile) */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={closeMobileNav}
        />
      )}

      {/* Botão flutuante de menu (só mobile) */}
      <button
        onClick={toggleMobileNav}
        className="md:hidden fixed bottom-4 left-4 z-50 w-12 h-12 rounded-2xl text-white
                   bg-gradient-to-br from-orange to-accent shadow-[0_8px_24px_rgba(0,0,0,0.5)]
                   flex items-center justify-center active:scale-95 transition-transform"
        title={mobileNavOpen ? 'Fechar menu' : 'Abrir menu'}
      >
        {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Conteúdo principal */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
