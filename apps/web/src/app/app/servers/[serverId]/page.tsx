'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';

/**
 * [serverId]/page.tsx — redirects to the first available text channel.
 * If no channels exist, shows a placeholder.
 */
export default function ServerPage() {
  const params = useParams<{ serverId: string }>();
  const { serverId } = params;
  const router = useRouter();

  useEffect(() => {
    if (!serverId) return;

    api.get(`/servers/${serverId}`)
      .then(({ data }) => {
        // Backend returns server with channels array
        const channels: { id: string; type: string }[] = data?.channels ?? data?.server?.channels ?? [];
        const textChannel = channels.find(c => c.type === 'TEXT' || c.type === 'text') ?? channels[0];
        if (textChannel) {
          router.replace(`/app/servers/${serverId}/channels/${textChannel.id}`);
        }
        // If no channels, stay on this page (renders placeholder below)
      })
      .catch(() => {
        // Server not found or no access — stay on page
      });
  }, [serverId]);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#09070d', color: '#7a748e',
    }}>
      <Loader2 style={{ width: 28, height: 28, color: '#7c5af0', animation: 'spin 1s linear infinite', marginBottom: 12 }} />
      <p style={{ margin: 0, fontSize: 14 }}>Carregando servidor…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
