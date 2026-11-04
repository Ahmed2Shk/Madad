import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TabDef {
  id: string;
  label: string;
  count?: number;
}

/** ARIA tabs with arrow-key navigation that follows the reading direction. */
export function Tabs({
  tabs,
  active,
  onChange,
  children,
  label,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  children: ReactNode;
  label: string;
}) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, i: number) => {
    const rtl = document.documentElement.dir === 'rtl';
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (i + step + tabs.length) % tabs.length;
    onChange(tabs[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 border-b border-border">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`${base}-panel`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              '-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 font-medium',
              active === t.id ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className="rounded-full bg-mint px-2 text-micro text-primary">{t.count}</span>
            )}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-${active}`} className="pt-4">
        {children}
      </div>
    </div>
  );
}
