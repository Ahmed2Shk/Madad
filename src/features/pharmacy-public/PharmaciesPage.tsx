// P-06 الصيدليات القريبة — a list of pharmacies, not of any medicine's availability.
import { BadgeCheck, Info, LocateFixed, MapPin, Search, Store } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CardSkeleton,
  EmptyState,
  ErrorBanner,
  Freshness,
  GovernorateSelect,
  LazyMap,
  SavedBadge,
  ViewToggle,
  useAreaLabel,
  type ListOrMap,
} from '../../components/ui';
import { governorateById, type GovFilter } from '../../data';
import { usePharmacies } from '../../data/queries';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLang } from '../../hooks/useLang';
import { useNow } from '../../hooks/useNow';
import { usePreferences } from '../../hooks/usePreferences';
import { formatDistance } from '../../lib/format';
import { distanceKm } from '../../lib/geo';
import { isOpenNow } from '../../lib/hours';
import { normalizeArabic } from '../../lib/normalizeArabic';
import { OpenNowBadge } from './HoursList';

export default function PharmaciesPage() {
  const { t } = useTranslation();
  const { pick, lang } = useLang();
  const now = useNow();
  const [prefs, setPrefs] = usePreferences();
  const [gov, setGov] = useState<GovFilter>(prefs.gov);
  const [areaQuery, setAreaQuery] = useState('');
  const [view, setView] = useState<ListOrMap>('list');
  const geo = useGeolocation();
  const area = useAreaLabel();
  const pharmacies = usePharmacies(gov);

  const list = useMemo(() => {
    const q = normalizeArabic(areaQuery);
    return (pharmacies.data ?? [])
      .filter((p) => !q || normalizeArabic(`${area(p)} ${p.addressText} ${p.landmark ?? ''} ${pick(p)}`).includes(q))
      .map((p) => ({
        p,
        km:
          geo.position && p.publicLat != null && p.publicLng != null
            ? distanceKm(geo.position, { lat: p.publicLat, lng: p.publicLng })
            : null,
      }))
      .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || (b.p.lastStockUpdateAt ?? '').localeCompare(a.p.lastStockUpdateAt ?? ''));
  }, [pharmacies.data, areaQuery, geo.position, area, pick]);

  const markers = useMemo(
    () =>
      list.flatMap(({ p }) =>
        p.publicLat != null && p.publicLng != null ? [{ id: p.id, lat: p.publicLat, lng: p.publicLng, label: pick(p), href: `/pharmacy/${p.id}` }] : [],
      ),
    [list, pick],
  );

  return (
    <div className="space-y-5">
      <h1 className="text-page">{t('pharmacies.title')}</h1>
      <p className="flex items-center gap-2 rounded-card bg-review-bg p-3 text-review-text">
        <Info aria-hidden className="size-5 shrink-0 text-review-icon" />
        {t('pharmacies.note')}
      </p>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <GovernorateSelect
          value={gov}
          onChange={(g) => {
            setGov(g);
            if (g !== 'all') setPrefs({ gov: g });
          }}
          className="md:w-56"
        />
        <div className="flex-1">
          <label htmlFor="area-q" className="text-meta font-medium">
            {t('pharmacies.searchArea')}
          </label>
          <div className="relative mt-1">
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
            <input
              id="area-q"
              type="search"
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              className="min-h-11 w-full rounded-control border border-border bg-surface ps-10 pe-3"
            />
          </div>
        </div>
        <Button variant="secondary" onClick={geo.request} loading={geo.status === 'asking'}>
          <LocateFixed aria-hidden className="size-4" />
          {t('geo.useMine')}
        </Button>
        <ViewToggle value={view} onChange={setView} />
      </div>
      {geo.status === 'denied' && <p className="text-meta text-bad-text">{t('geo.denied')}</p>}
      <SavedBadge updatedAt={pharmacies.dataUpdatedAt} />

      {pharmacies.isError && <ErrorBanner onRetry={() => void pharmacies.refetch()} hasCached={!!pharmacies.data} />}
      {pharmacies.isPending ? (
        <div className="grid gap-3 md:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={Store} title={t('pharmacies.empty')} body={t('pharmacies.emptyBody')} />
      ) : view === 'map' ? (
        <LazyMap markers={markers} center={gov !== 'all' ? governorateById(gov)?.center : undefined} label={t('map.label')} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map(({ p, km }) => (
            <li key={p.id}>
              <Link to={`/pharmacy/${p.id}`} className="block h-full rounded-card border border-border bg-surface p-4 shadow-card hover:border-secondary">
                <div className="flex flex-wrap items-center gap-x-2">
                  <h2 className="text-section">{pick(p)}</h2>
                  <BadgeCheck aria-label={t('pharmacy.verified')} className="size-4 text-ok-icon" />
                  <OpenNowBadge open={isOpenNow(p.hours, now)} />
                </div>
                <p className="mt-1 flex items-center gap-1 text-meta text-ink-muted">
                  <MapPin aria-hidden className="size-4" />
                  {area(p)}
                  {km != null && <> · {formatDistance(km, lang)}</>}
                </p>
                <p className="mt-2 text-meta">
                  <span className="text-ink-muted">{t('pharmacies.lastStockUpdate')} </span>
                  {p.lastStockUpdateAt ? <Freshness at={p.lastStockUpdateAt} /> : t('pharmacies.never')}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
