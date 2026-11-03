import { useTranslation } from 'react-i18next';
import { formatDateTime, formatRelative, type Lang } from '../../lib/format';
import { useNow } from '../../hooks/useNow';
import { cn } from '../../lib/cn';

/** "حُدّث قبل 12 دقيقة" with the full date as a tooltip. */
export function Freshness({ at, className }: { at: Date | string; className?: string }) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const date = typeof at === 'string' ? new Date(at) : at;
  const lang: Lang = i18n.language === 'en' ? 'en' : 'ar';
  const full = formatDateTime(date, lang);
  return (
    <time dateTime={date.toISOString()} title={full} className={cn('text-meta text-ink-muted', className)}>
      {t('freshness.updated', { time: formatRelative(date, now, lang) })}
    </time>
  );
}
