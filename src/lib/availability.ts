// List helpers built on freshness.ts: view every row, order results, summarize a medicine.
import { DISPLAY_RANK, passesAvailableOnly, viewOf, type FreshnessSettings, type ReportView, type Reported } from './freshness';

export interface RawReport {
  reportedStatus: Reported;
  reportedAt: string;
  priceIls: number | null;
  priceUpdatedAt: string | null;
}

export function viewRow(row: RawReport, now: Date, s: FreshnessSettings): ReportView {
  return viewOf(
    {
      reportedStatus: row.reportedStatus,
      reportedAt: new Date(row.reportedAt),
      priceIls: row.priceIls,
      priceUpdatedAt: row.priceUpdatedAt ? new Date(row.priceUpdatedAt) : null,
    },
    now,
    s,
  );
}

export interface Ranked<T> {
  row: T;
  view: ReportView;
  distanceKm: number | null;
}

/** SPEC §3 order; within a group nearest first when distance is known, else most recently updated. */
export function sortRanked<T extends RawReport>(items: Ranked<T>[]): Ranked<T>[] {
  return [...items].sort((a, b) => {
    const byStatus = DISPLAY_RANK[a.view.display] - DISPLAY_RANK[b.view.display];
    if (byStatus) return byStatus;
    if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return b.row.reportedAt.localeCompare(a.row.reportedAt);
  });
}

export interface MedicineSummary {
  /** Pharmacies with any public report. */
  reporting: number;
  /** Reports still fresh (available, limited or unavailable within fresh_hours). */
  fresh: number;
  /** Pharmacies that pass "available only". */
  availableCount: number;
  /** Latest report among those passing "available only". */
  lastAvailableAt: string | null;
  /** Lowest visible price among available-only rows. */
  minPrice: number | null;
}

export function summarize<T extends RawReport>(rows: T[], now: Date, s: FreshnessSettings): MedicineSummary {
  let fresh = 0;
  let availableCount = 0;
  let lastAvailableAt: string | null = null;
  let minPrice: number | null = null;
  for (const r of rows) {
    const v = viewRow(r, now, s);
    if (v.freshness === 'fresh') fresh++;
    if (!passesAvailableOnly(v.display)) continue;
    availableCount++;
    if (!lastAvailableAt || r.reportedAt > lastAvailableAt) lastAvailableAt = r.reportedAt;
    if (v.priceIls != null && (minPrice == null || v.priceIls < minPrice)) minPrice = v.priceIls;
  }
  return { reporting: rows.length, fresh, availableCount, lastAvailableAt, minPrice };
}

/** Same day in Palestine local time ("حُدّث اليوم" filter). */
export function updatedToday(iso: string, now: Date): boolean {
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Gaza' }).format(d);
  return day(new Date(iso)) === day(now);
}
