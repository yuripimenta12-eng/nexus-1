'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';

/* ── Types ─────────────────────────────────────── */
interface Member { initials: string; name: string; role: string; status: 'online' | 'away'; since: string; c1: string; c2: string; }

const MEMBERS: Member[] = [
  { initials: 'LU', name: 'Luna', role: 'Moderadora', status: 'online', since: 'Hoje, 18:32', c1: '#ba4cff', c2: '#401b83' },
  { initials: 'RF', name: 'Rafael', role: 'Membro', status: 'online', since: 'Hoje, 17:08', c1: '#19a6cf', c2: '#2c4278' },
  { initials: 'DK', name: 'DarkKina', role: 'Membro', status: 'away', since: 'Ontem, 23:51', c1: '#766b85', c2: '#312a3b' },
];

const CHART = [
  { day: 'SEG', h: 40 }, { day: 'TER', h: 58 }, { day: 'QUA', h: 48 },
  { day: 'QUI', h: 78 }, { day: 'SEX', h: 66 }, { day: 'SÁB', h: 92 }, { day: 'DOM', h: 82 },
];

const TABS = ['Visão geral', 'Membros', 'Canais', 'Cargos', 'Moderação', 'Auditoria', 'Integrações'];

function HealthRing({ pct, label, sublabel }: { pct: number; label: string; sublabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, border: '1px solid #2d2137', borderRadius: 12, marginBottom: 10 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
        background: `conic-gradient(#43e3a3 ${(pct / 100) * 360}deg,#2b2233 0)`,
        display: 'grid', placeItems: 'center', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', inset: 5, borderRadius: '50%', background: '#15101c',
          display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 900, zIndex: 1,
        }}>{pct}%</div>
      </div>
      <div style={{ flex: 1 }}>
        <strong style={{ display: 'block', fontSize: 11 }}>{label}</strong>
        <small style={{ color: '#94889f', fontSize: 9 }}>{sublabel}</small>
      </div>
      <span style={{ color: '#43e3a3', fontSize: 9 }}>Ótimo</span>
    </div>
  );
}

