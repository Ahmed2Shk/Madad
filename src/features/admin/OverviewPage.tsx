// AD-01 نظرة عامة
import { BadgeCheck, BookOpen, Building2, CircleCheck, Flag, Hourglass, Search, SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CardSkeleton, ErrorBanner, StatCard } from '../../components/ui';
import { governorateById } from '../../data';
import { useAdminOverview } from '../../data/adminQueries';
import { useCatalog } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { env } from '../../lib/env';
import { ChartFigure, FreshnessStack, SearchesLine, TopUnmetBars } from './charts';

export default function OverviewPage() {
  const { t } = useTranslation();
  const { pick } = useLang();
  const overview = useAdminOverview();
  const catalog = useCatalog();
  if (overview.isPending) return <CardSkeleton />;
  if (overview.isError || !overview.data) return <ErrorBanner onRetry={() => void overview.refetch()} />;
  const o = overview.data;
  // "كل رقم في وضع العرض عليه شارة بيانات تجريبية" (SPEC §10).
  const demo = env.demo ? t('demo.badge') : undefined;
  const gov = (id: string) => pick(governorateById(id));
  const med = (id: string) => pick(catalog.data?.medicines.find((m) => m.id === id));
  const freshness = o.freshnessByGov.map((g) => ({ name: gov(g.governorate), fresh: g.fresh, stale: g.stale, expired: g.expired }));
  const unmet = o.topUnmet.map((u) => ({ name: med(u.medicineId), count: u.count }));
  const th = 'px-3 py-2 text-start font-medium';
  const td = 'px-3 py-2';

  return (
    <div className="space-y-6">
      <h1 className="text-page">{t('portal.admin.nav.overview')}</h1>

      <div className="rise-children grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t('admin.stat.pharmacies')} value={o.verifiedPharmacies} icon={BadgeCheck} tone="ok" note={demo} to="/admin/organizations" />
        <StatCard label={t('admin.stat.providers')} value={o.verifiedProviders} icon={Building2} note={demo} to="/admin/organizations" />
        <StatCard label={t('admin.stat.pending')} value={o.pendingVerifications} icon={Hourglass} tone="review" note={demo} to="/admin/verification" />
        <StatCard label={t('admin.stat.catalog')} value={o.catalogSize} icon={BookOpen} note={demo} to="/admin/catalog" />
        <StatCard label={t('admin.stat.freshRatio')} value={`${Math.round(o.freshRatio * 100)}%`} icon={CircleCheck} tone="ok" note={demo} to="/admin/data-quality" />
        <StatCard label={t('admin.stat.searchesToday')} value={o.searchesToday} icon={Search} note={demo} />
        <StatCard label={t('admin.stat.failedToday')} value={o.failedToday} icon={SearchX} tone="warn" note={demo} to="/admin/unmet-demand" />
        <StatCard label={t('admin.stat.openReports')} value={o.openReports} icon={Flag} tone="review" note={demo} to="/admin/reports" />
      </div>

      <section aria-labelledby="pending-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
        <h2 id="pending-title" className="text-section mb-3">
          {t('admin.waiting')}
        </h2>
        <ul className="rise-children grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['pharmacies', '/admin/verification'],
              ['medicines', '/admin/catalog?tab=requests'],
              ['reports', '/admin/reports'],
              ['announcements', '/admin/moderation'],
            ] as const
          ).map(([k, to]) => (
            <li key={k}>
              <Link to={to} className="flex min-h-11 items-center justify-between rounded-control border border-border px-3 hover:border-secondary">
                <span>{t(`admin.pending.${k}`)}</span>
                <span className="rounded-full bg-mint px-2 font-semibold text-primary">
                  <bdi>{o.pending[k]}</bdi>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <ChartFigure
        title={t('admin.chart.daily')}
        table={
          <table className="w-full">
            <thead className="bg-canvas text-ink-muted">
              <tr>
                <th className={th}>{t('table.time')}</th>
                <th className={th}>{t('admin.searches')}</th>
                <th className={th}>{t('admin.failed')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {o.daily.map((d) => (
                <tr key={d.date}>
                  <td className={td}>
                    <bdi dir="ltr">{d.date}</bdi>
                  </td>
                  <td className={td}>{d.searches}</td>
                  <td className={td}>{d.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <SearchesLine data={o.daily} />
      </ChartFigure>

      <div className="rise-children grid gap-4 xl:grid-cols-2">
        <ChartFigure
          title={t('admin.chart.freshness')}
          table={
            <table className="w-full">
              <thead className="bg-canvas text-ink-muted">
                <tr>
                  <th className={th}>{t('gov.label')}</th>
                  <th className={th}>{t('meds.fresh.fresh')}</th>
                  <th className={th}>{t('meds.fresh.stale')}</th>
                  <th className={th}>{t('meds.fresh.expired')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {freshness.map((g) => (
                  <tr key={g.name}>
                    <td className={td}>{g.name}</td>
                    <td className={td}>{g.fresh}</td>
                    <td className={td}>{g.stale}</td>
                    <td className={td}>{g.expired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <FreshnessStack data={freshness} />
        </ChartFigure>
        <ChartFigure
          html
          title={t('admin.chart.topUnmet')}
          table={
            <table className="w-full">
              <thead className="bg-canvas text-ink-muted">
                <tr>
                  <th className={th}>{t('table.medicine')}</th>
                  <th className={th}>{t('admin.failed')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unmet.map((u) => (
                  <tr key={u.name}>
                    <td className={td}>{u.name}</td>
                    <td className={td}>{u.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <TopUnmetBars data={unmet} />
        </ChartFigure>
      </div>

      <section tabIndex={0} aria-labelledby="bygov-title" className="overflow-x-auto rounded-card border border-border bg-surface">
        <h2 id="bygov-title" className="text-section p-5 pb-3">
          {t('admin.byGov')}
        </h2>
        <table className="w-full text-meta">
          <thead className="bg-canvas text-ink-muted">
            <tr>
              <th scope="col" className={th}>{t('gov.label')}</th>
              <th scope="col" className={th}>{t('admin.col.pharmacies')}</th>
              <th scope="col" className={th}>{t('admin.col.staleData')}</th>
              <th scope="col" className={th}>{t('admin.col.failed30')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {o.byGov.map((g) => (
              <tr key={g.governorate} className="h-[38px]">
                <td className={td}>{gov(g.governorate)}</td>
                <td className={td}>{g.pharmacies}</td>
                <td className={td}>{g.stalePharmacies}</td>
                <td className={td}>{g.failedSearches}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
