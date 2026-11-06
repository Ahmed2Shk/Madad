import { CircleCheck, CircleX } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { ToastContext, type ToastAction, type ToastKind } from './useToast';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, kind: ToastKind = 'success', options?: { action?: ToastAction; durationMs?: number }) => {
      const id = nextId.current++;
      setItems((xs) => [...xs, { id, kind, message, action: options?.action }]);
      setTimeout(() => dismiss(id), options?.durationMs ?? 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-6 z-50 flex flex-col items-center gap-2"
      >
        {items.map((it) => {
          const Icon = it.kind === 'success' ? CircleCheck : CircleX;
          return (
            <div
              key={it.id}
              role="status"
              className={cn(
                'pointer-events-auto flex animate-pop items-center gap-2 rounded-card px-4 py-3 shadow-dialog',
                it.kind === 'success' ? 'bg-ok-bg text-ok-text' : 'bg-bad-bg text-bad-text',
              )}
            >
              <Icon aria-hidden className={cn('size-5', it.kind === 'success' ? 'text-ok-icon' : 'text-bad-icon')} />
              {it.message}
              {it.action && (
                <button
                  type="button"
                  onClick={() => {
                    it.action!.onClick();
                    dismiss(it.id);
                  }}
                  className="press ms-2 min-h-9 rounded-control border border-current px-3 font-semibold"
                >
                  {it.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
