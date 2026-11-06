// P-04 تفاصيل الصيدلية — contact actions only: no buy, no cart, no reservation.
import { BadgeCheck, DoorClosed, Eye, Flag, Heart, Landmark, Map as MapIcon, MapPin, MessageCircle, MessageSquare, Navigation, Phone, Search, Store } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  AvailabilityStatus,
  Button,
  CardSkeleton,
  Disclaimer,
  EmptyState,
  ErrorBanner,
  Freshness,
  LazyMap,
  SavedBadge,
  buttonClass,
  pharmacyDirections,
  useAreaLabel,
  useToast,
} from '../../components/ui';
import {
  recordPharmacyView,
  useCatalog,
  useFavorites,
  useFreshnessSettings,
  usePharmacy,
  usePharmacyReports,
  useToggleFavorite,
} from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { useNow } from '../../hooks/useNow';
import { sortRanked, viewRow } from '../../lib/availability';
import { formatPrice, telHref, whatsappHref } from '../../lib/format';
import { isOpenNow } from '../../lib/hours';
import { normalizeArabic } from '../../lib/normalizeArabic';
import { searchTextOf } from '../../lib/search';
import { InquiryDialog } from '../account/InquiryDialog';
import { ReportDialog } from '../account/ReportDialog';
import { useRequireSession } from '../account/useRequireSession';
import { HoursList, OpenNowBadge } from './HoursList';

