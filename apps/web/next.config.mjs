/** @type {import('next').NextConfig} */
const nextConfig = {
  // Identifica cada publicação: o app aberto compara com /versao e oferece recarregar
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now()) },
  // Erros de TypeScript e ESLint devem ser visíveis durante o build
  // typescript.ignoreBuildErrors e eslint.ignoreDuringBuilds foram removidos
  // para garantir que erros reais sejam detectados antes do deploy.
  // Otimizador de imagens só para o nosso armazenamento (antes aceitava
  // qualquer site: dava para usar o Nexus como "proxy" de imagens alheias).
  // Outras URLs aparecem sem otimizar (ver src/lib/imagem.ts).
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'arquivos.nexuslink.art' },
    ],
  },
  // Cabeçalhos de segurança: ninguém embute o site escondido em outra página
  // (clique falso), câmera/microfone/tela só para o próprio Nexus.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), fullscreen=(self), geolocation=(), payment=(), usb=()' },
          // Política mínima que não quebra nada: sem plugins, sem <base> trocado, sem ser embutido
          { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
  // Endereço antigo aposentado: quem abrir o link/atalho velho cai no domínio
  // novo, na mesma página.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'nexus-eight-kohl.vercel.app' }],
        destination: 'https://www.nexuslink.art/:path*',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
