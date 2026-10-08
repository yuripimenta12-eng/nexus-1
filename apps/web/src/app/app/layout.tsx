'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { connectSocket, getSocket } from '@/lib/socket';
import { startGameActivity, currentGameResend } from '@/lib/desktop';
import { syncPush } from '@/lib/push';
import { VerifyEmailGate } from '@/components/layout/verify-email-gate';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { ServersSidebar } from '@/components/layout/servers-sidebar';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { GlobalCallAudio } from '@/components/voice/global-call-audio';
import { DmCallOverlay } from '@/components/dm/dm-call-overlay';
import { PushPrompt } from '@/components/layout/push-prompt';
import { useMutes } from '@/lib/mutes';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, hasHydrated, refreshUser, user } = useAuthStore();
  const { mobileNavOpen, closeMobileNav, toggleMobileNav } = useUiStore();
  const loadMutes = useMutes(s => s.load);

  // Servidores/canais silenciados (sons e destaques respeitam isso)
  useEffect(() => { if (isAuthenticated) loadMutes(); }, [isAuthenticated, loadMutes]);

  // App de PC: "Jogando …" (o app diz o jogo aberto; aqui repassa ao servidor)
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    const emit = (name: string | null) => { if (socket.connected) socket.emit('user:activity', { name }); };
    const stop = startGameActivity(emit);
    const onConnect = () => currentGameResend(emit);
    socket.on('connect', onConnect);
    return () => { stop(); socket.off('connect', onConnect); };
  }, [isAuthenticated]);

  useEffect(() => {
    // Espera o estado persistido carregar antes de decidir redirecionar,
    // senão todo reload cai no login mesmo com sessão válida
    if (hasHydrated && !isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isAuthenticated, isLoading, hasHydrated, router]);

  // Ao (re)abrir o app já autenticado, reconecta o socket e atualiza o usuário.
  // O socket tem autoConnect:false e só ligava no login/cadastro — sem isto,
  // após um reload o usuário ficava "offline" e não recebia eventos em tempo
  // real (mensagens, presença) até relogar.
  useEffect(() => {
    if (hasHydrated && isAuthenticated) {
      connectSocket('');
      refreshUser();
      syncPush();
    }
  }, [hasHydrated, isAuthenticated, refreshUser]);

  // Fecha o menu mobile ao navegar para outra tela
  useEffect(() => { closeMobileNav(); }, [pathname, closeMobileNav]);

  if (!isAuthenticated) return null;

  // Conta nova sem e-mail confirmado (=== false: usuário salvo antigo sem o
  // campo não é bloqueado; o refreshUser acima traz o valor real)
  if (user && user.isVerified === false) return <VerifyEmailGate email={user.email} />;

  return (
    // 100dvh = altura REAL visível no celular (100vh esconde o rodapé atrás da
    // barra do navegador). As áreas seguras evitam o notch e a barra de gestos.
    <div className="flex h-screen h-[100dvh] w-full overflow-hidden bg-background nx-safe-top nx-safe-bottom nx-safe-x">
      {/* Áudio da chamada — global: continua tocando em qualquer tela do app */}
      <GlobalCallAudio />
      {/* Chamada 1:1 da DM (toca, chamando, em chamada) e convite para avisos no celular */}
      <DmCallOverlay />
      <PushPrompt />

      {/* Navegação (trilho + canais): fixa no desktop, gaveta no celular */}
      <div
        className={cn(
          'md:static md:flex md:translate-x-0',
          'fixed inset-y-0 left-0 z-50 flex transition-transform duration-200 max-w-[92vw]',
          'nx-safe-top nx-safe-bottom md:pt-0 md:pb-0 bg-background',
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

      {/* Fechar a gaveta (só mobile) — o botão ☰ de abrir fica no cabeçalho de cada tela */}
      {mobileNavOpen && (
        <button
          onClick={toggleMobileNav}
          className="md:hidden fixed top-3 right-3 z-50 w-11 h-11 rounded-2xl text-white nx-safe-top
                     bg-[#1a1224] border border-[#3a2a4d] shadow-[0_8px_24px_rgba(0,0,0,0.5)]
                     flex items-center justify-center active:scale-95 transition-transform"
          title="Fechar menu"
          aria-label="Fechar menu"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Conteúdo principal */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
