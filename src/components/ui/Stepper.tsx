import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

/** Steps of the organization registration (SPEC §5, A-05). */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  const { t } = useTranslation();
  return (
    <ol aria-label={t('register.progress')} className="flex flex-wrap items-center gap-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="flex items-center gap-2">
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-full border text-meta font-semibold',
                done && 'border-primary bg-primary text-white',
                active && 'border-primary bg-mint text-primary',
                !done && !active && 'border-border bg-surface text-ink-muted',
              )}
            >
              {done ? <Check aria-hidden className="size-4" /> : <bdi>{i + 1}</bdi>}
            </span>
            <span className={cn('font-medium', active ? 'text-ink' : 'text-ink-muted')}>{label}</span>
            {i < steps.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