export default function PharmacyPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const fromMedicine = params.get('medicine');
  const preview = params.get('preview') === '1';
  const { t } = useTranslation();
  const { pick, strength } = useLang();
  const toast = useToast();
  const now = useNow();
  const settings = useFreshnessSettings();
  const area = useAreaLabel();
  const pharmacy = usePharmacy(id, preview);
  const reports = usePharmacyReports(id, preview);
  useEffect(() => {
    if (!preview) void recordPharmacyView(id);
  }, [id, preview]);
  const catalog = useCatalog();
  const requireSession = useRequireSession();
  const favorites = useFavorites();
  const toggleFav = useToggleFavorite();
  const [filter, setFilter] = useState('');
  const [inquiring, setInquiring] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const medicines = useMemo(() => new Map((catalog.data?.medicines ?? []).map((m) => [m.id, m])), [catalog.data]);
  const ranked = useMemo(
    () => sortRanked((reports.data ?? []).map((row) => ({ row, view: viewRow(row, now, settings), distanceKm: null }))),
    [reports.data, now, settings],
  );
  // "Reported recently": anything not yet unconfirmed, filtered by the in-page search.
  const recent = ranked.filter((x) => {
    if (x.view.display === 'unconfirmed') return false;
    const m = medicines.get(x.row.medicineId);
    return !filter.trim() || (m && searchTextOf(m).includes(normalizeArabic(filter)));
  });
  const focus = fromMedicine ? ranked.find((x) => x.row.medicineId === fromMedicine) : undefined;

  if (pharmacy.isPending) return <CardSkeleton />;
  if (pharmacy.isError && !pharmacy.data) return <ErrorBanner onRetry={() => void pharmacy.refetch()} />;
  if (!pharmacy.data) return <EmptyState icon={Store} title={t('pharmacy.notFound')} body={t('pharmacy.notFoundBody')} />;

  const p = pharmacy.data;
  const saved = favorites.data?.some((f) => f.entityType === 'pharmacy' && f.entityId === id) ?? false;
  const markers = p.publicLat != null && p.publicLng != null ? [{ id: p.id, lat: p.publicLat, lng: p.publicLng, label: pick(p) }] : [];

  return (
    <div className="space-y-6">
      {preview && (
        <p role="status" className="flex items-center gap-2 rounded-card bg-review-bg p-3 text-review-text">
          <Eye aria-hidden className="size-5 text-review-icon" />
          {t('pharmacy.previewBanner')}
        </p>
      )}
      {p.temporarilyClosed && (
        <p role="status" className="flex items-center gap-2 rounded-card bg-warn-bg p-3 font-medium text-warn-text">
          <DoorClosed aria-hidden className="size-5 text-warn-icon" />
          {t('pharmacy.temporarilyClosed')}
          {p.temporarilyClosed.reason && <span className="font-normal">— {p.temporarilyClosed.reason}</span>}
        </p>
      )}
      {focus && (
        <section className="rounded-card border border-secondary bg-mint p-4">
          <p className="font-medium">{pick(medicines.get(focus.row.medicineId))}</p>
          <div className="mt-2">
            <AvailabilityStatus row={focus.row} view={focus.view} />
          </div>
          {focus.view.priceIls != null && (
            <p className="mt-1 text-meta">
              <bdi dir="ltr">{formatPrice(focus.view.priceIls)}</bdi> · {t('price.asOfLastUpdate')}
            </p>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-page">{pick(p)}</h1>
            <span className="inline-flex items-center gap-1 text-meta text-ok-text">
              <BadgeCheck aria-hidden className="size-4 text-ok-icon" />
              {t('pharmacy.verified')}
            </span>
            <OpenNowBadge open={isOpenNow(p.hours, now)} />
          </div>
          <p className="flex items-start gap-2 text-ink-muted">
            <MapPin aria-hidden className="mt-1 size-4 shrink-0" />
            <span>
              {area(p)} — {p.addressText}
            </span>
          </p>
          {p.landmark && (
            <p className="flex items-start gap-2 text-ink-muted">
              <Landmark aria-hidden className="mt-1 size-4 shrink-0" />
              {t('pharmacy.landmark', { landmark: p.landmark })}
            </p>
          )}
          <p className="flex items-center gap-2">
            <Phone aria-hidden className="size-4 text-secondary" />
            <bdi dir="ltr">{p.phone}</bdi>
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <a href={telHref(p.phone)} className={buttonClass('primary')}>
              <Phone aria-hidden className="size-4" />
              {t('actions.call')}
            </a>
            {p.whatsapp && (
              <a href={whatsappHref(p.whatsapp)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
                <MessageCircle aria-hidden className="size-4" />
                {t('actions.whatsapp')}
              </a>
            )}
            <a href={pharmacyDirections(p)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
              <Navigation aria-hidden className="size-4" />
              {t('actions.directions')}
            </a>
            <Button variant="secondary" onClick={() => requireSession(() => setInquiring(true), 'auth.reasonInquiry')}>
              <MessageSquare aria-hidden className="size-4" />
              {t('inquiry.open')}
            </Button>
            <Button
              variant="ghost"
              aria-pressed={saved}
              onClick={() =>
                requireSession(async () => {
                  const on = await toggleFav.mutateAsync({ type: 'pharmacy', id });
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
          <p className="text-meta text-ink-muted">
            {t('pharmacy.infoUpdated')} <Freshness at={p.infoUpdatedAt} />
          </p>
        </section>

        <aside className="space-y-4">
          {markers.length > 0 ? (
            showMap ? (
              <LazyMap markers={markers} zoom={15} className="h-56 w-full rounded-card border border-border" label={t('map.label')} />
            ) : (
              // The map loads only on request, to save data (SPEC §1).
              <Button variant="secondary" block onClick={() => setShowMap(true)}>
                <MapIcon aria-hidden className="size-4" />
                {t('map.show')}
              </Button>
            )
          ) : (
            <p className="rounded-card border border-border bg-surface p-4 text-meta text-ink-muted">
              {t(`pharmacy.precision.${p.locationPrecision}`)}
            </p>
          )}
          <section className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 className="text-section mb-3">{t('hours.title')}</h2>
            <HoursList hours={p.hours} />
          </section>
        </aside>
      </div>

      <section aria-labelledby="recent-meds" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-meds" className="text-page">
            {t('pharmacy.recentMedicines')}
          </h2>
          <SavedBadge updatedAt={reports.dataUpdatedAt} />
        </div>
        <div className="relative max-w-md">
          <label htmlFor="ph-filter" className="sr-only">
            {t('pharmacy.searchInside')}
          </label>
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <input
            id="ph-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('pharmacy.searchInside')}
            className="min-h-11 w-full rounded-control border border-border bg-surface ps-10 pe-3"
          />
        </div>
        {reports.isPending ? (
          <CardSkeleton />
        ) : recent.length === 0 ? (
          <EmptyState icon={Search} title={t('pharmacy.noRecent')} />
        ) : (
          <ul className="rise-children divide-y divide-border rounded-card border border-border bg-surface">
            {recent.map((x) => {
              const m = medicines.get(x.row.medicineId);
              return (
                <li key={x.row.medicineId} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
                  <Link to={`/medicine/${x.row.medicineId}?gov=${p.governorate}`} className="font-medium hover:text-primary">
                    {pick(m)}
                    {m?.strength && !pick(m).includes(m.strength.split(' ')[0]!) && (
                      <bdi className="ms-2 text-meta text-ink-muted">{strength(m)}</bdi>
                    )}
                  </Link>
                  <div className="flex flex-wrap items-center gap-3">
                    <AvailabilityStatus row={x.row} view={x.view} />
                    {x.view.priceIls != null && <bdi dir="ltr" className="text-meta">{formatPrice(x.view.priceIls)}</bdi>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Disclaimer />

      <InquiryDialog
        open={inquiring}
        onClose={() => setInquiring(false)}
        orgId={id}
        orgName={pick(p)}
        medicineId={fromMedicine}
        medicineName={fromMedicine ? pick(medicines.get(fromMedicine)) : undefined}
      />
      <ReportDialog open={reporting} onClose={() => setReporting(false)} entityType="pharmacy" entityId={id} />
    </div>
  );
}
