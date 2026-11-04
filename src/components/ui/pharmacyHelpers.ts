import { governorateById, type PublicPharmacy } from '../../data';
import { useLang } from '../../hooks/useLang';
import { directionsUrl, directionsUrlForAddress } from '../../lib/geo';

/** Exact coordinates when published, otherwise the text address (SPEC §11). */
export function pharmacyDirections(p: PublicPharmacy): string {
  return p.publicLat != null && p.publicLng != null
    ? directionsUrl({ lat: p.publicLat, lng: p.publicLng })
    : directionsUrlForAddress(p.addressText);
}

/** "خان يونس · وسط المدينة" in the current language. */
export function useAreaLabel() {
  const { pick } = useLang();
  return (p: Pick<PublicPharmacy, 'governorate' | 'area'>) => {
    const g = governorateById(p.governorate);
    const a = g?.areas.find((x) => x.id === p.area);
    return [pick(g), pick(a)].filter(Boolean).join(' · ');
  };
}
