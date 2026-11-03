import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';

export function Disclaimer({ variant = 'full', className }: { variant?: 'full' | 'short'; className?: string }) {
  const { t } = useTranslation();
  return (
    <aside
      className={cn('flex gap-3 rounded-card border border-border bg-surface p-4 text-meta text-ink-muted', className)}
    >
      <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-secondary" />
      <p>{t(`disclaimer.${variant}`)}</p>
    </aside>
  );
}
