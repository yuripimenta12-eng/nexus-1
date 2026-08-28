import type { MetadataRoute } from 'next';

// Manifesto PWA — permite "Instalar Nexus" pelo navegador (PC e celular)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nexus Link',
    short_name: 'Nexus',
    description: 'Comunicação em tempo real — voz, vídeo, tela compartilhada e chat.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#0a0713',
    theme_color: '#0a0713',
    orientation: 'any',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
