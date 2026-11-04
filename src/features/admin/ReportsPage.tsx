// AD-07 البلاغات — patient reports about availability, organizations and content.
import { Flag } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, EmptyState, ErrorBanner, FilterChips, Freshness, inputClass, useToast } from '../../components/ui';
import { governorateById, type AdminReport, type ReportStatus } from '../../data';
import { useAdminReports, useUpdateReport } from '../../data/adminQueries';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { cn } from '../../lib/cn';

const STATUSES: ReportStatus[] = ['new', 'in_review', 'resolved', 'rejected'];
const tone: Record<ReportStatus, string> = {
  new: 'bg-review-bg text-review-text',
  in_review: 'bg-warn-bg text-warn-text',
  resolved: 'bg-ok-bg text-ok-text',
  rejected: 'bg-unknown-bg text-unknown-text',
};

export default function ReportsPage() {
  const { t } = useTranslation();
  const reports = useAdminReports();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [selected, setSelected] = useState<string | null>(null);

  if (reports.isPending) return <CardSkeleton />;
  if (reports.isError) return <ErrorBanner onRetry={() => void reports.refetch()} />;
  const list = (reports.data ?? []).filter((r) => filter === 'all' || r.status === 'new' || r.status === 'in_review');
  const current = list.find((r) => r.id === selected) ?? list[0];

  return (
    <div className="space-y-4">
      <h1 className="text-page">{t('portal.admin.nav.reports')}</h1>
      <FilterChips
        label={t('filters.label')}
        onToggle={(id) => setFilter(id as 'open' | 'all')}
        chips={[
          { id: 'open', label: t('admin.openReports'), on: filter === 'open' },
          { id: 'all', label: t('update.filter.all'), on: filter === 'all' },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState icon={Flag} title={t('admin.noReports')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <ul className="divide-y divide-border self-start rounded-card border border-border bg-surface" aria-label={t('portal.admin.nav.reports')}>
            {list.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-current={current?.id === r.id ? 'true' : undefined}
                  onClick={() => setSelected(r.id)}
                  className={cn('block w-full p-4 text-start hover:bg-canvas', current?.id === r.id && 'bg-mint')}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t(`admin.reportType.${r.reason}`)}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-micro font-medium', tone[r.status])}>{t(`admin.reportStatus.${r.status}`)}</span>
                  </span>
                  <span className="mt-1 block truncate text-meta text-ink-muted">{r.details || '—'}</span>
                  <Freshness at={r.createdAt} bare className="text-micro" />
                </button>
              </li>
            ))}
          </ul>
          {current && <ReportDetail key={current.id} r={current} />}
        </div>
      )}
    </div>
  );
}

function Target({ r }: { r: AdminReport }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const catalog = useCatalog();
  const med = (id: string) => pick(catalog.data?.medicines.find((m) => m.id === id));
  if (r.entityType === 'pharmacy')
    return (
      <Link to={`/pharmacy/${r.entityId}`} className="text-primary hover:underline">
        {t('admin.openPharmacy')} <bdi dir="ltr">{r.entityId}</bdi>
      </Link>
    );
  if (r.entityType === 'availability') {
    const [ph, m] = r.entityId.split('/');
    return (
      <Link to={`/pharmacy/${ph}?medicine=${m}`} className="text-primary hover:underline">
        {med(m!)} · <bdi dir="ltr">{ph}</bdi>
      </Link>
    );
  }
  if (r.entityType === 'medicine')
    return (
      <Link to={`/medicine/${r.entityId}`} className="text-primary hover:underline">
        {med(r.entityId)}
      </Link>
    );
  return <span>{r.entityId}</span>;
}

function ReportDetail({ r }: { r: AdminReport }) {
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const update = useUpdateReport();
  const [note, setNote] = useState(r.adminNote ?? '');
  const [resolution, setResolution] = useState(r.resolution ?? '');
  const [status, setStatus] = useState<ReportStatus>(r.status);

  return (
    <section aria-label={t(`admin.reportType.${r.reason}`)} className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="text-section">{t(`admin.reportType.${r.reason}`)}</h2>
      <dl className="grid gap-2 text-meta sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">{t('admin.target')}</dt>
          <dd>
            <Target r={r} />
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">{t('gov.label')}</dt>
          <dd>{r.governorate && r.governorate !== 'all' ? pick(governorateById(r.governorate)) : '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-ink-muted">{t('admin.reportText')}</dt>
          <dd>{r.details || '—'}</dd>
        </div>
      </dl>
      <label className="block">
        <span className="font-medium">{t('admin.col.status')}</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as ReportStatus)} className={`${inputClass} mt-1`}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`admin.reportStatus.${s}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-medium">{t('admin.adminNote')}</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass} mt-1 py-2`} />
      </label>
      <label className="block">
        <span className="font-medium">{t('admin.resolution')}</span>
        <input value={resolution} onChange={(e) => setResolution(e.target.value)} className={`${inputClass} mt-1`} />
      </label>
      <Button
        loading={update.isPending}
        onClick={async () => {
          await update.mutateAsync({ id: r.id, status, adminNote: note, resolution });
          toast(t('profile.saved'));
        }}
      >
        {t('common.save')}
      </Button>
    </section>
  );
}
