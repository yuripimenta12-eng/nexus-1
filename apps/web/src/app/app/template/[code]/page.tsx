'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Hash, Volume2, Shield, X } from 'lucide-react';
import api from '@/lib/api';

export default function TemplatePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [tpl, setTpl] = useState<any>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get(`/templates/${code}`)
      .then(({ data }) => { setTpl(data); setName(data.title); })
      .catch(() => setError('Modelo não encontrado ou expirado.'));
  }, [code]);

  const create = async () => {
    setCreating(true);
    try {
      const { data } = await api.post(`/templates/${code}/use`, { name: name.trim() || undefined });
      router.push(`/app/servers/${data.id}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Erro ao criar o servidor');
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen grid place-items-center nx-page-bg p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-7"
      >
        {error ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 grid place-items-center mx-auto mb-3">
              <X className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-white font-semibold mb-4">{error}</p>
            <button onClick={() => router.push('/app')} className="btn-ghost">Ir para o início</button>
          </div>
        ) : !tpl ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-accent animate-spin" /></div>
        ) : (
          <>
            <p className="text-orange text-[10px] font-extrabold uppercase tracking-[1.5px] text-center">
              Modelo de servidor
            </p>
            <h1 className="text-white text-2xl font-bold text-center mt-1">{tpl.title}</h1>
            {tpl.description && (
              <p className="text-[#92879f] text-sm text-center mt-2">{tpl.description}</p>
            )}

            <div className="flex justify-center gap-4 mt-5 text-[#a99cb8] text-xs">
              <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> {tpl.channels} canais</span>
              <span className="flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5" /> {tpl.voiceRooms} salas de voz</span>
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> {tpl.roles} cargos</span>
            </div>

            <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#cfc5d8] mt-6 mb-2">
              Nome do seu servidor
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              className="nexus-input w-full"
            />

            <button
              onClick={create}
              disabled={creating || name.trim().length < 2}
              className="w-full mt-5 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-extrabold text-white
                         bg-gradient-to-r from-orange to-accent hover:opacity-90 disabled:opacity-50 active:scale-95 transition-all"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Criar servidor com este modelo
            </button>
            <p className="text-[#5c5468] text-[11px] text-center mt-3">
              Usado {tpl.uses} vez{tpl.uses !== 1 ? 'es' : ''} · copia canais, cargos e configurações (sem mensagens nem membros)
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
