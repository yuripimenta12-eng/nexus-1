'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, MoreHorizontal, Star } from 'lucide-react';
import { useVoiceStore } from '@/stores/voice.store';
import { useAuthStore } from '@/stores/auth.store';
import api from '@/lib/api';

/* ── Voice Wave ─────────────────────────────── */
function VoiceWave({ active }: { active: boolean }) {
  return (
    <div style={{
      height: 28, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: 3, margin: '10px auto 0',
      opacity: active ? 1 : 0.22, transition: 'opacity 0.3s',
    }}>
      {[0, 0.12, 0.24, 0.36, 0.24, 0.12, 0].map((delay, i) => (
        <div
          key={i}
          style={{
            width: 3, height: 5, borderRadius: 5,
            background: 'linear-gradient(#ff6a00,#7a2cff)',
            animation: active ? `voiceBar 0.72s ease-in-out ${delay}s infinite` : 'none',
          }}
        />
      ))}
      <style>{`
        @keyframes voiceBar {
          0%,100% { height:5px }
          50% { height:24px }
        }
      `}</style>
    </div>
  );
}

/* ── Person Card ─────────────────────────────── */
function PersonCard({
  name, initials, c1, c2, isSpeaking, isMuted, isMe,
}: {
  name: string; initials: string; c1: string; c2: string;
  isSpeaking: boolean; isMuted?: boolean; isMe?: boolean;
}) {
  const BG_COLORS = [
    'radial-gradient(circle at 50% 38%,#2b1a3c 0,#14101a 53%,#100c15 100%)',
    'radial-gradient(circle at 50% 38%,#332216 0,#17110e 53%,#100c0b 100%)',
    'radial-gradient(circle at 50% 38%,#132934 0,#0f171d 53%,#0c1014 100%)',
    'radial-gradient(circle at 50% 38%,#2c1832 0,#17101b 53%,#100c14 100%)',
  ];
  const bgIdx = ['GV', 'LU', 'RF', 'MA'].indexOf(initials);
  const bg = BG_COLORS[bgIdx >= 0 ? bgIdx : 0];

  return (
    <motion.article
      animate={{
        borderColor: isSpeaking ? '#8f42ff' : '#2c2036',
        y: isSpeaking ? -2 : 0,
      }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'relative', overflow: 'hidden',
        border: `1px solid ${isSpeaking ? '#8f42ff' : '#2c2036'}`,
        borderRadius: 19, background: bg,
        boxShadow: isSpeaking
          ? '0 0 0 2px rgba(255,106,0,0.42) inset, 0 0 32px rgba(122,44,255,0.2)'
          : 'none',
      }}
    >
      {/* Speaking badge */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            style={{
              position: 'absolute', right: 13, top: 13,
              padding: '5px 9px', borderRadius: 20,
              background: 'rgba(16,11,22,0.85)',
              border: '1px solid #6c35a2', color: '#d8aefe',
              fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '1px', fontWeight: 900,
            }}
          >
            Falando agora
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center content */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
        <div style={{ position: 'relative', margin: 'auto' }}>
          {/* Glow ring when speaking */}
          <motion.div
            animate={{
              borderColor: isSpeaking ? '#b565ff' : 'transparent',
              boxShadow: isSpeaking ? '0 0 22px rgba(255,106,0,0.4)' : 'none',
            }}
            style={{
              position: 'absolute', inset: -6, borderRadius: 33,
              border: '1px solid transparent', transition: 'all 0.3s',
              pointerEvents: 'none',
            }}
          />
          <div style={{
            width: 82, height: 82, display: 'grid', placeItems: 'center',
            borderRadius: 28, fontWeight: 900, fontSize: 25, color: '#fff',
            background: `linear-gradient(145deg,${c1},${c2})`,
            boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
          }}>
            {initials}
          </div>
        </div>
        <VoiceWave active={isSpeaking} />
      </div>

      {/* Nameplate */}
      <div style={{
        position: 'absolute', left: 13, bottom: 12,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 10,
        background: 'rgba(9,7,13,0.74)', backdropFilter: 'blur(8px)',
        fontWeight: 700, fontSize: 13,
      }}>
        {name}
        <span style={{ color: isMuted ? '#ff6b7f' : '#a89cb4', fontSize: 12 }}>
          {isMuted ? '⌁' : '●'}
        </span>
      </div>

      {/* Network */}
      <div style={{
        position: 'absolute', right: 13, bottom: 15,
        color: '#4ce0a2', fontSize: 10,
      }}>
        ▂▄▆
      </div>
    </motion.article>
  );
}

