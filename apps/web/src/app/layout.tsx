import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { PwaRegister } from '@/components/pwa-register';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Nexus — Comunicação em tempo real',
  description: 'Plataforma de comunicação com chat, voz, vídeo e compartilhamento de tela.',
  icons: { icon: '/favicon.ico', apple: '/icon-192.png' },
  appleWebApp: { capable: true, title: 'Nexus', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0a0713',
  width: 'device-width',
  initialScale: 1,
  // Ocupa a tela inteira do iPhone (atrás do notch/Dynamic Island); as áreas
  // seguras são respeitadas com env(safe-area-inset-*) no layout do app.
  viewportFit: 'cover',
  // Android: quando o teclado abre, a página encolhe junto — a caixa de
  // mensagem continua visível acima do teclado.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-background text-white antialiased`}>
        <PwaRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
