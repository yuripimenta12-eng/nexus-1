'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic, Volume2, Camera, MonitorUp, Sparkles, AudioLines,
  SlidersHorizontal, Play, Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaStore, InputProfile, ScreenQuality } from '@/stores/media.store';
import { useVoiceStore } from '@/stores/voice.store';

interface DeviceOption { deviceId: string; label: string; }

export function VoiceVideoSettings() {
  const ms = useMediaStore();
  const { switchAudioInput, switchAudioOutput, switchVideoInput, setInputVolume, applyOutputVolume } = useVoiceStore();

  const [mics, setMics] = useState<DeviceOption[]>([]);
  const [speakers, setSpeakers] = useState<DeviceOption[]>([]);
  const [cameras, setCameras] = useState<DeviceOption[]>([]);
  const [needsPermission, setNeedsPermission] = useState(false);

  // ── Enumeração de dispositivos ─────────────────────────────────
  const loadDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const named = devices.some(d => d.label);
      setNeedsPermission(!named && devices.length > 0);
      const map = (kind: MediaDeviceKind, fallback: string): DeviceOption[] =>
        devices
          .filter(d => d.kind === kind)
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `${fallback} ${i + 1}` }));
      setMics(map('audioinput', 'Microfone'));
      setSpeakers(map('audiooutput', 'Saída'));
      setCameras(map('videoinput', 'Câmera'));
    } catch { /* sem suporte */ }
  }, []);

  useEffect(() => {
    loadDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', loadDevices);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', loadDevices);
  }, [loadDevices]);

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));
      stream?.getTracks().forEach(t => t.stop());
    } catch { /* negado */ }
    loadDevices();
  };

  // Reconstrói o microfone ao vivo quando o processamento muda (se em chamada)
  const rebuildMicIfLive = () => {
    const vs = useVoiceStore.getState();
    if (vs.isConnected && vs.localMicEnabled) {
      vs.switchAudioInput(useMediaStore.getState().audioInputId);
    }
  };

  const profiles: { id: InputProfile; title: string; desc: string }[] = [
    { id: 'isolation', title: 'Isolamento de Voz', desc: 'Só a sua voz: o Nexus corta ruído, eco e nivela o volume.' },
    { id: 'studio', title: 'Estúdio', desc: 'Áudio puro, sem nenhum processamento. Para quem tem setup próprio.' },
    { id: 'custom', title: 'Personalizado', desc: 'Modo avançado: você controla cada filtro individualmente.' },
  ];

  return (
    <div className="space-y-8">
      {/* ── Dispositivos ─────────────────────────────────────── */}
      <section>
        <SectionLabel>Dispositivos</SectionLabel>

        {needsPermission && (
          <button
            onClick={requestPermission}
            className="w-full mb-3 border border-dashed border-[#4d3560] rounded-[13px] p-3 text-[#b99dcf]
                       text-sm bg-[var(--th-panel-2)] hover:border-accent hover:text-white transition-colors"
          >
            🔒 Clique para permitir acesso e listar seus dispositivos pelo nome
          </button>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <DeviceSelect
            icon={<Mic className="w-4 h-4" />}
            label="Microfone"
            value={ms.audioInputId}
            options={mics}
            onChange={(id) => switchAudioInput(id)}
          />
          <DeviceSelect
            icon={<Volume2 className="w-4 h-4" />}
            label="Alto-falante"
            value={ms.audioOutputId}
            options={speakers}
            onChange={(id) => switchAudioOutput(id)}
          />
          <DeviceSelect
            icon={<Camera className="w-4 h-4" />}
            label="Câmera"
            value={ms.videoInputId}
            options={cameras}
            onChange={(id) => switchVideoInput(id)}
          />
        </div>
      </section>

      {/* ── Volumes ──────────────────────────────────────────── */}
      <section>
        <SectionLabel>Volumes</SectionLabel>
        <div className="grid sm:grid-cols-2 gap-4">
          <VolumeSlider
            label="Volume do microfone"
            value={ms.inputVolume}
            max={200}
            onChange={(v) => setInputVolume(v)}
          />
          <VolumeSlider
            label="Volume de saída"
            value={ms.outputVolume}
            max={100}
            onChange={(v) => { ms.setOutputVolume(v); applyOutputVolume(); }}
          />
        </div>

        <MicTest />
      </section>

      {/* ── Perfil de entrada ────────────────────────────────── */}
      <section>
        <SectionLabel>Perfil de entrada</SectionLabel>
        <div className="grid gap-2.5">
          {profiles.map((p) => {
            const active = ms.inputProfile === p.id;
            const Icon = p.id === 'isolation' ? Sparkles : p.id === 'studio' ? AudioLines : SlidersHorizontal;
            return (
              <button
                key={p.id}
                onClick={() => { ms.setInputProfile(p.id); rebuildMicIfLive(); }}
                className={cn(
                  'relative flex items-center gap-4 text-left rounded-2xl border p-4 transition-all',
                  active
                    ? 'border-[#8b48ff] bg-gradient-to-br from-[#26143c] to-[#160e22] shadow-[0_0_24px_rgba(122,44,255,0.15)]'
                    : 'border-[var(--th-line)] bg-[var(--th-panel)] hover:border-[#4d3560]',
                )}
              >
                <span className={cn(
                  'w-11 h-11 rounded-[14px] grid place-items-center shrink-0 transition-all',
                  active
                    ? 'bg-gradient-to-br from-orange to-accent text-white'
                    : 'bg-[var(--th-panel-2)] text-[#8c5dcc]',
                )}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <b className={cn('block text-sm', active ? 'text-white' : 'text-[#cfc6dd]')}>{p.title}</b>
                  <small className="block text-xs text-[#92879f] mt-0.5">{p.desc}</small>
                </span>
                <span className={cn(
                  'ml-auto w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 transition-all',
                  active ? 'border-orange' : 'border-[#3d2b4a]',
                )}>
                  {active && <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-orange to-accent" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filtros individuais (modo personalizado) */}
        {ms.inputProfile === 'custom' && (
          <div className="mt-3 rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] divide-y divide-[var(--th-line)]">
            <ToggleRow
              label="Supressão de ruído"
              desc="Remove ruídos de fundo como ventilador e teclado"
              checked={ms.noiseSuppression}
              onChange={(v) => { ms.setNoiseSuppression(v); rebuildMicIfLive(); }}
            />
            <ToggleRow
              label="Cancelamento de eco"
              desc="Evita que o som dos outros retorne pelo seu microfone"
              checked={ms.echoCancellation}
              onChange={(v) => { ms.setEchoCancellation(v); rebuildMicIfLive(); }}
            />
            <ToggleRow
              label="Controle automático de ganho"
              desc="Mantém o volume da sua voz estável"
              checked={ms.autoGainControl}
              onChange={(v) => { ms.setAutoGainControl(v); rebuildMicIfLive(); }}
            />
          </div>
        )}
      </section>

      {/* ── Compartilhamento de tela ─────────────────────────── */}
      <section>
        <SectionLabel>Compartilhamento de tela</SectionLabel>
        <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] divide-y divide-[var(--th-line)]">
          <div className="flex items-center gap-4 p-4">
            <span className="w-11 h-11 rounded-[14px] grid place-items-center shrink-0 bg-[var(--th-panel-2)] text-[#8c5dcc]">
              <MonitorUp className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <b className="block text-sm text-[#cfc6dd]">Qualidade padrão da transmissão</b>
              <small className="block text-xs text-[#92879f] mt-0.5">Resolução e fluidez ao compartilhar sua tela</small>
            </div>
            <select
              value={ms.screenQuality}
              onChange={(e) => ms.setScreenQuality(e.target.value as ScreenQuality)}
              className="bg-[var(--th-rail)] border border-[#3d2b4a] rounded-xl px-3 py-2 text-sm text-white
                         focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="720p30">720p · 30fps</option>
              <option value="1080p30">1080p · 30fps</option>
              <option value="1080p60">1080p · 60fps</option>
            </select>
          </div>
          <ToggleRow
            label="Perguntar qualidade antes de transmitir"
            desc="Mostra o seletor de qualidade na chamada antes de cada compartilhamento"
            checked={ms.askScreenQuality}
            onChange={ms.setAskScreenQuality}
          />
        </div>
      </section>
    </div>
  );
}

// ── Rótulo de seção ──────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-orange text-[11px] font-extrabold uppercase tracking-[1.5px] mb-3">
      {children}
    </p>
  );
}

// ── Seletor de dispositivo ───────────────────────────────────────
function DeviceSelect({
  icon, label, value, options, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: DeviceOption[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-3
                      focus-within:border-accent transition-colors cursor-pointer">
      <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 text-white
                       bg-gradient-to-br from-orange to-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <small className="block text-[10px] text-[#92879f] uppercase tracking-wider font-bold">{label}</small>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-white text-sm focus:outline-none cursor-pointer
                     [&>option]:bg-[var(--th-panel)]"
        >
          <option value="">Padrão do sistema</option>
          {options.filter(o => o.deviceId && o.deviceId !== 'default').map(o => (
            <option key={o.deviceId} value={o.deviceId}>{o.label}</option>
          ))}
        </select>
      </span>
    </label>
  );
}

// ── Slider de volume ─────────────────────────────────────────────
function VolumeSlider({
  label, value, max, onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-4">
      <div className="flex items-center justify-between mb-3">
        <b className="text-sm text-[#cfc6dd]">{label}</b>
        <span className="text-xs font-black tabular-nums px-2 py-0.5 rounded-full text-white
                         bg-gradient-to-r from-orange to-accent">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="nx-range"
        style={{ ['--fill' as any]: `${(value / max) * 100}%` }}
      />
      {max > 100 && (
        <div className="flex justify-between text-[9px] text-[#5c5468] mt-1">
          <span>0%</span><span>100%</span><span>200%</span>
        </div>
      )}
    </div>
  );
}

// ── Toggle Nexus ─────────────────────────────────────────────────
function ToggleRow({
  label, desc, checked, onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
    >
      <div className="min-w-0 flex-1">
        <b className="block text-sm text-[#cfc6dd]">{label}</b>
        <small className="block text-xs text-[#92879f] mt-0.5">{desc}</small>
      </div>
      <span className={cn(
        'relative w-11 h-6 rounded-full shrink-0 transition-all duration-200',
        checked ? 'bg-gradient-to-r from-orange to-accent' : 'bg-[#2a2138]',
      )}>
        <span className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200',
          checked ? 'left-[22px]' : 'left-0.5',
        )} />
      </span>
    </button>
  );
}

// ── Teste do microfone com medidor ao vivo ───────────────────────
function MicTest() {
  const [testing, setTesting] = useState(false);
  const [level, setLevel] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setTesting(false);
    setLevel(0);
  }, []);

  const start = async () => {
    const ms = useMediaStore.getState();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: ms.audioInputId ? { exact: ms.audioInputId } : undefined,
          echoCancellation: ms.echoCancellation,
          noiseSuppression: ms.noiseSuppression,
          autoGainControl: ms.autoGainControl,
        },
      });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = ms.inputVolume / 100;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(gain);
      gain.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        // Atualiza o ganho ao vivo caso o usuário mexa no slider durante o teste
        gain.gain.value = useMediaStore.getState().inputVolume / 100;
        setLevel(Math.min(1, rms * 2.2));
        raf = requestAnimationFrame(tick);
      };
      tick();

      cleanupRef.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach(t => t.stop());
        ctx.close().catch(() => {});
      };
      setTesting(true);
    } catch {
      /* permissão negada */
    }
  };

  useEffect(() => stop, [stop]);

  const BARS = 32;
  const lit = Math.round(level * BARS);

  return (
    <div className="mt-4 rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-4 flex items-center gap-4">
      <button
        onClick={testing ? stop : start}
        className={cn(
          'h-10 px-4 rounded-xl text-sm font-extrabold flex items-center gap-2 shrink-0 transition-all active:scale-95',
          testing
            ? 'bg-destructive text-white'
            : 'text-white bg-gradient-to-r from-orange to-accent shadow-[0_5px_18px_rgba(255,90,0,0.25)]',
        )}
      >
        {testing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        {testing ? 'Parar teste' : 'Testar microfone'}
      </button>

      <div className="flex-1 flex items-center gap-[3px] h-8">
        {Array.from({ length: BARS }).map((_, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm transition-all duration-75"
            style={{
              height: `${30 + (i % 3) * 20}%`,
              background: i < lit
                ? `linear-gradient(180deg, #ff6a00, #7a2cff)`
                : '#241b31',
              boxShadow: i < lit ? '0 0 6px rgba(255,106,0,0.35)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}
