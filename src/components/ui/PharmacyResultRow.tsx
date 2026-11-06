import { BadgeCheck, MapPin, Navigation, Phone } from 'lucide-react';
import { stagger } from './motion';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { PharmacyAvailability, PublicPharmacy } from '../../data';
import { useLang } from '../../hooks/useLang';
import type { ReportView } from '../../lib/freshness';
import { formatDistance, formatPrice, telHref } from '../../lib/format';
import { AvailabilityStatus } from './AvailabilityStatus';
import { buttonClass } from './buttonClass';
import { pharmacyDirections, useAreaLabel } from './pharmacyHelpers';

/** One pharmacy in a medicine's results (SPEC §5): verified, area, distance, status + time, price, call/directions. */
export function PharmacyResultRow({
  pharmacy,
  row,
  view,
  distanceKm,
  medicineId,
  index = 0,
}: {
  pharmacy: PublicPharmacy;
  row: PharmacyAvailability;
  view: ReportView;
  distanceKm: number | null;
  medicineId: string;
  /** Position in the list: rows rise in one after another. */
  index?: number;
}) {
  const { t } = useTranslation();
  const { lang, pick } = useLang();
  const area = useAreaLabel();
  return (
    <li style={stagger(index)} className="animate-rise flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-card md:flex-row md:items-center">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2">
          <Link to={`/pharmacy/${pharmacy.id}?medicine=${medicineId}`} className="text-section hover:text-primary">
            {pick(pharmacy)}
          </Link>
          <span className="inline-flex items-center gap-1 text-meta text-ok-text">
            <BadgeCheck aria-hidden className="size-4 text-ok-icon" />
            {t('pharmacy.verified')}
          </span>
        </div>
        <p className="flex items-center gap-1 text-meta text-ink-muted">
          <MapPin aria-hidden className="size-4" />
          {area(pharmacy)}
          {distanceKm != null && <> · {formatDistance(distanceKm, lang)}</>}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <AvailabilityStatus row={row} view={view} />
          {view.priceIls != null && (
            <span className="text-meta">
              <span aria-hidden className="text-ink-muted">· </span>
              <bdi dir="ltr" className="font-semibold">
                {formatPrice(view.priceIls)}
              </bdi>{' '}
              <span className="text-ink-muted">· {t('price.asOfLastUpdate')}</span>
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <a href={telHref(pharmacy.phone)} className={buttonClass('primary')}>
          <Phone aria-hidden className="size-4" />
          {t('actions.call')}
        </a>
        <a href={pharmacyDirections(pharmacy)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
          <Navigation aria-hidden className="size-4" />
          {t('actions.directions')}
        </a>
      </div>
    </li>
  );
}
