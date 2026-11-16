'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Antes este endereço entrava no servidor sozinho ao abrir (bastava um site
// mandar a pessoa para cá). Agora leva à página do convite, que pede o clique.
export default function InviteRedirect() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  useEffect(() => {
    const valido = typeof code === 'string' && /^[A-Za-z0-9_-]{4,32}$/.test(code);
    router.replace(valido ? `/invite/${code}` : '/app');
  }, [code, router]);
  return null;
}
