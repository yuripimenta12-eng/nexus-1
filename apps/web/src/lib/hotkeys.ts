'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Atalhos de teclado da chamada (cada pessoa escolhe os seus; ficam salvos
// neste aparelho, porque cada teclado/PC é diferente).
export interface Hotkey {
  code: string;   // tecla física (KeyboardEvent.code), ex.: "BracketLeft", "KeyM", "F8"
  key: string;    // como a tecla aparece, ex.: "[", "M", "F8"
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export type HotkeyAction = 'mute' | 'deafen';

interface HotkeysState {
  mute: Hotkey | null;
  deafen: Hotkey | null;
  // App de PC: funcionar também com o jogo (ou outra janela) em primeiro plano
  global: boolean;
  setHotkey: (action: HotkeyAction, hk: Hotkey | null) => void;
  setGlobal: (on: boolean) => void;
}

export const useHotkeys = create<HotkeysState>()(
  persist(
    (set) => ({
      mute: null,
      deafen: null,
      global: true,
      setHotkey: (action, hk) => set({ [action]: hk } as any),
      setGlobal: (global) => set({ global }),
    }),
    { name: 'nexus-atalhos' },
  ),
);

const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight',
  'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight',
]);

// Tecla pressionada → atalho (null se for só Ctrl/Alt/Shift sozinho)
export function hotkeyFromEvent(e: KeyboardEvent | React.KeyboardEvent): Hotkey | null {
  if (MODIFIER_CODES.has(e.code) || !e.code) return null;
  let key = e.key;
  if (e.code.startsWith('Key')) key = e.code.slice(3);
  else if (e.code.startsWith('Digit')) key = e.code.slice(5);
  else if (e.code.startsWith('Numpad')) key = 'Num ' + e.code.slice(6);
  else if (key === ' ') key = 'Espaço';
  else if (key.length === 1) key = key.toUpperCase();
  return { code: e.code, key, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey };
}

export function formatHotkey(hk: Hotkey | null): string {
  if (!hk) return 'Nenhum';
  const parts: string[] = [];
  if (hk.ctrl) parts.push('Ctrl');
  if (hk.alt) parts.push('Alt');
  if (hk.shift) parts.push('Shift');
  if (hk.meta) parts.push('Win');
  parts.push(hk.key);
  return parts.join(' + ');
}

export function matchesHotkey(e: KeyboardEvent, hk: Hotkey | null): boolean {
  return !!hk && e.code === hk.code && e.ctrlKey === hk.ctrl && e.altKey === hk.alt
    && e.shiftKey === hk.shift && e.metaKey === hk.meta;
}

export function sameHotkey(a: Hotkey | null, b: Hotkey | null) {
  return !!a && !!b && a.code === b.code && a.ctrl === b.ctrl && a.alt === b.alt && a.shift === b.shift && a.meta === b.meta;
}

export const hasModifier = (hk: Hotkey) => hk.ctrl || hk.alt || hk.meta;

// Formato do Electron (globalShortcut) para o app de PC
const CODE_TO_ACCEL: Record<string, string> = {
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=', Backquote: '`',
  Space: 'Space', Tab: 'Tab', Enter: 'Enter', Backspace: 'Backspace', Delete: 'Delete',
  Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  ScrollLock: 'Scrolllock', CapsLock: 'Capslock', NumLock: 'Numlock', PrintScreen: 'PrintScreen',
  NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
  IntlBackslash: '\\', IntlRo: '/',
};
export function toAccelerator(hk: Hotkey | null): string | null {
  if (!hk) return null;
  let k: string | undefined;
  if (/^Key[A-Z]$/.test(hk.code)) k = hk.code.slice(3);
  else if (/^Digit[0-9]$/.test(hk.code)) k = hk.code.slice(5);
  else if (/^Numpad[0-9]$/.test(hk.code)) k = 'num' + hk.code.slice(6);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(hk.code)) k = hk.code;
  else k = CODE_TO_ACCEL[hk.code];
  if (!k) return null;
  const mods: string[] = [];
  if (hk.ctrl) mods.push('Control');
  if (hk.alt) mods.push('Alt');
  if (hk.shift) mods.push('Shift');
  if (hk.meta) mods.push('Super');
  return [...mods, k].join('+');
}
