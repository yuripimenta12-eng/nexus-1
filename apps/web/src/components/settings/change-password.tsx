'use client';
import { useState } from 'react';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';
import api from '@/lib/api';

// Mesma regra do cadastro/redefinição: 8+ caracteres, maiúscula, minúscula e número ou símbolo
const STRONG = /((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;

function PasswordInput({
  label, value, onChange, autoComplete,
}: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-xs text-muted uppercase tracking-wider">{label}</label>
      <div className="relative mt-1">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full bg-surface-raised rounded px-3 py-2 pr-11 text-white text-sm
                     border border-border focus:border-accent outline-none transition-colors"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'Esconder senha' : 'Mostrar senha'}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 text-muted hover:text-white"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); setError(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!current) return setError('Digite sua senha atual');
    if (next.length < 8 || !STRONG.test(next)) {
      return setError('A nova senha precisa ter 8+ caracteres, com letra maiúscula, minúscula e um número ou símbolo');
    }
    if (next !== confirm) return setError('A confirmação não bate com a nova senha');
    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      reset();
      setOpen(false);
      setDone(true);
      setTimeout(() => setDone(false), 5000);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg[0] : msg || 'Não foi possível trocar a senha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--th-line)] bg-[var(--th-panel)] p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Senha</h3>
          <p className="text-[#92879f] text-xs mt-1">
            Ao trocar, os outros aparelhos conectados na sua conta são desconectados.
          </p>
        </div>
        {!open && (
          <button
            onClick={() => { setOpen(true); setDone(false); }}
            className="shrink-0 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors"
          >
            Trocar senha
          </button>
        )}
      </div>

      {done && (
        <p className="flex items-center gap-2 text-success text-sm">
          <Check className="w-4 h-4" /> Senha alterada com sucesso!
        </p>
      )}

      {open && (
        <form onSubmit={submit} className="space-y-3">
          <PasswordInput label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" />
          <PasswordInput label="Nova senha" value={next} onChange={setNext} autoComplete="new-password" />
          <PasswordInput label="Confirmar nova senha" value={confirm} onChange={setConfirm} autoComplete="new-password" />
          {error && <p className="text-destructive text-xs">{error}</p>}
          <p className="text-muted text-xs">
            Esqueceu a senha atual? Saia da conta e use “Esqueceu a senha?” na tela de login.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { reset(); setOpen(false); }}
              className="px-4 py-2 rounded-lg bg-surface-raised hover:bg-surface-overlay text-muted hover:text-white text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium
                         disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar nova senha
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
