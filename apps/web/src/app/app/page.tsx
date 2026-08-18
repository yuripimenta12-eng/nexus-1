'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';
import { MessageSquare, Hash, Users } from 'lucide-react';

export default function AppHomePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Redireciona para o primeiro servidor
    api.get('/users/@me/servers').then(({ data }) => {
      if (data.length > 0) {
        const first = data[0].server;
        const firstChannel = first.channels?.[0];
        if (firstChannel) {
          router.replace(`/app/servers/${first.id}/channels/${firstChannel.id}`);
        } else {
          router.replace(`/app/servers/${first.id}`);
        }
      }
    });
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Bem-vindo ao Nexus, {user?.profile?.displayName}!
        </h2>
        <p className="text-muted mb-6">
          Selecione um servidor na barra lateral para começar a conversar.
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <FeatureCard icon={<Hash className="w-5 h-5" />} label="Chat em tempo real" />
          <FeatureCard icon={<Users className="w-5 h-5" />} label="Voz e vídeo" />
          <FeatureCard icon={<MessageSquare className="w-5 h-5" />} label="Compartilhamento" />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface border border-border">
      <span className="text-accent">{icon}</span>
      <span className="text-muted text-xs">{label}</span>
    </div>
  );
}
