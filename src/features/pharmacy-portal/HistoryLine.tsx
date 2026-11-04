import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../components/ui';
import type { HistoryEntry } from '../../data';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { formatPrice } from '../../lib/format';

/** One history row as text: who did what, from → to (PH-01 activity, PH-05). */
export function HistoryLine({ entry: h, showActor = true }: { entry: HistoryEntry; showActor?: boolean }) {
  const { t } = useTranslation();
  const { pick, lang } = useLang();
  const catalog = useCatalog();
  const name = pick(catalog.data?.medicines.find((m) => m.id === h.medicineId));
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  if (h.action === 'confirm_all')
    return (
      <span>
        {showActor && <strong className="font-medium">{h.actorName}: </strong>}
        {t('history.confirmAll', { count: h.count ?? 0 })}
      </span>
    );

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {showActor && <strong className="font-medium">{h.actorName}:</strong>}
      <span>{t(`history.actions.${h.action}`)}</span>
      <span className="font-medium">{name}</span>
      {h.action === 'update' && h.oldStatus && h.newStatus && (
        <>
          <StatusBadge status={h.oldStatus} />
          <Arrow aria-label={t('history.to')} className="size-4 text-ink-muted" />
          <StatusBadge status={h.newStatus} />
        </>
      )}
      {h.action === 'update' && h.newPrice !== h.oldPrice && (h.newPrice != null || h.oldPrice != null) && (
        <span className="inline-flex items-center gap-1 text-meta text-ink-muted">
          <bdi dir="ltr">{h.oldPrice != null ? formatPrice(h.oldPrice) : '—'}</bdi>
          <Arrow aria-label={t('history.to')} className="size-3.5" />
          <bdi dir="ltr">{h.newPrice != null ? formatPrice(h.newPrice) : '—'}</bdi>
        </span>
      )}
    </span>
  );
}
