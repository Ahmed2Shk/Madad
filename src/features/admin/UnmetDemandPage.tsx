// AD-06 خريطة الطلب غير الملبّى — anonymous, aggregated failed searches; cells under 5 come back hidden.
import { Download, FlaskConical, Map as MapIcon, Pill, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CardSkeleton, EmptyState, ErrorBanner, StatCard, buttonClass } from '../../components/ui';
import { governorateById } from '../../data';
import { useAdminCatalog, useUnmetDemand } from '../../data/adminQueries';
import { useLang } from '../../hooks/useLang';
import { cn } from '../../lib/cn';
import { toCsv } from '../../lib/csv';
import { downloadText } from '../../lib/download';
import { env } from '../../lib/env';
import { MIN_CELL } from '../../lib/suppression';

const PERIODS = [7, 30, 90] as const;

export default function UnmetDemandPage() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [category, setCategory] = useState('all');
  const [region, setRegion] = useState<'gaza' | 'west_bank'>('gaza');
  const demand = useUnmetDemand(days, category, region);
  const catalog = useAdminCatalog();
  const med = (id: string) => pick(catalog.data?.medicines.find((m) => m.id === id));

  if (demand.isPending) return <CardSkeleton />;
  if (demand.isError || !demand.data) return <ErrorBanner onRetry={() => void demand.refetch()} />;
  const d = demand.data;
  const max = Math.max(1, ...d.matrix.cells.flat().map((c) => c ?? 0));
  const govName = (g: string) => pick(governorateById(g));

  // Export the suppressed numbers only: what the screen shows is what leaves the platform.
  const exportCsv = () => {
    const header = [t('table.medicine'), ...d.governorates.map(govName), t('admin.total')];
    const rows = d.medicineIds.map((id, i) => [med(id), ...d.matrix.cells[i]!.map((c) => (c === null ? `<${MIN_CELL}` : c)), d.matrix.rowTotals[i] ?? '']);
    downloadText(`madad-unmet-demand-${region}-${days}d.csv`, toCsv(header, [...rows, [t('admin.total'), ...d.matrix.colTotals.map((c) => c ?? ''), d.matrix.total]]));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page">{t('portal.admin.nav.unmetDemand')}</h1>
        <button type="button" onClick={exportCsv} className={buttonClass('secondary')}>
          <Download aria-hidden className="size-4" />
          {t('admin.exportCsv')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t('admin.period')} className="inline-flex rounded-control border border-border bg-surface p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={days === p}
              onClick={() => setDays(p)}
              className={cn('min-h-10 rounded-[8px] px-3 font-medium', days === p ? 'bg-primary text-white' : 'text-ink hover:bg-canvas')}
            >
              {t('admin.days', { count: p })}
            </button>
          ))}
        </div>
        <select aria-label={t('medicine.category')} value={category} onChange={(e) => setCategory(e.target.value)} className="min-h-11 rounded-control border border-border bg-surface px-3">
          <option value="all">{t('meds.allCategories')}</option>
          {catalog.data?.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {pick(c)}
            </option>
          ))}
        </select>
        <select aria-label={t('admin.region')} value={region} onChange={(e) => setRegion(e.target.value as typeof region)} className="min-h-11 rounded-control border border-border bg-surface px-3">
          <option value="gaza">{t('gov.regionGaza')}</option>
          <option value="west_bank">{t('gov.regionWestBank')}</option>
        </select>
      </div>

      <div className="rise-children grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t('admin.failedSearches')} value={d.failedTotal.toLocaleString('en')} icon={SearchX} tone="warn" note={env.demo ? t('demo.badge') : undefined} />
        <StatCard label={t('admin.requestedMedicines')} value={d.medicineIds.length} icon={Pill} note={env.demo ? t('demo.badge') : undefined} />
        <StatCard label={t('admin.governorates')} value={d.governorates.length} icon={MapIcon} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {d.medicineIds.length === 0 ? (
          <EmptyState icon={SearchX} title={t('admin.noDemand')} />
        ) : (
          <div role="region" tabIndex={0} aria-label={t('portal.admin.nav.unmetDemand')} className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full text-meta">
              <caption className="sr-only">{t('portal.admin.nav.unmetDemand')}</caption>
              <thead className="bg-canvas text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t('table.medicine')}
                  </th>
                  {d.governorates.map((g) => (
                    <th key={g} scope="col" className="px-2 py-2 text-center font-medium whitespace-nowrap">
                      {govName(g)}
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-2 text-center font-medium">
                    {t('admin.total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.medicineIds.map((id, i) => (
                  <tr key={id} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-start font-medium">
                      {med(id)}
                    </th>
                    {d.matrix.cells[i]!.map((c, j) => {
                      // Sequential: one hue, light → mid teal by count. Capped at 58% so dark ink keeps 4.5:1 contrast.
                      const share = c === null || c === 0 ? 0 : 8 + Math.round((c / max) * 50);
                      return (
                        <td key={j} className="p-0.5 text-center">
                          <span
                            className={cn('flex h-9 items-center justify-center rounded-[6px] font-medium', c === null ? 'text-ink-muted' : 'text-ink')}
                            style={share ? { background: `color-mix(in srgb, var(--color-primary) ${share}%, var(--color-surface))` } : undefined}
                            title={c === null ? t('admin.hiddenCell', { min: MIN_CELL }) : undefined}
                          >
                            {c === null ? '—' : <bdi>{c}</bdi>}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2 text-center font-semibold">{d.matrix.rowTotals[i] ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section aria-labelledby="unmatched-title" className="self-start rounded-card border border-border bg-surface p-4 shadow-card">
          <h2 id="unmatched-title" className="text-section">
            {t('admin.unmatched')}
          </h2>
          <p className="text-meta text-ink-muted">{t('admin.unmatchedHint')}</p>
          {d.unmatched.length === 0 ? (
            <p className="mt-3 text-ink-muted">{t('admin.noUnmatched')}</p>
          ) : (
            <ul className="rise-children mt-3 divide-y divide-border">
              {d.unmatched.map((u) => (
                <li key={u.query} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{u.query}</span>
                    <span className="ms-2 text-micro text-ink-muted">
                      <bdi>{u.count}</bdi>
                    </span>
                  </span>
                  <Link to={`/admin/catalog?tab=catalog&add=${encodeURIComponent(u.query)}`} className="inline-flex min-h-10 items-center gap-1 text-meta font-medium text-primary hover:underline">
                    <Plus aria-hidden className="size-4" />
                    {t('admin.addToCatalog')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-meta text-ink-muted">
        {t('admin.demandFootnote', { min: MIN_CELL })}
        {env.demo && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-micro text-warn-text">
            <FlaskConical aria-hidden className="size-3.5" />
            {t('demo.badge')}
          </span>
        )}
      </p>
    </div>
  );
}
