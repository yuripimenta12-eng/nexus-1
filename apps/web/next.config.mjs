/** @type {import('next').NextConfig} */
const nextConfig = {
  // Erros de TypeScript e ESLint devem ser visíveis durante o build
  // typescript.ignoreBuildErrors e eslint.ignoreDuringBuilds foram removidos
  // para garantir que erros reais sejam detectados antes do deploy.
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
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
