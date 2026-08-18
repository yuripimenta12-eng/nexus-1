import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Nexus — Comunicação em tempo real',
  description: 'Plataforma de comunicação com chat, voz, vídeo e compartilhamento de tela.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans bg-background text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
