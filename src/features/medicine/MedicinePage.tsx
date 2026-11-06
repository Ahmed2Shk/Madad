// P-03 تفاصيل الدواء والصيدليات المبلِّغة (+ P-05 when nothing is reported).
import { Banknote, Bell, ChevronLeft, ChevronRight, Flag, Heart, House, Info, Pill, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CardSkeleton,
  Skeleton,
  Disclaimer,
  EmptyState,
  ErrorBanner,
  FilterChips,
  LazyMap,
  PharmacyResultRow,
  SavedBadge,
  SearchBar,
  ViewToggle,
  searchUrl,
  useToast,
  type ListOrMap,
} from '../../components/ui';
import { governorateById, type GovFilter } from '../../data';
import {
  useCatalog,
  useCreateAlert,
  useFavorites,
  useFreshnessSettings,
  usePharmacies,
  usePharmaciesFor,
  useToggleFavorite,
} from '../../data/queries';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLang } from '../../hooks/useLang';
import { useNow } from '../../hooks/useNow';
import { usePreferences } from '../../hooks/usePreferences';
import { summarize } from '../../lib/availability';
import { formatPrice } from '../../lib/format';
import { ReportDialog } from '../account/ReportDialog';
import { useRequireSession } from '../account/useRequireSession';
import { NotReported, UnknownMedicine } from '../search/NoResults';
import { useSearchLog } from '../search/useSearchLog';
import { useRankedPharmacies } from './useRankedPharmacies';

