import { useMemo } from 'react';
import type { PharmacyAvailability, PublicPharmacy } from '../../data';
import { useNow } from '../../hooks/useNow';
import { sortRanked, updatedToday, viewRow, type Ranked } from '../../lib/availability';
import { passesAvailableOnly, type FreshnessSettings } from '../../lib/freshness';
import { distanceKm, type LatLng } from '../../lib/geo';
import { isOpenNow } from '../../lib/hours';

export interface ResultFilters {
  availableOnly: boolean;
  today: boolean;
  openNow: boolean;
}

export type RankedPharmacy = Ranked<PharmacyAvailability> & { pharmacy: PublicPharmacy };

/** Views, filters and orders report rows for display (SPEC §3). */
export function useRankedPharmacies(
  rows: PharmacyAvailability[] | undefined,
  pharmacies: PublicPharmacy[] | undefined,
  filters: ResultFilters,
  settings: FreshnessSettings,
  position: LatLng | null,
) {
  const now = useNow();
  return useMemo(() => {
    if (!rows || !pharmacies) return { all: [] as RankedPharmacy[], shown: [] as RankedPharmacy[] };
    const byId = new Map(pharmacies.map((p) => [p.id, p]));
    const all: RankedPharmacy[] = rows.flatMap((row) => {
      const pharmacy = byId.get(row.pharmacyId);
      if (!pharmacy) return [];
      const d =
        position && pharmacy.publicLat != null && pharmacy.publicLng != null
          ? distanceKm(position, { lat: pharmacy.publicLat, lng: pharmacy.publicLng })
          : null;
      return [{ row, pharmacy, view: viewRow(row, now, settings), distanceKm: d }];
    });
    const shown = sortRanked(
      all.filter(
        (x) =>
          (!filters.availableOnly || passesAvailableOnly(x.view.display)) &&
          (!filters.today || updatedToday(x.row.reportedAt, now)) &&
          (!filters.openNow || isOpenNow(x.pharmacy.hours, now) !== false),
      ),
    ) as RankedPharmacy[];
    return { all, shown };
  }, [rows, pharmacies, filters, settings, position, now]);
}
