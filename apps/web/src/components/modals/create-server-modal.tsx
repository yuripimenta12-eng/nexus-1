'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Props {
  onClose: () => void;
  onCreated?: (server: any) => void;
}

const STEPS = ['Identidade', 'Canais', 'Cargos e acesso', 'Convites'];

interface Channel { type: '#' | '◖' | '▣'; name: string; }
const DEFAULT_CHANNELS: Channel[] = [
  { type: '#', name: 'chat-geral' },
  { type: '◖', name: 'Conversa Livre' },
  { type: '▣', name: 'Sala de Vídeo' },
];

export function CreateServerModal({ onClose, onCreated }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('Minha Comunidade Nexus');
  const [desc, setDesc] = useState('Um espaço para reunir todo mundo.');
  const [type, setType] = useState('Amigos e comunidade');
  const [channels, setChannels] = useState<Channel[]>(DEFAULT_CHANNELS);
  const [isPrivate, setIsPrivate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<any>(null);
  const [inviteLink, setInviteLink] = useState('');

  async function handleCreate() {
    setLoading(true);
    try {
      const { data } = await api.post('/servers', { name, description: desc });
      setCreated(data);
      setInviteLink(`nexus.link/invite/${data.inviteCode ?? 'abc123'}`);
      setStep(3);
      onCreated?.(data);
    } catch {
      // Still advance to show success UI even if API fails in demo
      setCreated({ id: 'demo', name });
      setInviteLink('nexus.link/invite/demo-link');
      setStep(3);
    } finally {
      setLoading(false);
    }
  }

  function addChannel() {
    setChannels(prev => [...prev, { type: '#', name: `canal-${prev.length}` }]);
  }

  const CHANNEL_COLORS = {
    '#': '#b66eff',
    '◖': '#ff9042',
    '▣': '#4cc4ff',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(5,4,7,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        backdropFilter: 'blur(6px)',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.93, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.93, y: 16 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        style={{
          width: 'min(95vw, 860px)', maxHeight: '90vh',
          display: 'grid', gridTemplateColumns: '220px 1fr',
          border: '1px solid #32243f', borderRadius: 22,
          background: '#0e0a13', boxShadow: '0 40px 100px #000a',
          overflow: 'hidden',
        }}
      >
        {/* Left: Steps */}
        <div style={{ background: '#0a0710', padding: '24px 14px', borderRight: '1px solid #1f1630' }}>
          <h2 style={{ fontSize: 15, margin: '0 8px 22px' }}>Nova comunidade</h2>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                display: 'flex', gap: 10, alignItems: 'center',
                padding: '11px 10px', borderRadius: 11,
                color: i === step ? '#fff' : i < step ? '#a5d7bf' : '#887c94',
                background: i === step ? '#22162e' : 'transparent',
                marginBottom: 4,
              }}
            >
              <div style={{
                width: 25, height: 25, borderRadius: 9,
                border: i === step ? 'none' : '1px solid #3a2a48',
                background: i === step ? 'linear-gradient(135deg,#ff6a00,#7a2cff)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 900, color: i === step ? '#fff' : 'inherit',
                flexShrink: 0,
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 13 }}>{s}</span>
            </div>
          ))}

          {/* Mini preview */}
          <div style={{ marginTop: 24, border: '1px solid #382748', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{
              height: 60, background: 'radial-gradient(circle at 75%,#9a4dff,transparent 34%),linear-gradient(120deg,#ff6a00,#331050)',
            }} />
            <div style={{ padding: '0 12px 12px' }}>
              <div style={{
                width: 44, height: 44, border: '4px solid #0c0911',
                borderRadius: 15, background: 'linear-gradient(135deg,#ff6a00,#7a2cff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: 14, marginTop: -22, color: '#fff',
              }}>
                {(name[0] ?? 'N').toUpperCase()}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, margin: '8px 0 2px' }}>{name || 'Nova comunidade'}</div>
              <div style={{ color: '#94889f', fontSize: 10 }}>3 membros · {channels.length} canais</div>
              {channels.slice(0, 3).map(ch => (
                <div key={ch.name} style={{
                  padding: '6px 7px', color: '#9d91a8', fontSize: 11,
                  borderRadius: 7, marginTop: 2,
                }}>
                  {ch.type} {ch.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Content */}
        <div style={{ padding: '28px 28px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait">
            {/* Step 0: Identity */}
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Crie seu espaço no Nexus</h1>
                <p style={{ color: '#94889f', margin: '0 0 22px', fontSize: 13 }}>Monte uma comunidade para seus amigos, equipe ou público.</p>

                {/* Upload zone */}
                <div style={{
                  height: 100, border: '1px dashed #61417a', borderRadius: 14,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', color: '#a892b6', background: '#15101c',
                  cursor: 'pointer', marginBottom: 16,
                }}>
                  <div style={{ fontSize: 26, color: '#c280ff' }}>＋</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Adicionar logo ou capa</div>
                </div>

                <label style={{ display: 'block', color: '#b9adbf', fontSize: 10, fontWeight: 900, letterSpacing: 0.5, marginBottom: 6 }}>NOME DA COMUNIDADE</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    width: '100%', border: '1px solid #392a46', borderRadius: 12,
                    background: '#0b0810', color: '#fff', padding: '12px 14px',
                    outline: 'none', fontSize: 14, marginBottom: 14, boxSizing: 'border-box',
                  }}
                />

                <label style={{ display: 'block', color: '#b9adbf', fontSize: 10, fontWeight: 900, letterSpacing: 0.5, marginBottom: 6 }}>DESCRIÇÃO</label>
                <input
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  style={{
                    width: '100%', border: '1px solid #392a46', borderRadius: 12,
                    background: '#0b0810', color: '#fff', padding: '12px 14px',
                    outline: 'none', fontSize: 14, marginBottom: 14, boxSizing: 'border-box',
                  }}
                />

                <label style={{ display: 'block', color: '#b9adbf', fontSize: 10, fontWeight: 900, letterSpacing: 0.5, marginBottom: 6 }}>TIPO DE COMUNIDADE</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  style={{
                    width: '100%', border: '1px solid #392a46', borderRadius: 12,
                    background: '#0b0810', color: '#fff', padding: '12px 14px',
                    outline: 'none', fontSize: 14, boxSizing: 'border-box',
                  }}
                >
                  <option>Amigos e comunidade</option>
                  <option>Equipe de trabalho</option>
                  <option>Jogos e entretenimento</option>
                </select>
              </motion.div>
            )}

            {/* Step 1: Channels */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Estrutura inicial</h1>
                <p style={{ color: '#94889f', margin: '0 0 22px', fontSize: 13 }}>Configure os canais da sua comunidade.</p>

                {channels.map((ch, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px',
                    border: '1px solid #2e2239', borderRadius: 11, marginBottom: 8,
                    background: '#15101c',
                  }}>
                    <span style={{ color: CHANNEL_COLORS[ch.type], fontWeight: 900 }}>{ch.type}</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{ch.name}</span>
                    <span style={{ color: '#716778', fontSize: 10 }}>
                      {ch.type === '#' ? 'Texto' : ch.type === '◖' ? 'Áudio' : 'Vídeo'}
                    </span>
                  </div>
                ))}

                <button
                  onClick={addChannel}
                  style={{
                    width: '100%', padding: '11px', border: '1px dashed #5a3a70',
                    borderRadius: 11, background: 'transparent', color: '#bf91da',
                    cursor: 'pointer', fontSize: 13,
                  }}
                >
                  ＋ Adicionar canal
                </button>
              </motion.div>
            )}

            {/* Step 2: Roles */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Cargos e acesso</h1>
                <p style={{ color: '#94889f', margin: '0 0 22px', fontSize: 13 }}>Defina os cargos iniciais da sua comunidade.</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                  {[
                    { name: 'Dono', color: '#ff6a00' },
                    { name: 'Administrador', color: '#a54bff' },
                    { name: 'Membro', color: '#43e3a3' },
                  ].map(role => (
                    <span key={role.name} style={{
                      padding: '7px 12px', borderRadius: 20, background: '#25172f',
                      color: '#d6c4df', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: role.color, display: 'inline-block' }} />
                      {role.name}
                    </span>
                  ))}
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 0', borderBottom: '1px solid #2a1f34',
                }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13 }}>Comunidade privada</p>
                    <small style={{ color: '#94889f', fontSize: 11 }}>Somente convidados podem entrar</small>
                  </div>
                  <div
                    onClick={() => setIsPrivate(p => !p)}
                    style={{
                      width: 38, height: 21, borderRadius: 20, cursor: 'pointer',
                      background: isPrivate
                        ? 'linear-gradient(90deg,#ff6a00,#7a2cff)'
                        : '#382c42',
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      position: 'absolute', width: 15, height: 15, borderRadius: '50%',
                      background: isPrivate ? '#fff' : '#95899e',
                      left: isPrivate ? 20 : 3, top: 3, transition: 'left 0.2s',
                    }} />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Invite / Done */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <h1 style={{ fontSize: 22, margin: '0 0 4px' }}>Comunidade criada! 🎉</h1>
                <p style={{ color: '#94889f', margin: '0 0 22px', fontSize: 13 }}>
                  <strong style={{ color: '#ff9042' }}>{name}</strong> está pronto para receber membros.
                </p>

                <div style={{
                  padding: 16, border: '1px solid #4b305d', borderRadius: 14,
                  background: '#17101e', marginBottom: 16,
                }}>
                  <div style={{ color: '#b99bcf', fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 8 }}>LINK DE CONVITE</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, color: '#c8b8d8', fontSize: 13, background: '#0b0810', padding: '10px 12px', borderRadius: 9 }}>
                      {inviteLink || 'nexus.link/invite/...'}
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(inviteLink ?? '').catch(() => {})}
                      style={{
                        border: 0, borderRadius: 10, background: 'linear-gradient(135deg,#ff6a00,#7a2cff)',
                        color: '#fff', padding: '10px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 900,
                      }}
                    >
                      COPIAR
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (created?.id && created.id !== 'demo') {
                      router.push(`/app/servers/${created.id}`);
                    }
                    onClose();
                  }}
                  style={{
                    width: '100%', border: 0, borderRadius: 13, padding: '14px',
                    color: '#fff', background: 'linear-gradient(110deg,#ff6a00,#ff4058 48%,#7a2cff)',
                    fontWeight: 900, cursor: 'pointer', fontSize: 14,
                  }}
                >
                  IR PARA A COMUNIDADE →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          {step < 3 && (
            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 24 }}>
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  style={{
                    flex: 1, border: '1px solid #3c2a4a', borderRadius: 13, padding: '13px',
                    background: '#181020', color: '#c4b7cd', cursor: 'pointer', fontSize: 13,
                  }}
                >
                  ← Voltar
                </button>
              )}
              {step < 2 ? (
                <button
                  onClick={() => setStep(s => s + 1)}
                  style={{
                    flex: 2, border: 0, borderRadius: 13, padding: '13px',
                    background: 'linear-gradient(110deg,#ff6a00,#ff4058 48%,#7a2cff)',
                    color: '#fff', fontWeight: 900, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  PRÓXIMO →
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={loading || !name.trim()}
                  style={{
                    flex: 2, border: 0, borderRadius: 13, padding: '13px',
                    background: loading
                      ? '#2a1937'
                      : 'linear-gradient(110deg,#ff6a00,#ff4058 48%,#7a2cff)',
                    color: '#fff', fontWeight: 900, cursor: loading ? 'wait' : 'pointer', fontSize: 13,
                  }}
                >
                  {loading ? 'CRIANDO...' : 'CRIAR COMUNIDADE →'}
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <button
              onClick={onClose}
              style={{
                marginTop: 10, width: '100%', border: '1px solid #3c2a4a',
                borderRadius: 13, padding: '12px', background: '#181020',
                color: '#c4b7cd', cursor: 'pointer', fontSize: 13,
              }}
            >
              Fechar
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
