'use client';
import { useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

// Segunda etapa do login quando a conta tem verificação em duas etapas
export function TwoFactorStep({ ticket, onDone, onCancel }: { ticket: string; onDone: () => void; onCancel: () => void }) {
  const loginTwoFactor = useAuthStore(s => s.loginTwoFactor);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [recovery]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const clean = recovery ? code.trim() : code.replace(/\D/g, '');
    if (!recovery && clean.length !== 6) return setError('Digite os 6 números do app');
    if (recovery && clean.length < 10) return setError('Digite o código de recuperação completo');
    setBusy(true);
    try {
      await loginTwoFactor(ticket, clean);
      onDone();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg || 'Código incorreto');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={submit}
        className="relative w-full max-w-sm rounded-2xl border border-[#7a2cff55] bg-[#140e1c] p-7 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-200">
        <button type="button" onClick={onCancel} aria-label="Voltar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full grid place-items-center text-[#8a7f98] hover:text-white hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
        <span className="mx-auto mb-3 w-12 h-12 rounded-2xl grid place-items-center bg-gradient-to-br from-[#ff6a00] to-[#7a2cff]">
          {recovery ? <KeyRound className="w-6 h-6 text-white" /> : <ShieldCheck className="w-6 h-6 text-white" />}
        </span>
        <h2 className="text-white text-lg font-bold mb-1">Verificação em duas etapas</h2>
        <p className="text-[#afa4bb] text-sm mb-5">
          {recovery
            ? 'Digite um dos seus códigos de recuperação (cada um vale uma vez).'
            : 'Abra o app autenticador e digite o código de 6 números do Nexus Link.'}
        </p>
        <input
          ref={inputRef}
          value={code}
          onChange={e => setCode(recovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode={recovery ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          placeholder={recovery ? 'XXXXX-XXXXX' : '000000'}
          className="w-full text-center tracking-[0.4em] text-2xl font-bold bg-[#0d0912] border border-[#38294a] focus:border-[#7a2cff] rounded-xl py-3 text-white outline-none"
        />
        {error && <p className="text-[#ff7b82] text-xs mt-2">{error}</p>}
        <button type="submit" disabled={busy}
          className="mt-4 w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-[#ff6a00] to-[#7a2cff] disabled:opacity-60 flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
        </button>
        <button type="button" onClick={() => { setRecovery(r => !r); setCode(''); setError(''); }}
          className="mt-3 text-xs text-[#c9a6ff] hover:text-white">
          {recovery ? 'Usar o código do app' : 'Perdi o celular — usar código de recuperação'}
        </button>
      </form>
    </div>
  );
}
