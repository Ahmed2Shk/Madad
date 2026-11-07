import { useTranslation } from 'react-i18next';
import { DAYS, type Hours } from '../../lib/hours';

const ORDER = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;

export function HoursList({ hours }: { hours: Hours }) {
  const { t } = useTranslation();
  return (
    <dl className="space-y-1 text-meta">
      {ORDER.filter((d) => DAYS.includes(d)).map((d) => {
        const ranges = hours[d];
        return (
          <div key={d} className="flex justify-between gap-4">
            <dt className="text-ink-muted">{t(`days.${d}`)}</dt>
            <dd>
              {ranges?.length ? (
                ranges.some(([o, c]) => o === '00:00' && c === '24:00') ? (
                  t('hours.allDay')
                ) : (
                  <bdi dir="ltr">{ranges.map(([o, c]) => `${o}–${c}`).join(', ')}</bdi>
                )
              ) : (
                t('hours.closed')
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** «مفتوحة/مغلقة الآن»; `masculine` for a hospital («المستشفى مفتوح»). */
export function OpenNowBadge({ open, masculine = false }: { open: boolean | null; masculine?: boolean }) {
  const { t } = useTranslation();
  if (open === null) return null;
  return (
    <span className={open ? 'text-meta font-medium text-ok-text' : 'text-meta font-medium text-bad-text'}>
      {open ? t(masculine ? 'hours.openNowM' : 'hours.openNow') : t(masculine ? 'hours.closedNowM' : 'hours.closedNow')}
    </span>
  );
}
