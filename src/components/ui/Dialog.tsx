import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

/**
 * Modal built on <dialog>: native focus trap, Esc to close, focus returns to the opener.
 * `side` renders the SPEC §5 Sheet: a panel that slides in from the end edge.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  side = false,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useTranslation();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        'bg-surface p-0 text-ink shadow-dialog backdrop:bg-ink/40',
        side
          ? cn('my-0 ms-auto me-0 h-dvh max-h-dvh w-full rounded-none', size === 'lg' ? 'max-w-4xl' : 'max-w-md')
          : cn('m-auto w-[calc(100%-2rem)] rounded-dialog', { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]),
      )}
    >
      <div className="flex h-full max-h-[90dvh] flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-section">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="inline-flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-canvas"
          >
            <X aria-hidden className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-3 border-t border-border px-5 py-4">{footer}</footer>}
      </div>
    </dialog>
  );
}
