'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

// Permissões efetivas de quem está logado num servidor. Serve só para
// mostrar/ocultar botões: o servidor confere cada ação de novo.
export interface ServerPerms { role: string; permissions: string[] }

const cache = new Map<string, { at: number; data: ServerPerms }>();
const TTL = 60_000;

export function invalidateServerPerms(serverId?: string) {
  if (serverId) cache.delete(serverId); else cache.clear();
}

export function useServerPerms(serverId?: string) {
  const [perms, setPerms] = useState<ServerPerms | null>(() => {
    const hit = serverId ? cache.get(serverId) : undefined;
    return hit ? hit.data : null;
  });

  useEffect(() => {
    if (!serverId) return;
    const hit = cache.get(serverId);
    if (hit && Date.now() - hit.at < TTL) { setPerms(hit.data); return; }
    let alive = true;
    api.get(`/servers/${serverId}/roles/@me`)
      .then(({ data }) => {
        cache.set(serverId, { at: Date.now(), data });
        if (alive) setPerms(data);
      })
      .catch(() => { if (alive) setPerms(null); });
    return () => { alive = false; };
  }, [serverId]);

  const can = (p: string) => !!perms?.permissions.includes(p);
  return { perms, can };
}
