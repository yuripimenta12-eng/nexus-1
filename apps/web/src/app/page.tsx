import type { Metadata } from 'next';
import Landing from '@/components/landing/landing';

export const metadata: Metadata = {
  title: 'Nexus — Calls, lives e comunidades',
  description: 'Voz, vídeo, live de tela a 60 quadros e um DJ na call. Crie seu servidor e chame a galera.',
};

export default function PaginaInicial() {
  return <Landing />;
}
