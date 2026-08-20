'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ServersIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/app'); }, [router]);
  return null;
}