export default function MedicinePage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { pick, lang, strength, pack } = useLang();
  // Directional icons mirror with the reading direction (SPEC §5).
  const Chevron = lang === 'ar' ? ChevronLeft : ChevronRight;
  const toast = useToast();
  const now = useNow();
  const [prefs] = usePreferences();
  const gov: GovFilter = params.get('gov') ?? prefs.gov;
  const settings = useFreshnessSettings();
  const geo = useGeolocation();

  const [filters, setFilters] = useState({ availableOnly: prefs.availableOnly, today: false, openNow: false, nearest: false });
  const [view, setView] = useState<ListOrMap>('list');
  const [reporting, setReporting] = useState(false);

  const catalog = useCatalog();
  const medicine = catalog.data?.medicines.find((m) => m.id === id);
  const category = catalog.data?.categories.find((c) => c.id === medicine?.categoryId);
  const rows = usePharmaciesFor(id, gov);
  const pharmacies = usePharmacies(gov);
  const ranked = useRankedPharmacies(rows.data, pharmacies.data, filters, settings, filters.nearest ? geo.position : null);
  const summary = useMemo(() => summarize(rows.data ?? [], now, settings), [rows.data, now, settings]);

  const requireSession = useRequireSession();
  const favorites = useFavorites();
  const toggleFav = useToggleFavorite();
  const createAlert = useCreateAlert();
  const saved = favorites.data?.some((f) => f.entityType === 'medicine' && f.entityId === id) ?? false;

  // A suggestion pick lands here: log it once, with what the patient actually got (SPEC §7).
  const logQuery = (location.state as { logQuery?: string } | null)?.logQuery;
  useSearchLog(
    logQuery && rows.data
      ? { query: logQuery, governorate: gov, medicineId: id, resultCount: summary.availableCount }
      : null,
  );
  // Then drop the one-shot marker so a reload or "back" does not log again.
  const logged = !!(logQuery && rows.data);
  useEffect(() => {
    if (logged) navigate(location.pathname + location.search, { replace: true, state: null });
  }, [logged, navigate, location.pathname, location.search]);

  const toggle = (chip: string) => {
    if (chip === 'nearest' && !filters.nearest && !geo.position) geo.request();
    setFilters((f) => ({ ...f, [chip]: !f[chip as keyof typeof f] }));
  };

  const markers = useMemo(
    () =>
      ranked.shown.flatMap((x) =>
        x.pharmacy.publicLat != null && x.pharmacy.publicLng != null
          ? [{ id: x.pharmacy.id, lat: x.pharmacy.publicLat, lng: x.pharmacy.publicLng, label: `${pick(x.pharmacy)} · ${t(`status.${x.view.display}`)}`, href: `/pharmacy/${x.pharmacy.id}?medicine=${id}` }]
          : [],
      ),
    [ranked.shown, pick, t, id],
  );

  if (catalog.isPending) return <PageSkeleton />;
  if (!medicine) return <UnknownMedicine query={id} />;

  const loading = rows.isPending || pharmacies.isPending;
  const allUnconfirmed = ranked.all.length > 0 && ranked.all.every((x) => x.view.display === 'unconfirmed');
  const nothingToShow = !loading && ranked.shown.length === 0;
  const govLabel = gov === 'all' ? t('gov.anywhere') : pick(governorateById(gov));

  return (
    <div className="space-y-6">
      <SearchBar initialQuery={pick(medicine)} initialGov={gov} />

      <nav aria-label={t('nav.breadcrumb')} className="text-meta text-ink-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link to="/" className="inline-flex items-center gap-1 hover:text-primary">
              <House aria-hidden className="size-4" />
              {t('breadcrumb.home')}
            </Link>
          </li>
          <li aria-hidden>
            <Chevron className="size-4" />
          </li>
          <li>
            <Link to={searchUrl(pick(medicine), gov, prefs.availableOnly)} className="hover:text-primary">
              {t('breadcrumb.results')}
            </Link>
          </li>
          <li aria-hidden>
            <Chevron className="size-4" />
          </li>
          <li aria-current="page" className="text-ink">
            {pick(medicine)}
          </li>
        </ol>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-card border border-border bg-surface p-5 shadow-card">
            <span className="flex size-12 items-center justify-center rounded-control bg-mint">
              <Pill aria-hidden className="size-6 text-secondary" />
            </span>
            <h1 className="text-page mt-3">{pick(medicine)}</h1>
            <p className="mt-1 text-ink-muted">
              <bdi dir="ltr">{medicine.genericName}</bdi>
              {medicine.strength && <> · {strength(medicine)}</>} · {t(`forms.${medicine.dosageForm}`)}
            </p>
            {loading && (
              // Same height as the two summary rows below, so the actions do not move when they load.
              <div className="mt-4 space-y-2">
                <Skeleton className="h-11" />
                <Skeleton className="h-11" />
              </div>
            )}
            {!loading && (
              <dl className="mt-4 space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-control bg-mint px-3 py-2.5">
                  <dt className="flex items-center gap-2 text-meta text-ink-muted">
                    <Store aria-hidden className="size-4 text-secondary" />
                    {t('medicine.reportingLabel')}
                  </dt>
                  <dd className="font-semibold">{t('medicine.reportingValue', { count: summary.reporting, fresh: summary.fresh })}</dd>
                </div>
                {summary.minPrice != null && (
                  <div className="flex items-center justify-between gap-3 rounded-control bg-mint px-3 py-2.5">
                    <dt className="flex items-center gap-2 text-meta text-ink-muted">
                      <Banknote aria-hidden className="size-4 text-secondary" />
                      {t('medicine.lowestPrice')}
                    </dt>
                    <dd className="font-semibold">
                      <bdi dir="ltr">{formatPrice(summary.minPrice)}</bdi>
                    </dd>
                  </div>
                )}
              </dl>
            )}
            <dl className="mt-4 space-y-2 text-meta">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">{t('medicine.pack')}</dt>
                <dd>{pack(medicine)}</dd>
              </div>
              {category && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{t('medicine.category')}</dt>
                  <dd>{pick(category)}</dd>
                </div>
              )}
              {medicine.manufacturer && (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">{t('medicine.manufacturer')}</dt>
                  <dd>{medicine.manufacturer}</dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                onClick={() =>
                  requireSession(async () => {
                    await createAlert.mutateAsync({ medicineId: id, gov });
                    toast(t('alerts.created'));
                  }, 'auth.reasonAlert')
                }
              >
                <Bell aria-hidden className="size-4" />
                {t('alerts.notifyMe')}
              </Button>
              <Button
                variant="secondary"
                aria-pressed={saved}
                onClick={() =>
                  requireSession(async () => {
                    const on = await toggleFav.mutateAsync({ type: 'medicine', id });
                    toast(on ? t('favorites.saved') : t('favorites.removed'));
                  }, 'auth.reasonFavorite')
                }
              >
                <Heart aria-hidden className={saved ? 'size-4 fill-current' : 'size-4'} />
                {saved ? t('favorites.savedLabel') : t('favorites.save')}
              </Button>
              <Button variant="ghost" onClick={() => setReporting(true)}>
                <Flag aria-hidden className="size-4" />
                {t('report.open')}
              </Button>
            </div>
          </section>
        </aside>

        <section aria-labelledby="pharmacies-title" className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="pharmacies-title" className="text-page">
                {t('medicine.reportingIn', { gov: govLabel })}
              </h2>
              {!loading && (
                <span className="rounded-full bg-mint px-3 py-0.5 text-meta font-medium text-primary">
                  {t('medicine.pharmacyCount', { count: summary.reporting })}
                </span>
              )}
            </div>
            <SavedBadge updatedAt={rows.dataUpdatedAt} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips
              label={t('filters.label')}
              onToggle={toggle}
              chips={[
                { id: 'availableOnly', label: t('filters.availableOnly'), on: filters.availableOnly },
                { id: 'today', label: t('filters.today'), on: filters.today },
                { id: 'nearest', label: t('filters.nearest'), on: filters.nearest },
                { id: 'openNow', label: t('filters.openNow'), on: filters.openNow },
              ]}
            />
            <ViewToggle value={view} onChange={setView} />
          </div>
          {filters.nearest && geo.status === 'denied' && <p className="text-meta text-bad-text">{t('geo.denied')}</p>}

          {rows.isError && <ErrorBanner onRetry={() => void rows.refetch()} hasCached={!!rows.data} />}
          {allUnconfirmed && !filters.availableOnly && (
            <p className="flex items-center gap-2 rounded-card bg-unknown-bg p-3 text-unknown-text">
              <Info aria-hidden className="size-5 text-unknown-icon" />
              {t('medicine.allUnconfirmed')}
            </p>
          )}

          {loading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : nothingToShow ? (
            filters.today || filters.openNow ? (
              <EmptyState icon={Info} title={t('filters.noneMatch')} body={t('filters.noneMatchBody')} />
            ) : (
              <NotReported
                medicine={medicine}
                gov={gov}
                allGovsUrl={gov === 'all' ? null : `/medicine/${id}?gov=all`}
              />
            )
          ) : view === 'map' ? (
            <LazyMap markers={markers} center={gov !== 'all' ? governorateById(gov)?.center : undefined} label={t('map.label')} />
          ) : (
            <ul className="space-y-3">
              {ranked.shown.map((x) => (
                <PharmacyResultRow key={x.pharmacy.id} pharmacy={x.pharmacy} row={x.row} view={x.view} distanceKm={x.distanceKm} medicineId={id} />
              ))}
            </ul>
          )}

          <Disclaimer />
        </section>
      </div>

      <ReportDialog open={reporting} onClose={() => setReporting(false)} entityType="medicine" entityId={id} governorate={gov} />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <CardSkeleton />
      <div className="space-y-3">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
