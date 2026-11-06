// P-08 تفاصيل مقدّم الخدمة — what a hospital, medical point or organization says it offers, with the
// time of each piece. Contact actions only; a service never implies a medicine is in stock.
import { BadgeCheck, Building2, DoorClosed, Eye, Flag, Globe, Heart, Map as MapIcon, MapPin, Megaphone, MessageCircle, MessageSquare, Navigation, Phone } from 'lucide-react';
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button, CardSkeleton, Disclaimer, EmptyState, ErrorBanner, Freshness, LazyMap, buttonClass, pharmacyDirections, useAreaLabel, useToast } from '../../components/ui';
import { governorateById, type ServiceItem } from '../../data';
import { useProvider } from '../../data/providerQueries';
import { useFavorites, useSettings, useToggleFavorite } from '../../data/queries';
import { useLang } from '../../hooks/useLang';
import { useNow } from '../../hooks/useNow';
import { telHref, whatsappHref } from '../../lib/format';
import { isOpenNow } from '../../lib/hours';
import { DEFAULT_PROGRAM_CONFIRM_DAYS } from '../../lib/programs';
import { InquiryDialog } from '../account/InquiryDialog';
import { ReportDialog } from '../account/ReportDialog';
import { useRequireSession } from '../account/useRequireSession';
import { HoursList, OpenNowBadge } from '../pharmacy-public/HoursList';
import { PendingTag, ServiceCard } from './ServiceViews';

function Section({ id, title, items, now, confirmDays }: { id: string; title: string; items: ServiceItem[]; now: Date; confirmDays: number }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-section">
        {title}
      </h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((s) => (
          <ServiceCard key={s.id} item={s} now={now} confirmDays={confirmDays} />
        ))}
      </div>
    </section>
  );
}

