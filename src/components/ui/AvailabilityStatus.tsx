import { useTranslation } from 'react-i18next';
import type { ReportView } from '../../lib/freshness';
import { Freshness } from './Freshness';
import { StatusBadge } from './StatusBadge';
import type { PharmacyAvailability } from '../../data';

/**
 * Badge + "updated …" line — the only way an availability state is shown (SPEC §2 rule 4).
 * "Needs update" also says what the last report was.
 */
export function AvailabilityStatus({ row, view }: { row: PharmacyAvailability; view: ReportView }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <StatusBadge status={view.display} />
      {view.display === 'needs_update' && (
        <span className="text-meta text-warn-text">
          {t('freshness.lastReport', { status: t(`status.${row.reportedStatus}`) })}
        </span>
      )}
      <Freshness at={row.reportedAt} />
    </div>
  );
}
