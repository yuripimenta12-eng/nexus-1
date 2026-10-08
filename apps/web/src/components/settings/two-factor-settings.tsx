'use client';
import { useState } from 'react';
import { Check, Copy, Download, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

type Step = 'idle' | 'scan' | 'codes' | 'disable';

// Cartão "Verificação em duas etapas" em Minha Conta
export function TwoFactorSettings() {
  const { user, refreshUser } = useAuthStore();
  const enabled = !!user?.twoFactorEnabled;
  const [step, setStep] = useState<Step>('idle');
  const [qr, setQr] = useState<{ qrDataUrl: string; manualKey: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fail = (e: any, fallback: string) => {
    const msg = e?.response?.data?.message;
    setError(Array.isArray(msg) ? msg[0] : msg || fallback);
  };

  const start = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setQr(data); setCode(''); setStep('scan');
    } catch (e) { fail(e, 'Não foi possível começar agora'); } finally { setBusy(false); }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.replace(/\D/g, '').length !== 6) return setError('Digite os 6 números que aparecem no app');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/2fa/enable', { code: code.replace(/\D/g, '') });
      setCodes(data.recoveryCodes || []); setStep('codes');
      refreshUser().catch(() => {});
    } catch (e) { fail(e, 'Código incorreto'); } finally { setBusy(false); }
  };

  const disable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password || !code.trim()) return setError('Preencha a senha e o código');
    setBusy(true);
    try {
      await api.post('/auth/2fa/disable', { password, code: code.trim() });
      setStep('idle'); setPassword(''); setCode('');
      refreshUser().catch(() => {});
    } catch (e) { fail(e, 'Não foi possível desligar'); } finally { setBusy(false); }
  };

  const downloadCodes = () => {
    const blob = new Blob([`Códigos de recuperação do Nexus Link (${user?.email})\nCada código vale uma vez.\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nexus-codigos-de-recuperacao.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const input = 'w-full bg-surface-raised rounded px-3 py-2 text-white text-sm border border-border focus:border-accent outline-none';

  return (
    <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            Verificação em duas etapas
            {enabled && <span className="text-[10px] font-black tracking-wider text-[#42e6a4] bg-[#42e6a4]/10 border border-[#42e6a4]/30 rounded-full px-2 py-0.5">LIGADA</span>}
          </h3>
          <p className="text-[#92879f] text-xs mt-1 leading-relaxed">
            Além da senha, o Nexus pede um código do app autenticador (Google Authenticator, Authy, 1Password…)
            ao entrar. Mesmo que alguém descubra sua senha, não consegue entrar.
          </p>
        </div>
        {step === 'idle' && (
          enabled ? (
            <button onClick={() => { setStep('disable'); setError(''); setCode(''); }}
              className="shrink-0 px-4 py-2 rounded-lg border border-[var(--th-line-2)] text-[#cfc6dd] hover:text-white text-sm font-medium flex items-center gap-2">
              <ShieldOff className="w-4 h-4" /> Desligar
            </button>
          ) : (
            <button onClick={start} disabled={busy}
              className="shrink-0 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Ativar
            </button>
          )
        )}
      </div>

      {step === 'scan' && qr && (
        <form onSubmit={confirm} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-5 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qrDataUrl} alt="QR code para o app autenticador" className="w-44 h-44 rounded-xl bg-white p-2 shrink-0" />
            <ol className="text-[13px] text-[#cfc6dd] space-y-2 list-decimal pl-5">
              <li>Abra o app autenticador no celular e toque em <b>adicionar conta</b> / <b>escanear QR code</b>.</li>
              <li>Aponte a câmera para o código ao lado.</li>
              <li>Sem câmera? Digite esta chave: <code className="text-[#ffb070] break-all">{qr.manualKey}</code></li>
              <li>Digite abaixo o código de 6 números que aparecer.</li>
            </ol>
          </div>
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric"
            autoComplete="one-time-code" placeholder="000000" className={`${input} text-center tracking-[0.4em] text-lg font-bold`} />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStep('idle')} className="px-4 py-2 rounded-lg bg-surface-raised text-muted hover:text-white text-sm">Cancelar</button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar e ligar
            </button>
          </div>
        </form>
      )}

      {step === 'codes' && (
        <div className="space-y-3">
          <p className="text-[13px] text-[#42e6a4] flex items-center gap-2"><Check className="w-4 h-4" /> Verificação em duas etapas ligada!</p>
          <p className="text-[13px] text-[#cfc6dd]">
            Guarde estes <b>códigos de recuperação</b> num lugar seguro. Se perder o celular, cada um permite entrar uma vez.
            <b className="text-[#ffb070]"> Eles não aparecem de novo.</b>
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm text-white bg-[var(--th-panel-2)] rounded-xl p-4">
            {codes.map(c => <span key={c}>{c}</span>)}
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={() => { navigator.clipboard.writeText(codes.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="px-4 py-2 rounded-lg bg-surface-raised text-[#cfc6dd] hover:text-white text-sm flex items-center gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button onClick={downloadCodes} className="px-4 py-2 rounded-lg bg-surface-raised text-[#cfc6dd] hover:text-white text-sm flex items-center gap-2">
              <Download className="w-4 h-4" /> Baixar .txt
            </button>
            <button onClick={() => { setStep('idle'); setCodes([]); }} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium">
              Já guardei
            </button>
          </div>
        </div>
      )}

      {step === 'disable' && (
        <form onSubmit={disable} className="space-y-3">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" autoComplete="current-password" className={input} />
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="Código do app (ou de recuperação)" autoComplete="one-time-code" className={input} />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStep('idle')} className="px-4 py-2 rounded-lg bg-surface-raised text-muted hover:text-white text-sm">Cancelar</button>
            <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-[#ed4245] hover:bg-[#d83c3e] text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Desligar verificação
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
