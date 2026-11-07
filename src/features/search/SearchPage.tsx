// P-02 نتائج البحث (قائمة / خريطة) — one match goes straight to P-03; nothing found shows P-05.
import { Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  CardSkeleton,
  Disclaimer,
  EmptyState,
  ErrorBanner,
  FilterChips,
  LazyMap,
  MedicineCard,
  SavedBadge,
  SearchBar,
  ViewToggle,
  type ListOrMap,
  stagger,
} from '../../components/ui';
import { governorateById, type GovFilter } from '../../data';
import { useFreshnessSettings, useMedicineSearch, usePharmacies } from '../../data/queries';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useLang } from '../../hooks/useLang';
import { useNow } from '../../hooks/useNow';
import { usePreferences } from '../../hooks/usePreferences';
import { summarize, updatedToday, viewRow } from '../../lib/availability';
import { passesAvailableOnly } from '../../lib/freshness';
import { distanceKm } from '../../lib/geo';
import { isOpenNow } from '../../lib/hours';
import { NotReported, UnknownMedicine } from './NoResults';
import { rememberLastSearch, useSearchLog } from './useSearchLog';

export default function SearchPage() {
  const [params] = useSearchParams();
  const { t } = useTranslation();
  const { pick } = useLang();
  const now = useNow();
  const [prefs, setPrefs] = usePreferences();
  const q = params.get('q')?.trim() ?? '';
  const gov: GovFilter = params.get('gov') ?? prefs.gov;
  const settings = useFreshnessSettings();
  const geo = useGeolocation();

  const [filters, setFilters] = useState({
    availableOnly: params.get('avail') !== '0' && prefs.availableOnly,
    today: false,
    nearest: false,
    openNow: false,
  });
  const [view, setView] = useState<ListOrMap>('list');

  const search = useMedicineSearch(q, gov);
  const pharmacies = usePharmacies(gov);
  const byId = useMemo(() => new Map((pharmacies.data ?? []).map((p) => [p.id, p])), [pharmacies.data]);

  // Each hit, with only the rows that pass the active filters.
  const hits = useMemo(() => {
    if (!search.data) return [];
    return search.data
      .map((h) => {
        const rows = h.reports.filter((r) => {
          const p = byId.get(r.pharmacyId);
          if (!p) return false;
          if (filters.today && !updatedToday(r.reportedAt, now)) return false;
          if (filters.openNow && isOpenNow(p.hours, now) === false) return false;
          return true;
        });
        const nearestKm =
          filters.nearest && geo.position
            ? Math.min(
                ...rows
                  .filter((r) => passesAvailableOnly(viewRow(r, now, settings).display))
                  .map((r) => byId.get(r.pharmacyId)!)
                  .filter((p) => p.publicLat != null && p.publicLng != null)
                  .map((p) => distanceKm(geo.position!, { lat: p.publicLat!, lng: p.publicLng! })),
              )
            : Infinity;
        return { ...h, rows, summary: summarize(rows, now, settings), nearestKm };
      })
      .filter((h) => !filters.availableOnly || h.summary.availableCount > 0)
      .sort((a, b) => a.nearestKm - b.nearestKm || b.summary.availableCount - a.summary.availableCount);
  }, [search.data, byId, filters, geo.position, now, settings]);

  // Log once after "search" was pressed (SPEC §7): result count = pharmacies that pass "available only".
  const resultCount = useMemo(
    () =>
      new Set(
        (search.data ?? []).flatMap((h) =>
          h.reports.filter((r) => passesAvailableOnly(viewRow(r, now, settings).display)).map((r) => r.pharmacyId),
        ),
      ).size,
    [search.data, now, settings],
  );
  useSearchLog(
    search.data && pharmacies.data
      ? { query: q, governorate: gov, medicineId: search.data.length === 1 ? search.data[0]!.medicine.id : null, resultCount }
      : null,
  );
  useEffect(() => {
    if (q && gov !== 'all') setPrefs({ gov });
    if (q) rememberLastSearch(q, gov);
  }, [q, gov, setPrefs]);

  const markers = useMemo(() => {
    const seen = new Map<string, { id: string; lat: number; lng: number; label: string; href: string }>();
    for (const h of hits)
      for (const r of h.rows) {
        const p = byId.get(r.pharmacyId);
        if (!p || p.publicLat == null || p.publicLng == null || seen.has(p.id)) continue;
        if (!passesAvailableOnly(viewRow(r, now, settings).display)) continue;
        seen.set(p.id, { id: p.id, lat: p.publicLat, lng: p.publicLng, label: pick(p), href: `/pharmacy/${p.id}` });
      }
    return [...seen.values()];
  }, [hits, byId, now, settings, pick]);

  const toggle = (chip: string) => {
    if (chip === 'nearest' && !filters.nearest && !geo.position) geo.request();
    setFilters((f) => ({ ...f, [chip]: !f[chip as keyof typeof f] }));
  };

  if (!q) return <Navigate to="/" replace />;
  if (search.data?.length === 1 && pharmacies.data) {
    return <Navigate to={`/medicine/${search.data[0]!.medicine.id}?gov=${gov}`} replace />;
  }

  const loading = search.isPending || pharmacies.isPending;
  const govLabel = gov === 'all' ? t('gov.anywhere') : pick(governorateById(gov));

  return (
    <div className="space-y-6">
      <SearchBar key={`${q}|${gov}`} initialQuery={q} initialGov={gov} />

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
        <div className="flex items-center gap-3">
          <SavedBadge updatedAt={search.dataUpdatedAt} />
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>
      {filters.nearest && geo.status === 'denied' && <p className="text-meta text-bad-text">{t('geo.denied')}</p>}

      {search.isError && <ErrorBanner onRetry={() => void search.refetch()} hasCached={!!search.data} />}

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : search.data?.length === 0 ? (
        <UnknownMedicine query={q} gov={gov} />
      ) : hits.length === 0 ? (
        filters.today || filters.openNow ? (
          <EmptyState icon={Info} title={t('filters.noneMatch')} body={t('filters.noneMatchBody')} />
        ) : (
          <NotReported
            medicine={search.data![0]!.medicine}
            gov={gov}
            allGovsUrl={gov === 'all' ? null : `/search?${new URLSearchParams({ q, gov: 'all' })}`}
          />
        )
      ) : (
        <section aria-labelledby="results-title" className="space-y-3">
          <h1 id="results-title" className="text-page">
            {t('search.resultsTitle', { query: q, gov: govLabel })}
          </h1>
          {view === 'map' ? (
            <LazyMap markers={markers} center={gov !== 'all' ? governorateById(gov)?.center : undefined} label={t('map.label')} />
          ) : (
            <ul className="space-y-3">
              {hits.map((h, i) => (
                <li key={h.medicine.id} className="animate-rise" style={stagger(i)}>
                  <MedicineCard medicine={h.medicine} summary={h.summary} to={`/medicine/${h.medicine.id}?gov=${gov}`} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Disclaimer />
    </div>
  );
}
