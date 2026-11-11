import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, type LucideIcon } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type ToastListener = (toast: ToastItem) => void;
const listeners = new Set<ToastListener>();

/** UI-22: Hata mesajları okunabilsin diye daha uzun ekranda kalır. */
const TOAST_DURATION_MS: Record<ToastType, number> = {
  success: 3000,
  info: 3500,
  error: 6000
};

/**
 * Tüm uygulama state'ini yeniden render etmeden yalnızca ToastHost bileşenine bildirim gönderir.
 */
export function emitAppToast(message: string, type: ToastType = 'info') {
  const item: ToastItem = {
    id: Math.random().toString(36).slice(2, 9),
    message,
    type
  };
  listeners.forEach(fn => fn(item));
}

const TOAST_ICON: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info
};

export const ToastHost: React.FC = React.memo(() => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    const handler: ToastListener = (item) => {
      // Aynı mesaj zaten ekrandaysa yığmak yerine süresini yenile
      setToasts(prev => {
        const dup = prev.find(t => t.message === item.message && t.type === item.type);
        if (dup) {
          const old = timers.get(dup.id);
          if (old !== undefined) window.clearTimeout(old);
          timers.set(dup.id, window.setTimeout(() => dismiss(dup.id), TOAST_DURATION_MS[dup.type]));
          return prev;
        }
        timers.set(item.id, window.setTimeout(() => dismiss(item.id), TOAST_DURATION_MS[item.type]));
        // Ekranda en fazla 3 bildirim
        return [...prev, item].slice(-3);
      });
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
      timers.forEach(t => window.clearTimeout(t));
      timers.clear();
    };
  }, [dismiss]);

  // UI-22: Canlı bölge her zaman DOM'da (ekran okuyucular ilk bildirimi de duyurur);
  // masaüstünde max-w-md, mobilde alt gezinme çubuğunun ve güvenli alanın üstünde.
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] md:bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none"
    >
      {toasts.map(toast => {
        const Icon = TOAST_ICON[toast.type];
        return (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : undefined}
            className={`pl-4 pr-1.5 py-1.5 min-h-[52px] rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto ${
              toast.type === 'success'
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : toast.type === 'error'
                ? 'bg-rose-600 border-rose-500 text-white'
                : 'bg-stone-800 border-stone-700 text-stone-100'
            }`}
          >
            <Icon size={18} className="shrink-0" />
            <div className="flex-1 font-bold text-sm leading-snug py-1.5 break-words">{toast.message}</div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Bildirimi kapat"
              className="w-11 h-11 min-w-[44px] min-h-[44px] shrink-0 rounded-xl flex items-center justify-center opacity-80 hover:opacity-100 hover:bg-black/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
});
