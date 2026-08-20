'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Link2, Copy, Check, Users, RefreshCw, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

/* ═══════════════════════════════════════════════
   NEXUS LINK — InviteModal (Design System v2)

   Uso:
     <InviteModal serverId="..." serverName="..." onClose={() => setShow(false)} />
══════════════════════════════════════════════ */

interface InviteModalProps {
  serverId:   string;
  serverName: string;
  onClose:    () => void;
}

const EXPIRY_OPTIONS = [
  { label: '30 minutos', value: '30m'  },
  { label: '1 hora',     value: '1h'   },
  { label: '6 horas',    value: '6h'   },
  { label: '24 horas',   value: '24h'  },
  { label: '7 dias',     value: '7d'   },
  { label: 'Nunca',      value: 'never'},
];

export function InviteModal({ serverId, serverName, onClose }: InviteModalProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading,    setLoading   ] = useState(true);
  const [copied,     setCopied    ] = useState(false);
  const [expiry,     setExpiry    ] = useState('24h');
  const [showExpiry, setShowExpiry] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fullLink = inviteCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inviteCode}`
    : '';

  const EXPIRY_HOURS: Record<string, number | undefined> = {
    '30m': 0.5, '1h': 1, '6h': 6, '24h': 24, '7d': 168, 'never': undefined,
  };

  const fetchInvite = useCallback(async (exp = expiry) => {
    setLoading(true);
    try {
      const expiresInHours = EXPIRY_HOURS[exp];
      const { data } = await api.post(`/invites/servers/${serverId}`, { expiresInHours });
      setInviteCode(data.code ?? data.invite?.code ?? data.id ?? '');
    } catch {
      setInviteCode('erro-ao-gerar');
    } finally {
      setLoading(false);
    }
  }, [serverId, expiry]);

  useEffect(() => { fetchInvite(); }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await fetchInvite(expiry);
    setRegenerating(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit   ={{ scale: 0.94, opacity: 0, y: 12 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, margin: '0 16px',
          borderRadius: 20,
          background: 'linear-gradient(145deg,#14102200,#100d1ff5)',
          backgroundColor: '#14102280',
          backdropFilter: 'blur(24px)',
          border: '1px solid #2a1f40',
          boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
          overflow: 'hidden',
        }}
      >
        {/* Header gradient strip */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg,#ff6a00,#7c5af0,#b142f5)',
        }} />

        <div style={{ padding: '24px 24px 20px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ color: '#ede8f8', fontWeight: 900, fontSize: 18, margin: '0 0 4px', letterSpacing: -0.3 }}>
                Convidar para {serverName}
              </h3>
              <p style={{ color: '#7a748e', fontSize: 13, margin: 0 }}>
                Compartilhe este link para adicionar membros
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid #2a1f40',
                color: '#7a748e', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.15s, background 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = '#ede8f8';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = '#7a748e';
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
              }}
            >
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 16, margin: '0 auto 20px',
            background: 'linear-gradient(135deg,rgba(124,90,240,0.2),rgba(177,66,245,0.1))',
            border: '1px solid rgba(124,90,240,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(124,90,240,0.18)',
          }}>
            <Users style={{ width: 22, height: 22, color: '#9b6dff' }} />
          </div>

          {/* Link box */}
          <div style={{
            background: '#0d0a16',
            border: '1px solid #2a1f40',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            marginBottom: 14,
          }}>
            <Link2 style={{ width: 15, height: 15, color: '#7c5af0', flexShrink: 0 }} />
            <span style={{
              flex: 1, fontSize: 13, color: loading ? '#4a4560' : '#b8b0cc',
              fontFamily: 'JetBrains Mono, monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {loading ? 'Gerando link…' : fullLink}
            </span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleCopy}
              disabled={loading}
              style={{
                padding: '6px 14px', borderRadius: 8,
                background: copied
                  ? 'rgba(45,214,123,0.15)'
                  : 'linear-gradient(135deg,#7c5af0,#b142f5)',
                border: copied ? '1px solid rgba(45,214,123,0.3)' : 'none',
                color: copied ? '#2dd67b' : '#fff',
                fontSize: 12, fontWeight: 800, cursor: loading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                flexShrink: 0,
                transition: 'background 0.2s, color 0.2s',
                boxShadow: copied ? 'none' : '0 2px 10px rgba(124,90,240,0.3)',
              }}
            >
              {copied
                ? <><Check style={{ width: 12, height: 12 }} /> Copiado!</>
                : <><Copy style={{ width: 12, height: 12 }} /> Copiar</>
              }
            </motion.button>
          </div>

          {/* Expiry + regenerate */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            {/* Expiry dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowExpiry(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid #2a1f40',
                  color: '#b8b0cc', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c5af0'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a1f40'; }}
              >
                Expira em: <strong style={{ color: '#ede8f8' }}>{EXPIRY_OPTIONS.find(o => o.value === expiry)?.label}</strong>
                <ChevronDown style={{ width: 12, height: 12, color: '#7a748e', transform: showExpiry ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              <AnimatePresence>
                {showExpiry && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                      background: '#131020',
                      border: '1px solid #2a1f40',
                      borderRadius: 10,
                      overflow: 'hidden',
                      zIndex: 10,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      minWidth: 160,
                    }}
                  >
                    {EXPIRY_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setExpiry(opt.value); setShowExpiry(false); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '9px 14px', background: 'transparent', border: 'none',
                          color: opt.value === expiry ? '#9b6dff' : '#b8b0cc',
                          fontSize: 13, fontWeight: opt.value === expiry ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(124,90,240,0.12)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        {opt.label}
                        {opt.value === expiry && <Check style={{ width: 12, height: 12, display: 'inline', marginLeft: 8 }} />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Regenerate */}
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px', borderRadius: 8,
                background: 'transparent',
                border: '1px solid #2a1f40',
                color: '#7a748e', fontSize: 12, fontWeight: 600,
                cursor: regenerating ? 'wait' : 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = '#ede8f8';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c5af0';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = '#7a748e';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a1f40';
              }}
            >
              <RefreshCw style={{ width: 12, height: 12, animation: regenerating ? 'spin 0.8s linear infinite' : 'none' }} />
              Novo link
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
