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
