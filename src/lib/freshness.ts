// Availability × freshness model — SPEC §3. The one place freshness is computed.
// The Postgres view `public_availability` mirrors these rules exactly (SPEC §13).

export type Reported = 'available' | 'limited' | 'unavailable';
export type Freshness = 'fresh' | 'stale' | 'expired';
export type Display = 'available' | 'limited' | 'needs_update' | 'unconfirmed' | 'unavailable';

export interface FreshnessSettings {
  freshHours: number;
  expireHours: number;
  priceMaxDays: number;
}

export const DEFAULT_FRESHNESS: FreshnessSettings = { freshHours: 24, expireHours: 72, priceMaxDays: 14 };

export function freshnessOf(reportedAt: Date, now: Date, freshH = 24, expireH = 72): Freshness {
  const h = (now.getTime() - reportedAt.getTime()) / 36e5;
  return h <= freshH ? 'fresh' : h <= expireH ? 'stale' : 'expired';
}

export function displayOf(r: Reported, f: Freshness): Display {
  if (f === 'expired') return 'unconfirmed';
  if (r === 'unavailable') return 'unavailable';
  if (f === 'stale') return 'needs_update';
  return r; // 'available' | 'limited'
}

export interface ReportInput {
  reportedStatus: Reported;
  reportedAt: Date;
  priceIls: number | null;
  priceUpdatedAt: Date | null;
}

export interface ReportView {
  display: Display;
  freshness: Freshness;
  /** Null when there is no price, the report expired, or the price is older than priceMaxDays. */
  priceIls: number | null;
}

/** What a patient may see for one report: display status + price only while it is still valid. */
export function viewOf(r: ReportInput, now: Date, s: FreshnessSettings = DEFAULT_FRESHNESS): ReportView {
  const freshness = freshnessOf(r.reportedAt, now, s.freshHours, s.expireHours);
  const display = displayOf(r.reportedStatus, freshness);
  const priceAgeDays = r.priceUpdatedAt ? (now.getTime() - r.priceUpdatedAt.getTime()) / 864e5 : Infinity;
  const priceIls =
    r.priceIls != null && freshness !== 'expired' && priceAgeDays <= s.priceMaxDays ? r.priceIls : null;
  return { display, freshness, priceIls };
}

/** Result order (SPEC §3): available fresh → limited fresh → needs update → unconfirmed → unavailable. */
export const DISPLAY_RANK: Record<Display, number> = {
  available: 0,
  limited: 1,
  needs_update: 2,
  unconfirmed: 3,
  unavailable: 4,
};

/** "المتوفر فقط" filter: available fresh + limited fresh + needs update. */
export function passesAvailableOnly(d: Display): boolean {
  return d === 'available' || d === 'limited' || d === 'needs_update';
}