export default function AdminPage() {
  const params = useParams();
  const [activeTab, setActiveTab] = useState('Visão geral');
  const [toast, setToast] = useState('');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  }

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      background: 'linear-gradient(180deg,rgba(50,19,77,0.15),transparent 30%)',
      color: '#f7f3ff', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 14,
    }}>
      {/* Top header + tabs */}
      <div style={{
        padding: '20px 28px 0',
        borderBottom: '1px solid #32243f',
        background: 'rgba(13,9,18,0.6)',
        position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20 }}>Painel de administração</h1>
            <p style={{ margin: '3px 0 0', color: '#94889f', fontSize: 12 }}>Controle sua comunidade e acompanhe o que está acontecendo.</p>
          </div>
          <div style={{
            marginLeft: 'auto', border: '1px solid #423150', borderRadius: 11,
            background: '#16101d', color: '#c8bccf', padding: '7px 12px', fontSize: 12, cursor: 'pointer',
          }}>
            Últimos 7 dias ⌄
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); notify('Seção carregada'); }}
              style={{
                border: 0, background: 'transparent',
                color: activeTab === tab ? '#fff' : '#716778',
                fontWeight: activeTab === tab ? 800 : 400,
                padding: '8px 14px', cursor: 'pointer', fontSize: 12,
                borderBottom: activeTab === tab ? '2px solid #ff6a00' : '2px solid transparent',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '24px 28px' }}>
        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Membros', value: '2.846', delta: '↑ 12% esta semana' },
            { label: 'Online agora', value: '438', delta: '● 15% do total' },
            { label: 'Minutos em call', value: '18,4 mil', delta: '↑ 8,2%' },
            { label: 'Mensagens hoje', value: '7.293', delta: '↑ 19%' },
          ].map(m => (
            <div key={m.label} style={{
              border: '1px solid #32243f', borderRadius: 16,
              background: 'linear-gradient(145deg,#181020,#110d18)', padding: 16,
            }}>
              <div style={{ color: '#94889f', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{m.label}</div>
              <strong style={{ display: 'block', fontSize: 23, margin: '7px 0 4px' }}>{m.value}</strong>
              <span style={{ color: '#43e3a3', fontSize: 9 }}>{m.delta}</span>
            </div>
          ))}
        </div>

        {/* Charts + Health */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: 14, marginBottom: 14 }}>
          {/* Activity */}
          <div style={{ border: '1px solid #32243f', borderRadius: 16, background: 'linear-gradient(145deg,#181020,#110d18)', padding: 18 }}>
            <h3 style={{ margin: '0 0 15px', fontSize: 13 }}>Atividade da comunidade</h3>
            <div style={{ height: 160, display: 'flex', alignItems: 'flex-end', gap: 8, borderBottom: '1px solid #3a2a45', padding: '0 5px' }}>
              {CHART.map((bar, i) => (
                <motion.div
                  key={bar.day}
                  initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
                  style={{
                    flex: 1, minWidth: 18, height: `${bar.h}%`,
                    borderRadius: '6px 6px 0 0',
                    background: 'linear-gradient(#7a2cff,#ff6a00)',
                    opacity: 0.8, transformOrigin: 'bottom',
                    cursor: 'pointer',
                  }}
                  whileHover={{ opacity: 1 }}
                  title={`${bar.day}: ${bar.h}%`}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 8 }}>
              {CHART.map(b => (
                <span key={b.day} style={{ fontSize: 8, color: '#796e83' }}>{b.day}</span>
              ))}
            </div>
          </div>

          {/* System health */}
          <div style={{ border: '1px solid #32243f', borderRadius: 16, background: 'linear-gradient(145deg,#181020,#110d18)', padding: 18 }}>
            <h3 style={{ margin: '0 0 15px', fontSize: 13 }}>Saúde do sistema</h3>
            <HealthRing pct={99} label="Chamadas de voz" sublabel="Latência média 31 ms" />
            <HealthRing pct={98} label="Streaming de tela" sublabel="1080p disponível" />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {['＋ Criar cargo', '⚑ Revisar denúncias', '⌁ Copiar convite'].map(btn => (
                <button key={btn} onClick={() => notify('Ação aberta')} style={{
                  border: '1px solid #3c2a4a', borderRadius: 11,
                  background: '#181020', color: '#c4b7cd',
                  padding: '8px 10px', cursor: 'pointer', fontSize: 10,
                }}>
                  {btn}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Members table */}
        <div style={{ border: '1px solid #32243f', borderRadius: 16, background: 'linear-gradient(145deg,#181020,#110d18)', padding: 18 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 13 }}>Membros recentes</h3>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px',
            alignItems: 'center', padding: '10px 6px',
            fontSize: 8, color: '#716778', textTransform: 'uppercase',
          }}>
            <span>Usuário</span><span>Cargo</span><span>Status</span><span>Entrada</span><span>Ações</span>
          </div>
          {MEMBERS.map(m => (
            <div key={m.name} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px',
              alignItems: 'center', padding: '10px 6px',
              borderTop: '1px solid #2a1f34', fontSize: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 31, height: 31, borderRadius: 10, flexShrink: 0,
                  background: `linear-gradient(145deg,${m.c1},${m.c2})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: 9, color: '#fff',
                }}>{m.initials}</div>
                {m.name}
              </div>
              <span style={{ width: 'max-content', padding: '5px 8px', borderRadius: 15, background: '#2a1937', color: '#d3a8ef' }}>
                {m.role}
              </span>
              <span style={{ color: m.status === 'online' ? '#43e3a3' : '#ffbe63' }}>
                ● {m.status === 'online' ? 'Online' : 'Ausente'}
              </span>
              <span style={{ color: '#94889f' }}>{m.since}</span>
              <button onClick={() => notify('Ação administrativa aberta')} style={{
                border: '1px solid #3a2b47', borderRadius: 8,
                background: '#181020', color: '#c3b7cb', cursor: 'pointer',
                padding: '5px 10px', fontSize: 10,
              }}>•••</button>
            </div>
          ))}
        </div>
      </div>

      {/* Toast */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: toast ? 1 : 0, y: toast ? 0 : 40 }}
        style={{
          position: 'fixed', left: '50%', bottom: 20,
          transform: 'translateX(-50%)',
          background: '#1b1125', border: '1px solid #713b9a',
          padding: '11px 15px', borderRadius: 11, pointerEvents: 'none',
          whiteSpace: 'nowrap', fontSize: 13,
        }}
      >
        {toast}
      </motion.div>
    </div>
  );
}
