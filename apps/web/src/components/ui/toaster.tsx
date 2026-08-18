'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// Singleton simples para toasts
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toastQueue: Toast[] = [];

export function toast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).slice(2);
  toastQueue = [...toastQueue, { id, message, type }];
  toastListeners.forEach(fn => fn(toastQueue));

  setTimeout(() => {
    toastQueue = toastQueue.filter(t => t.id !== id);
    toastListeners.forEach(fn => fn(toastQueue));
  }, 4000);
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast[]) => setToasts([...t]);
    toastListeners.push(listener);
    return () => { toastListeners = toastListeners.filter(l => l !== listener); };
  }, []);

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-success" />,
    error: <XCircle className="w-4 h-4 text-destructive" />,
    info: <Info className="w-4 h-4 text-accent" />,
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 50, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            className="flex items-start gap-3 p-3.5 rounded-xl bg-surface border border-border shadow-2xl"
          >
            <span className="shrink-0 mt-0.5">{icons[t.type]}</span>
            <p className="text-white text-sm flex-1">{t.message}</p>
            <button
              onClick={() => {
                toastQueue = toastQueue.filter(q => q.id !== t.id);
                toastListeners.forEach(fn => fn(toastQueue));
              }}
              className="text-muted hover:text-white shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