export default function ProviderPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const preview = params.get('preview') === '1';
  const { t } = useTranslation();
  const { pick } = useLang();
  const toast = useToast();
  const now = useNow();
  const area = useAreaLabel();
  const confirmDays = useSettings().data?.programConfirmDays ?? DEFAULT_PROGRAM_CONFIRM_DAYS;
  const provider = useProvider(id, preview);
  const requireSession = useRequireSession();
  const favorites = useFavorites();
  const toggleFav = useToggleFavorite();
  const [inquiring, setInquiring] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showMap, setShowMap] = useState(false);

  if (provider.isPending) return <CardSkeleton />;
  if (provider.isError && !provider.data) return <ErrorBanner onRetry={() => void provider.refetch()} />;
  if (!provider.data) return <EmptyState icon={Building2} title={t('dir.notFound')} body={t('dir.notFoundBody')} />;

  const p = provider.data;
  const saved = favorites.data?.some((f) => f.entityType === 'provider' && f.entityId === id) ?? false;
  const markers = p.publicLat != null && p.publicLng != null ? [{ id: p.id, lat: p.publicLat, lng: p.publicLng, label: pick(p) }] : [];
  const byKind = (k: ServiceItem['kind']) => p.services.filter((s) => s.kind === k);
  const gov = governorateById(p.governorate);

  return (
    <div className="space-y-6">
      {preview && (
        <p role="status" className="flex items-center gap-2 rounded-card bg-review-bg p-3 text-review-text">
          <Eye aria-hidden className="size-5 text-review-icon" />
          {t('dir.previewBanner')}
        </p>
      )}
      {p.temporarilyClosed && (
        <p role="status" className="flex items-center gap-2 rounded-card bg-warn-bg p-3 font-medium text-warn-text">
          <DoorClosed aria-hidden className="size-5 text-warn-icon" />
          {t('pharmacy.temporarilyClosed')}
          {p.temporarilyClosed.reason && <span className="font-normal">— {p.temporarilyClosed.reason}</span>}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-mint">
              <Building2 aria-hidden className="size-6 text-secondary" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="text-page">{pick(p)}</h1>
                <span className="inline-flex items-center gap-1 text-meta text-ok-text">
                  <BadgeCheck aria-hidden className="size-4 text-ok-icon" />
                  {t('dir.verified')}
                </span>
                <OpenNowBadge open={isOpenNow(p.hours, now)} />
              </div>
              <p className="text-meta text-ink-muted">{t(`orgTypes.${p.type}`)}</p>
            </div>
          </div>
          {p.description && (
            <div>
              <h2 className="sr-only">{t('dir.about')}</h2>
              <p>{p.description}</p>
            </div>
          )}
          <p className="flex items-start gap-2 text-ink-muted">
            <MapPin aria-hidden className="mt-1 size-4 shrink-0" />
            <span>
              {area(p)} — {p.addressText}
            </span>
          </p>
          <p className="flex items-center gap-2">
            <Phone aria-hidden className="size-4 text-secondary" />
            <bdi dir="ltr">{p.phone}</bdi>
          </p>
          {p.website && (
            <p className="flex items-center gap-2">
              <Globe aria-hidden className="size-4 text-secondary" />
              <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" dir="ltr">
                {p.website.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}

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
                  const on = await toggleFav.mutateAsync({ type: 'provider', id });
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
              <Button variant="secondary" block onClick={() => setShowMap(true)}>
                <MapIcon aria-hidden className="size-4" />
                {t('map.show')}
              </Button>
            )
          ) : (
            <p className="rounded-card border border-border bg-surface p-4 text-meta text-ink-muted">{t(`pharmacy.precision.${p.locationPrecision}`)}</p>
          )}
          <section className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 className="text-section mb-3">{t('hours.title')}</h2>
            <HoursList hours={p.hours} />
          </section>
          {p.locations.length > 0 && (
            <section className="space-y-2 rounded-card border border-border bg-surface p-5 shadow-card">
              <h2 className="text-section">{t('dir.otherLocations')}</h2>
              <ul className="rise-children space-y-2">
                {p.locations.map((l) => (
                  <li key={l.name}>
                    <p className="font-medium">{l.name}</p>
                    <p className="text-meta text-ink-muted">{pick(gov?.areas.find((a) => a.id === l.area)) || l.area}</p>
                    {l.hours && <HoursList hours={l.hours} />}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {p.announcements.length > 0 && (
        <section aria-labelledby="ann-title" className="space-y-3">
          <h2 id="ann-title" className="text-section">
            {t('dir.announcements')}
          </h2>
          <ul className="rise-children space-y-2">
            {p.announcements.map((a) => (
              <li key={a.id} className="flex gap-3 rounded-card border border-border bg-surface p-4">
                <Megaphone aria-hidden className="mt-0.5 size-5 shrink-0 text-secondary" />
                <div className="space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {a.title}
                    {a.reviewStatus === 'pending' && <PendingTag />}
                  </p>
                  <p className="text-meta">{a.body}</p>
                  <p className="text-micro text-ink-muted">
                    <Freshness at={a.startsAt} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.services.length === 0 ? (
        <EmptyState icon={Building2} title={t('dir.nothingYet')} />
      ) : (
        <>
          <Section id="sec-dept" title={t('dir.departments')} items={byKind('department')} now={now} confirmDays={confirmDays} />
          <Section id="sec-svc" title={t('dir.services')} items={byKind('service')} now={now} confirmDays={confirmDays} />
          <Section id="sec-prog" title={t('dir.programs')} items={byKind('program')} now={now} confirmDays={confirmDays} />
        </>
      )}
      {/* Fixed line under the services (SPEC §9 P-08). */}
      <p className="rounded-card bg-warn-bg p-3 font-medium text-warn-text">{t('dir.serviceNote')}</p>
      <Disclaimer />

      <InquiryDialog
        open={inquiring}
        onClose={() => setInquiring(false)}
        orgId={id}
        orgName={pick(p)}
        medicineId={null}
        services={p.services.filter((s) => s.reviewStatus === 'approved').map((s) => ({ id: s.id, name: s.name }))}
      />
      <ReportDialog open={reporting} onClose={() => setReporting(false)} entityType="organization" entityId={id} />
    </div>
  );
}
