'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { connectSocket, getSocket } from '@/lib/socket';
import { startGameActivity, currentGameResend, watchGameRunning, isDesktopApp } from '@/lib/desktop';
import { MotionConfig } from 'framer-motion';
import { usePrefsStore } from '@/stores/prefs.store';
import { syncPush } from '@/lib/push';
import { VerifyEmailGate } from '@/components/layout/verify-email-gate';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { ServersSidebar } from '@/components/layout/servers-sidebar';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { GlobalCallAudio } from '@/components/voice/global-call-audio';
import { DmCallOverlay } from '@/components/dm/dm-call-overlay';
import { CallHotkeys } from '@/components/voice/call-hotkeys';
import { MovidoDeSala } from '@/components/voice/movido-de-sala';
import { BatimentoPlacar } from '@/components/voice/placar';
import { UnidosHost } from '@/components/games/unidos/unidos-host';
import { PushPrompt } from '@/components/layout/push-prompt';
import { AtualizacaoApp } from '@/components/layout/atualizacao-app';
import { ComunicadosHost } from '@/components/layout/comunicados';
import { useMutes } from '@/lib/mutes';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, hasHydrated, refreshUser, user } = useAuthStore();
  const { mobileNavOpen, closeMobileNav, toggleMobileNav } = useUiStore();
  const loadMutes = useMutes(s => s.load);
  const modoLeve = usePrefsStore(s => s.modoLeve);
  const modoJogo = usePrefsStore(s => s.modoJogo);
  const navRecolhida = usePrefsStore(s => s.navRecolhida);
  const setNavRecolhida = usePrefsStore(s => s.setNavRecolhida);
  const [jogando, setJogando] = useState(false);
  const leve = modoLeve || (modoJogo && jogando);

  // Modo jogo (app de PC): com um jogo aberto, o Nexus fica no modo leve sozinho
  useEffect(() => {
    if (!isDesktopApp()) return;
    return watchGameRunning(setJogando);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('nx-leve', leve);
  }, [leve]);

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

  // Jogando com o Nexus aberto: janela sem foco (o jogo na frente) ou escondida
  // congela as animações em loop (anel de quem fala, barrinhas, brilhos). Cada
  // uma redesenha a tela na taxa do monitor e disputa a placa de vídeo com o jogo.
  useEffect(() => {
    const html = document.documentElement;
    const atualizar = () => {
      // Foco num iframe da própria página (ex.: vídeo) ainda conta como focado
      html.classList.toggle('nx-sem-foco', document.hidden || !document.hasFocus());
    };
    const aoSair = () => setTimeout(atualizar, 0);
    atualizar();
    window.addEventListener('blur', aoSair);
    window.addEventListener('focus', atualizar);
    document.addEventListener('visibilitychange', atualizar);
    return () => {
      window.removeEventListener('blur', aoSair);
      window.removeEventListener('focus', atualizar);
      document.removeEventListener('visibilitychange', atualizar);
      html.classList.remove('nx-sem-foco');
    };
  }, []);

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
      {/* Atalhos de teclado da chamada (silenciar/ensurdecer) */}
      <CallHotkeys />
      {/* Admin moveu você para outra sala de voz: troca sozinho */}
      <MovidoDeSala />
      {/* Placar da call: conta o tempo e mostra conquistas desbloqueadas */}
      <BatimentoPlacar />
      {/* UNidos: jogo de cartas da chamada */}
      <UnidosHost />
      <PushPrompt />
      {/* App de PC: versão nova baixada, pronta para instalar */}
      <AtualizacaoApp />
      {/* Comunicados do dono do Nexus: destaque até "Entendi" */}
      <ComunicadosHost />

      {/* Navegação (trilho + canais): fixa no desktop, gaveta no celular */}
      <div
        className={cn(
          'md:static md:translate-x-0',
          navRecolhida ? 'md:hidden' : 'md:flex',
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

      {/* Conteúdo principal (modo leve: as animações do framer-motion também param) */}
      <main className="relative flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Recolher/mostrar o trilho e os canais (só no PC) */}
        <button
          onClick={() => setNavRecolhida(!navRecolhida)}
          title={navRecolhida ? 'Mostrar servidores e canais' : 'Recolher servidores e canais'}
          aria-label={navRecolhida ? 'Mostrar servidores e canais' : 'Recolher servidores e canais'}
          aria-expanded={!navRecolhida}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-30 w-4 h-14 items-center justify-center
                     rounded-r-lg bg-[var(--th-side)] border border-l-0 border-[var(--th-line)] text-[#a99cb8]
                     opacity-60 hover:opacity-100 hover:w-5 hover:text-white transition-all"
        >
          {navRecolhida ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
        <MotionConfig reducedMotion={leve ? 'always' : 'user'}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </MotionConfig>
      </main>
    </div>
  );
}
