import { CircleCheck, CircleX } from 'lucide-react';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { ToastContext, type ToastKind } from './useToast';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = nextId.current++;
    setItems((xs) => [...xs, { id, kind, message }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4000);
  }, []);

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
                'pointer-events-auto flex items-center gap-2 rounded-card px-4 py-3 shadow-dialog',
                it.kind === 'success' ? 'bg-ok-bg text-ok-text' : 'bg-bad-bg text-bad-text',
              )}
            >
              <Icon aria-hidden className={cn('size-5', it.kind === 'success' ? 'text-ok-icon' : 'text-bad-icon')} />
              {it.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
