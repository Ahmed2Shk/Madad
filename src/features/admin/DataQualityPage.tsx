// AD-05 جودة بيانات التوفر — remind, hide one report with a reason, or suspend. There is no
// "confirm availability" action on purpose (SPEC §2 rule 5).
import { BellRing, EyeOff, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CardSkeleton,
  DataTable,
  Dialog,
  EmptyState,
  ErrorBanner,
  Field,
  Freshness,
  inputClass,
  useToast,
  type Column,
} from '../../components/ui';
import { governorateById, type ConflictRow, type QualityRow } from '../../data';
import { useDataQuality, useHideReport, useRemindPharmacy } from '../../data/adminQueries';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { cn } from '../../lib/cn';

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function DataQualityPage() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const quality = useDataQuality();
  const catalog = useCatalog();
  const remind = useRemindPharmacy();
  const hide = useHideReport();
  const [hiding, setHiding] = useState<ConflictRow | null>(null);
  const [reason, setReason] = useState('');
  const med = (id: string) => pick(catalog.data?.medicines.find((m) => m.id === id));

  if (quality.isPending) return <CardSkeleton />;
  if (quality.isError || !quality.data) return <ErrorBanner onRetry={() => void quality.refetch()} />;
  const q = quality.data;
  const names = new Map(q.pharmacies.map((p) => [p.pharmacyId, pick(p)]));

  const columns: Column<QualityRow>[] = [
    { key: 'name', header: t('admin.col.name'), cell: (p) => <span className="font-medium">{pick(p)}</span>, sortValue: (p) => pick(p), hideInCard: true },
    { key: 'gov', header: t('gov.label'), cell: (p) => pick(governorateById(p.governorate)), sortValue: (p) => p.governorate },
    {
      key: 'fresh',
      header: t('admin.col.freshRatio'),
      cell: (p) => <span className={cn('font-semibold', p.freshRatio < 0.5 ? 'text-bad-text' : 'text-ok-text')}>{pct(p.freshRatio)}</span>,
      sortValue: (p) => p.freshRatio,
    },
    { key: 'last', header: t('pharmacies.lastStockUpdate'), cell: (p) => (p.lastUpdate ? <Freshness at={p.lastUpdate} /> : '—'), sortValue: (p) => p.lastUpdate ?? '' },
    { key: 'reports', header: t('admin.col.reports'), cell: (p) => p.reportsAgainst, sortValue: (p) => p.reportsAgainst },
    {
      key: 'confirm',
      header: t('admin.col.confirmAll'),
      cell: (p) => (
        <span className={cn('inline-flex items-center gap-1', p.confirmAllRatio > 0.7 && 'font-semibold text-warn-text')}>
          {p.confirmAllRatio > 0.7 && <TriangleAlert aria-label={t('admin.boxTicking')} className="size-4 text-warn-icon" />}
          {pct(p.confirmAllRatio)}
        </span>
      ),
      sortValue: (p) => p.confirmAllRatio,
    },
    {
      key: 'actions',
      header: t('table.actions'),
      cell: (p) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await remind.mutateAsync(p.pharmacyId);
            toast(t('admin.reminded', { name: pick(p) }));
          }}
        >
          <BellRing aria-hidden className="size-4" />
          {t('admin.remind')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-page">{t('portal.admin.nav.dataQuality')}</h1>

      <section aria-labelledby="dist-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 id="dist-title" className="text-section mb-3">
          {t('admin.distribution')}
        </h2>
        <ul className="rise-children space-y-2">
          {q.byGov.map((g) => {
            const total = g.fresh + g.stale + g.expired || 1;
            return (
              <li key={g.governorate} className="grid grid-cols-[120px_1fr] items-center gap-3 text-meta">
                <span>{pick(governorateById(g.governorate))}</span>
                {/* Status colors with text labels in the legend below; widths are proportions of the governorate's reports. */}
                <span className="flex h-5 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={t('admin.distAria', { fresh: g.fresh, stale: g.stale, expired: g.expired })}>
                  <span className="bg-ok-icon" style={{ width: `${(g.fresh / total) * 100}%` }} />
                  <span className="bg-warn-icon" style={{ width: `${(g.stale / total) * 100}%` }} />
                  <span className="bg-unknown-icon" style={{ width: `${(g.expired / total) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex flex-wrap gap-4 text-micro text-ink-muted">
          <span className="inline-flex items-center gap-1"><span className="size-3 rounded-full bg-ok-icon" />{t('meds.fresh.fresh')}</span>
          <span className="inline-flex items-center gap-1"><span className="size-3 rounded-full bg-warn-icon" />{t('meds.fresh.stale')}</span>
          <span className="inline-flex items-center gap-1"><span className="size-3 rounded-full bg-unknown-icon" />{t('meds.fresh.expired')}</span>
        </p>
      </section>

      <section aria-labelledby="conflicts-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 id="conflicts-title" className="text-section">
          {t('admin.conflicts')}
        </h2>
        <p className="text-meta text-ink-muted">{t('admin.conflictsHint')}</p>
        {q.conflicts.length === 0 ? (
          <p className="mt-3 text-ink-muted">{t('admin.noConflicts')}</p>
        ) : (
          <ul className="rise-children mt-3 divide-y divide-border">
            {q.conflicts.map((c) => (
              <li key={c.reportId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  <span className="font-medium">{names.get(c.pharmacyId)}</span> · {med(c.medicineId)}
                  <span className="block text-meta text-ink-muted">
                    {t('admin.conflictLine')} <Freshness at={c.reportedAt} bare /> · {t('admin.reportedWrong')} <Freshness at={c.reportedWrongAt} bare />
                  </span>
                </span>
                <Button variant="danger" size="sm" onClick={() => setHiding(c)}>
                  <EyeOff aria-hidden className="size-4" />
                  {t('admin.hideReport')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="follow-title" className="space-y-3">
        <h2 id="follow-title" className="text-section">
          {t('admin.followUp')}
        </h2>
        <DataTable
          caption={t('admin.followUp')}
          rows={q.pharmacies}
          columns={columns}
          rowKey={(p) => p.pharmacyId}
          cardTitle={(p) => pick(p)}
          empty={<EmptyState icon={TriangleAlert} title={t('admin.noOrgs')} />}
        />
      </section>

      <Dialog
        open={!!hiding}
        onClose={() => setHiding(null)}
        title={t('admin.hideReport')}
        size="sm"
        footer={
          <Button
            variant="danger"
            disabled={!reason.trim()}
            loading={hide.isPending}
            onClick={async () => {
              await hide.mutateAsync({ pharmacyId: hiding!.pharmacyId, medicineId: hiding!.medicineId, reason });
              toast(t('admin.reportHidden'));
              setHiding(null);
              setReason('');
            }}
          >
            {t('admin.hideReport')}
          </Button>
        }
      >
        <p className="mb-3 text-ink-muted">{t('admin.hideBody')}</p>
        <Field label={t('admin.reason')}>
          <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