/* ── Control Button ──────────────────────────── */
function ControlBtn({
  icon, active, onClick, danger, label, wide,
}: {
  icon: React.ReactNode; active?: boolean; onClick: () => void;
  danger?: boolean; label?: string; wide?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -2, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        minWidth: wide ? 'auto' : 48, height: 48,
        padding: wide ? '0 16px' : 0,
        border: danger ? 'none' : '1px solid #352641',
        borderRadius: 15, cursor: 'pointer',
        background: danger ? '#ff405b' : active ? '#2a173e' : '#17101f',
        color: danger ? '#fff' : active ? '#dcaaff' : '#d1c6da',
        borderColor: active ? '#8849bf' : '#352641',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: label ? 8 : 0, fontSize: label ? 12 : 17, fontWeight: label ? 800 : 400,
      }}
    >
      {icon}
      {label && <span>{label}</span>}
    </motion.button>
  );
}

/* ── Main page ───────────────────────────────── */
export default function VoiceRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { room, participants, isMuted, isCameraOff, toggleMic, toggleCamera, disconnect } = useVoiceStore();

  const [sideTab, setSideTab] = useState<'people' | 'chat'>('people');
  const [chatMsg, setChatMsg] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: '1', author: 'Luna', text: 'Vocês estão me ouvindo?' },
    { id: '2', author: 'Guilherme', text: 'Sim, perfeitamente!' },
  ]);
  const [speakerIdx, setSpeakerIdx] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [roomName, setRoomName] = useState('Sala de voz');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const myInitials = user?.username?.slice(0, 2).toUpperCase() ?? 'GV';
  const myName = user?.username ?? 'Guilherme';

  /* Fake participants for demo */
  const DEMO_PEOPLE = [
    { id: 'me', name: myName, initials: myInitials, c1: '#ff7620', c2: '#6d27d9', isMuted: isMuted },
    { id: 'luna', name: 'Luna', initials: 'LU', c1: '#bc4cff', c2: '#3d1c82', isMuted: false },
    { id: 'rafael', name: 'Rafael', initials: 'RF', c1: '#17a9cf', c2: '#2f427c', isMuted: true },
    { id: 'marina', name: 'Marina', initials: 'MA', c1: '#ff558d', c2: '#7b2dac', isMuted: false },
  ];

  /* Rotate speaker every 3.3s */
  useEffect(() => {
    const t = setInterval(() => {
      setSpeakerIdx(prev => {
        let next = (prev + 1) % DEMO_PEOPLE.length;
        if (next === 2) next = 3; // skip muted Rafael
        return next;
      });
    }, 3300);
    return () => clearInterval(t);
  }, []);

  /* Clock */
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* Fetch room name */
  useEffect(() => {
    if (params?.serverId && params?.roomId) {
      api.get(`/servers/${params.serverId}/voice-rooms/${params.roomId}`)
        .then(({ data }) => { if (data?.name) setRoomName(data.name); })
        .catch(() => {});
    }
  }, [params]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  function fmtTime(s: number) {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }

  function handleLeave() {
    disconnect();
    router.push(`/app/servers/${params?.serverId}`);
  }

  function sendChatMsg() {
    if (!chatMsg.trim()) return;
    setChatMessages(prev => [...prev, { id: Date.now().toString(), author: myName, text: chatMsg.trim() }]);
    setChatMsg('');
  }

  return (
    <div style={{
      height: '100vh', display: 'grid',
      gridTemplateColumns: '76px minmax(0,1fr) 280px',
      background: 'radial-gradient(circle at 50% -20%,#32134f,transparent 35%),#08060c',
      color: '#f7f3ff', fontFamily: 'Inter,system-ui,sans-serif', fontSize: 14,
      overflow: 'hidden',
    }}>
      {/* ── Rail ── */}
      <nav style={{
        borderRight: '1px solid #30223d', background: '#0c0911',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '16px 0', gap: 13,
      }}>
        <button
          onClick={() => router.push(`/app/servers/${params?.serverId}`)}
          style={{
            width: 48, height: 48, border: 0, borderRadius: 16, color: '#fff',
            fontSize: 22, fontWeight: 900,
            background: 'linear-gradient(135deg,#ff6a00,#7a2cff)',
            boxShadow: '0 0 28px rgba(122,44,255,0.3)', cursor: 'pointer',
          }}
        >
          N
        </button>
        {['⌂', '◖', '▣', '#', '♙'].map((icon, i) => (
          <button key={i} style={{
            width: 43, height: 43, border: '1px solid transparent', borderRadius: 14,
            background: i === 1 ? '#1c1227' : 'transparent',
            color: i === 1 ? '#fff' : '#8d8299', cursor: 'pointer', fontSize: 18,
            boxShadow: i === 1 ? 'inset 3px 0 #ff6a00' : 'none',
          }}>
            {icon}
          </button>
        ))}
        <div style={{
          marginTop: 'auto', width: 43, height: 43, borderRadius: 15,
          display: 'grid', placeItems: 'center', fontWeight: 800,
          background: 'linear-gradient(145deg,#ff7d20,#6424cc)', position: 'relative',
        }}>
          {myInitials}
          <div style={{
            position: 'absolute', right: -1, bottom: -1, width: 10, height: 10,
            background: '#43e3a3', border: '3px solid #0c0911', borderRadius: '50%',
          }} />
        </div>
      </nav>

      {/* ── Stage ── */}
      <main style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{
          height: 70, display: 'flex', alignItems: 'center',
          padding: '0 22px', borderBottom: '1px solid #30223d',
          background: 'rgba(12,9,19,0.72)', backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 38, height: 38, display: 'grid', placeItems: 'center',
            borderRadius: 12, background: '#22142f', color: '#c887ff', marginRight: 11,
          }}>◖</div>
          <div>
            <h1 style={{ fontSize: 15, margin: 0 }}>{roomName}</h1>
            <p style={{ margin: '2px 0 0', color: '#92879f', fontSize: 11 }}>
              {params?.serverId ? 'Nexus Central' : 'Comunidade'} · {DEMO_PEOPLE.length} participantes
            </p>
          </div>
          <div style={{
            marginLeft: 'auto', color: '#8bdcb9', fontSize: 11,
            border: '1px solid #26523f', borderRadius: 20, padding: '7px 10px',
          }}>
            ◆ Conexão protegida
          </div>
          <div style={{
            marginLeft: 10, padding: '7px 10px', color: '#b4a7c0',
            background: '#17101e', borderRadius: 20,
            fontVariantNumeric: 'tabular-nums', fontSize: 13,
          }}>
            {fmtTime(seconds)}
          </div>
        </header>

        {/* 2×2 grid */}
        <section style={{
          flex: 1, minHeight: 0, padding: 18,
          display: 'grid',
          gridTemplateColumns: 'repeat(2,minmax(240px,1fr))',
          gridTemplateRows: 'repeat(2,minmax(190px,1fr))',
          gap: 12,
        }}>
          {DEMO_PEOPLE.map((p, i) => (
            <PersonCard
              key={p.id}
              name={p.name}
              initials={p.initials}
              c1={p.c1}
              c2={p.c2}
              isSpeaking={i === speakerIdx}
              isMuted={p.isMuted}
              isMe={p.id === 'me'}
            />
          ))}
        </section>

        {/* Controls */}
        <footer style={{
          height: 84, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 9,
          borderTop: '1px solid #30223d', background: '#0c0912', flexShrink: 0,
        }}>
          <ControlBtn
            icon={isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            active={isMuted}
            onClick={toggleMic}
          />
          <ControlBtn
            icon={isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
            active={isCameraOff}
            onClick={toggleCamera}
          />
          <ControlBtn
            icon={<Monitor size={18} />}
            active={isSharing}
            onClick={() => { setIsSharing(s => !s); router.push(`/app/servers/${params?.serverId}/stream`); }}
            wide
            label="Compartilhar tela"
          />
          <ControlBtn icon={<Star size={17} />} onClick={() => {}} />
          <ControlBtn icon={<MoreHorizontal size={17} />} onClick={() => {}} />
          <ControlBtn icon={<PhoneOff size={18} />} danger onClick={handleLeave} />
        </footer>
      </main>

      {/* ── Side panel ── */}
      <aside style={{
        borderLeft: '1px solid #30223d', background: '#0d0a12',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Tabs */}
        <div style={{
          height: 70, display: 'flex', alignItems: 'flex-end',
          padding: '0 14px', borderBottom: '1px solid #30223d', flexShrink: 0,
        }}>
          {(['people', 'chat'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setSideTab(tab)}
              style={{
                height: 45, flex: 1, border: 0, background: 'transparent',
                color: sideTab === tab ? '#fff' : '#81758d',
                fontWeight: 800, cursor: 'pointer', fontSize: 13,
                borderBottom: sideTab === tab ? '2px solid #ff6a00' : '2px solid transparent',
              }}
            >
              {tab === 'people' ? `Pessoas · ${DEMO_PEOPLE.length}` : 'Chat'}
            </button>
          ))}
        </div>

        {/* People panel */}
        <AnimatePresence mode="wait">
          {sideTab === 'people' && (
            <motion.div
              key="people"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ padding: 15, overflowY: 'auto', flex: 1 }}
            >
              <h3 style={{ margin: '2px 0 13px', fontSize: 11, color: '#786e83', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
                Na chamada agora
              </h3>
              {DEMO_PEOPLE.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '9px 7px', borderRadius: 11,
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                    display: 'grid', placeItems: 'center',
                    background: `linear-gradient(145deg,${p.c1},${p.c2})`,
                    fontWeight: 900, fontSize: 11, color: '#fff',
                  }}>
                    {p.initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{p.name}</div>
                    <div style={{ color: '#92879f', fontSize: 10 }}>
                      {i === 0 ? 'Organizador' : p.isMuted ? 'Microfone desligado' : 'Conectado'}
                    </div>
                  </div>
                  <div style={{
                    marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%',
                    background: '#43e3a3', boxShadow: '0 0 8px #43e3a3',
                  }} />
                </div>
              ))}
              <div
                style={{
                  margin: '10px 0', border: '1px dashed #4d3560', borderRadius: 13,
                  padding: 12, color: '#b99dcf', textAlign: 'center',
                  background: '#17101e', cursor: 'pointer', fontSize: 12,
                }}
              >
                ＋ Convidar amigos
              </div>
            </motion.div>
          )}

          {/* Chat panel */}
          {sideTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ flex: 1, overflowY: 'auto', padding: 15, display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ flex: 1 }}>
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      background: '#17101f', padding: '10px 12px',
                      borderRadius: 11, marginBottom: 8, fontSize: 12,
                    }}
                  >
                    <strong style={{ color: '#ff9750', display: 'block', marginBottom: 3, fontSize: 11 }}>
                      {msg.author}
                    </strong>
                    {msg.text}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat input (only in chat tab) */}
        {sideTab === 'chat' && (
          <div style={{ padding: '0 12px 12px', flexShrink: 0 }}>
            <input
              value={chatMsg}
              onChange={e => setChatMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChatMsg()}
              placeholder="Enviar mensagem..."
              style={{
                width: '100%', border: '1px solid #352742', borderRadius: 12,
                background: '#17101f', color: '#eee', padding: '10px 12px',
                outline: 'none', fontSize: 13, boxSizing: 'border-box',
              }}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
