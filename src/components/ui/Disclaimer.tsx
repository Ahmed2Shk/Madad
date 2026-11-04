import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../data/queries';
import { cn } from '../../lib/cn';

/** Disclaimer box (SPEC §2 rule 10). The full text can be edited by the admin in AD-11. */
export function Disclaimer({ variant = 'full', className }: { variant?: 'full' | 'short'; className?: string }) {
  const { t, i18n } = useTranslation();
  const { data: settings } = useSettings();
  const custom = variant === 'full' ? (i18n.language === 'en' ? settings?.disclaimerEn : settings?.disclaimerAr) : null;
  return (
    <aside
      className={cn('flex gap-3 rounded-card border border-border bg-surface p-4 text-meta text-ink-muted', className)}
    >
      <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-secondary" />
      <p>{custom || t(`disclaimer.${variant}`)}</p>
    </aside>
  );
}
