// Versão publicada agora. O app aberto compara com a dele para saber se saiu uma nova.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
