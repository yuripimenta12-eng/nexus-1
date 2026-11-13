import { redirect } from 'next/navigation';

// Link de indicação: nexuslink.art/r/<codigo> → cadastro com o código guardado
export default async function LinkIndicacao({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  redirect(`/auth/register?ref=${encodeURIComponent(String(codigo).slice(0, 12))}`);
}
