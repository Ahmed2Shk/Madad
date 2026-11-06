// PH-01 لوحة تحكم الصيدلية
import { CircleCheck, CircleHelp, Clock, Eye, ListChecks, MessageSquare, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, EmptyState, ErrorBanner, Freshness, StatCard, buttonClass, useToast } from '../../components/ui';
import { useAddMedicine, usePortalOverview, usePortalStock, useSaveStock } from '../../data/portalQueries';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { formatDateTime } from '../../lib/format';
import { usePharmacyCtx } from './context';
import { usePrefs } from '../../data/providerQueries';
import { useNow } from '../../hooks/useNow';
import { localDayMinutes } from '../../lib/hours';
import { HistoryLine } from './HistoryLine';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { pick, lang } = useLang();
  const toast = useToast();
  const { orgId, can } = usePharmacyCtx();
  const overview = usePortalOverview(orgId);
  const stock = usePortalStock(orgId);
  const catalog = useCatalog();
  const add = useAddMedicine(orgId);
  const save = useSaveStock(orgId);
  const med = (id: string) => catalog.data?.medicines.find((m) => m.id === id);

  if (overview.isPending) return <CardSkeleton />;
  if (overview.isError || !overview.data) return <ErrorBanner onRetry={() => void overview.refetch()} />;
  const o = overview.data;
  const needsUpdate = o.stale + o.expired;
  const maxSearches = Math.max(1, ...o.searchesByDay.map((d) => d.count));
  const viewsUp = o.viewsThisWeek >= o.viewsLastWeek;

  // "لدي هذا الدواء": add it (or set it) as available right away.
  const iHaveIt = async (medicineId: string) => {
    const listed = stock.data?.some((r) => r.medicineId === medicineId);
    if (listed) await save.mutateAsync([{ medicineId, status: 'available', clientUpdatedAt: new Date().toISOString() }]);
    else await add.mutateAsync({ medicineId, status: 'available' });
    toast(t('dashboard.added', { name: pick(med(medicineId)) }));
  };

  return (
    <div className="space-y-6">
      <DailyReminder needsUpdate={(overview.data?.stale ?? 0) + (overview.data?.expired ?? 0)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page">{t('dashboard.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/pharmacy-portal/update" className={buttonClass('primary')}>
            <RefreshCw aria-hidden className="size-4" />
            {t('portal.pharmacy.nav.update')}
          </Link>
          <Link to="/pharmacy-portal/profile#preview" className={buttonClass('secondary')}>
            <Eye aria-hidden className="size-4" />
            {t('dashboard.previewAsPatient')}
          </Link>
        </div>
      </div>

      <div className="rise-children grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t('dashboard.listed')} value={o.listed} icon={ListChecks} to="/pharmacy-portal/medicines" />
        <StatCard label={t('dashboard.fresh')} value={o.fresh} icon={CircleCheck} tone="ok" />
        <StatCard label={t('dashboard.stale')} value={o.stale} icon={Clock} tone="warn" to="/pharmacy-portal/update?filter=needs" />
        <StatCard label={t('dashboard.expired')} value={o.expired} icon={CircleHelp} tone="unknown" to="/pharmacy-portal/update?filter=needs" />
        <StatCard label={t('dashboard.newInquiries')} value={o.newInquiries} icon={MessageSquare} tone="review" to="/pharmacy-portal/inquiries" />
      </div>

      {needsUpdate > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-warn-icon bg-warn-bg p-5">
          <div className="flex items-center gap-3">
            <Clock aria-hidden className="size-8 text-warn-icon" />
            <div>
              <h2 className="text-section text-warn-text">{t('dashboard.needsUpdate', { count: needsUpdate })}</h2>
              <p className="text-meta text-warn-text">{t('dashboard.needsUpdateHint')}</p>
            </div>
          </div>
          {can('availability') && (
            <Link to="/pharmacy-portal/update?filter=needs" className={buttonClass('primary')}>
              {t('dashboard.updateNow')}
            </Link>
          )}
        </section>
      )}

      <div className="rise-children grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="unmet-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
          <h2 id="unmet-title" className="text-section">
            {t('dashboard.unmetTitle')}
          </h2>
          <p className="text-meta text-ink-muted">{t('dashboard.unmetHint')}</p>
          {o.unmetNearby.length === 0 ? (
            <p className="mt-4 text-ink-muted">{t('dashboard.unmetEmpty')}</p>
          ) : (
            <ul className="rise-children mt-4 divide-y divide-border">
              {o.unmetNearby.map((u) => (
                <li key={u.medicineId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">{pick(med(u.medicineId))}</p>
                    <p className="text-meta text-ink-muted">{t('dashboard.searchedTimes', { count: u.count })}</p>
                  </div>
                  {(can('medicines') || can('availability')) && (
                    <Button size="sm" variant="secondary" loading={add.isPending || save.isPending} onClick={() => iHaveIt(u.medicineId)}>
                      {t('dashboard.iHaveIt')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="activity-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
          <h2 id="activity-title" className="text-section">
            {t('dashboard.activity')}
          </h2>
          {o.activity.length === 0 ? (
            <EmptyState icon={ListChecks} title={t('dashboard.noActivity')} />
          ) : (
            <ol className="rise-children mt-3 space-y-3">
              {o.activity.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 last:border-0">
                  <HistoryLine entry={h} />
                  <Freshness at={h.createdAt} bare />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="views-title" className="grid gap-4 rounded-card border border-border bg-surface p-5 shadow-card md:grid-cols-[220px_1fr]">
        <div>
          <h2 id="views-title" className="text-section">
            {t('dashboard.views')}
          </h2>
          <p className="mt-2 text-[28px] leading-tight font-semibold">
            <bdi>{o.viewsThisWeek}</bdi>
          </p>
          <p className={viewsUp ? 'inline-flex items-center gap-1 text-meta text-ok-text' : 'inline-flex items-center gap-1 text-meta text-bad-text'}>
            {viewsUp ? <TrendingUp aria-hidden className="size-4" /> : <TrendingDown aria-hidden className="size-4" />}
            {t('dashboard.lastWeek', { count: o.viewsLastWeek })}
          </p>
        </div>
        <figure>
          <figcaption className="mb-2 text-meta text-ink-muted">{t('dashboard.searchesChart')}</figcaption>
          {/* Plain CSS bars: Recharts stays in the admin bundle only (SPEC §12). */}
          <ul className="flex h-32 items-end gap-2" aria-label={t('dashboard.searchesChart')}>
            {o.searchesByDay.map((d) => (
              <li key={d.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-micro text-ink-muted">
                  <bdi>{d.count}</bdi>
                </span>
                <span
                  className="w-full rounded-t-[6px] bg-secondary"
                  style={{ height: `${Math.max(4, (d.count / maxSearches) * 100)}%` }}
                  title={`${formatDateTime(new Date(d.date), lang)} · ${d.count}`}
                />
                <span className="text-micro text-ink-muted">
                  {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { weekday: 'short' }).format(new Date(d.date))}
                </span>
              </li>
            ))}
          </ul>
        </figure>
      </section>
    </div>
  );
}

/** PH-10 daily reminder: from the chosen hour (Palestine time), while some reports need updating. */
function DailyReminder({ needsUpdate }: { needsUpdate: number }) {
  const { t } = useTranslation();
  const now = useNow();
  const prefs = usePrefs();
  const hour = prefs.data?.reminderHour;
  if (hour == null || needsUpdate === 0 || localDayMinutes(now).minutes < hour * 60) return null;
  return (
    <p role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-warn-bg p-3 text-warn-text">
      <span className="flex items-center gap-2 font-medium">
        <Clock aria-hidden className="size-5 text-warn-icon" />
        {t('dashboard.reminder', { count: needsUpdate })}
      </span>
      <Link to="/pharmacy-portal/update?filter=needs" className={buttonClass('primary', 'sm')}>
        {t('phNotif.updateNow')}
      </Link>
    </p>
  );
}
