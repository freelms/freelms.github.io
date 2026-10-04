import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast { id: number; msg: string; actionLabel?: string; onAction?: () => void; }
const Ctx = createContext<{ push: (msg: string, opts?: { actionLabel?: string; onAction?: () => void }) => void; toasts: Toast[] }>({ push: () => {}, toasts: [] });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((msg: string, opts?: { actionLabel?: string; onAction?: () => void }) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <Ctx.Provider value={{ push, toasts }}>
      {children}
      <div className="no-print fixed right-4 top-16 z-[60] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="card flex items-center gap-2 border-l-4 border-l-indigo-600 px-4 py-2.5 text-sm shadow-xl">
            <span className="flex-1">{t.msg}</span>
            {t.actionLabel && (
              <button className="underline font-medium text-indigo-600" onClick={() => { t.onAction?.(); setToasts((s) => s.filter((x) => x.id !== t.id)); }}>
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
