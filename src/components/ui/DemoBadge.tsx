import { FlaskConical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { env } from '../../lib/env';

/** Fixed "بيانات تجريبية" badge, rendered only when VITE_DEMO=true. */
export function DemoBadge() {
  const { t } = useTranslation();
  if (!env.demo) return null;
  return (
    <div className="pointer-events-none fixed start-3 bottom-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-warn-icon bg-warn-bg px-2.5 py-1 text-micro font-medium text-warn-text shadow-card">
      <FlaskConical aria-hidden className="size-3.5 text-warn-icon" />
      {t('demo.badge')}
    </div>
  );
}
