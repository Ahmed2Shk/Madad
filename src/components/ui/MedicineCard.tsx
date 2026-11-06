import { ChevronLeft, ChevronRight, Pill } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Medicine } from '../../data';
import { useLang } from '../../hooks/useLang';
import type { MedicineSummary } from '../../lib/availability';
import { Freshness } from './Freshness';

/** Medicine line: names, generic, strength, form, and how many pharmacies reported it available. */
export function MedicineCard({ medicine, summary, to }: { medicine: Medicine; summary: MedicineSummary; to: string }) {
  const { t } = useTranslation();
  const { lang, pick, strength } = useLang();
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;
  return (
    <Link
      to={to}
      className="lift flex items-center gap-4 rounded-card border border-border bg-surface p-4 shadow-card hover:border-secondary"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-mint">
        <Pill aria-hidden className="size-6 text-secondary" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-section">{pick(medicine)}</h2>
        <p className="text-meta text-ink-muted">
          <bdi dir="ltr">{medicine.genericName}</bdi>
          {medicine.strength && <> · {strength(medicine)}</>} · {t(`forms.${medicine.dosageForm}`)}
        </p>
        <p className="mt-1 text-meta">
          {summary.availableCount > 0 ? (
            <>
              <span className="font-medium text-ok-text">{t('search.reportedAvailable', { count: summary.availableCount })}</span>
              {summary.lastAvailableAt && (
                <>
                  {' · '}
                  <Freshness at={summary.lastAvailableAt} />
                </>
              )}
            </>
          ) : (
            <span className="text-ink-muted">{t('search.noRecentReports')}</span>
          )}
        </p>
      </div>
      <Chevron aria-hidden className="size-5 shrink-0 text-ink-muted" />
    </Link>
  );
}
