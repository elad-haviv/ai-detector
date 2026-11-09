'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { he } from '@/lib/i18n/he';
import { IconX } from '../icons';

export interface ToastOptions {
  tone?: 'neutral' | 'success' | 'danger';
  /** Optional action button, e.g. undo. */
  action?: { label: string; onClick: () => void };
  /** ms before auto-dismiss (default 5000; 0 = stay until closed). */
  duration?: number;
}
interface ToastItem extends ToastOptions {
  id: number;
  message: ReactNode;
}

const Ctx = createContext<(message: ReactNode, opts?: ToastOptions) => void>(() => {});

/** `const toast = useToast(); toast('נשמר', { tone: 'success' })` */
export function useToast() {
  return useContext(Ctx);
}

/**
 * Toast stack. The region is always in the DOM with role="status" (polite live region) so screen
 * readers announce messages as they are added. Toasts never steal focus.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((message: ReactNode, opts: ToastOptions = {}) => {
    const id = ++seq.current;
    setItems((l) => [...l.slice(-2), { id, message, ...opts }]);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-label={he.ui.notifications}
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const { duration = 5000 } = item;
  useEffect(() => {
    if (!duration) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);
  const tone = item.tone === 'success' ? 'border-s-success' : item.tone === 'danger' ? 'border-s-danger' : 'border-s-accent';
  return (
    <div className={`fade-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border border-border border-s-4 ${tone} bg-surface px-4 py-2.5 shadow-[var(--shadow-lg)]`}>
      <div className="min-w-0 flex-1 text-sm">{item.message}</div>
      {item.action && (
        <button
          type="button"
          onClick={() => {
            item.action!.onClick();
            onDismiss();
          }}
          className="min-h-9 rounded-md px-2 text-sm font-bold text-accent hover:bg-surface-2"
        >
          {item.action.label}
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label={he.ui.dismiss} className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text">
        <IconX width={16} height={16} />
      </button>
    </div>
  );
}
