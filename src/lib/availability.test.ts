import { describe, expect, it } from 'vitest';
import { sortRanked, summarize, updatedToday, viewRow, type RawReport } from './availability';
import { DEFAULT_FRESHNESS } from './freshness';

const now = new Date('2026-11-03T12:00:00Z');
const minAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
const row = (status: RawReport['reportedStatus'], minutesAgo: number, price: number | null = null): RawReport => ({
  reportedStatus: status,
  reportedAt: minAgo(minutesAgo),
  priceIls: price,
  priceUpdatedAt: price == null ? null : minAgo(minutesAgo),
});
const rank = (r: RawReport, d: number | null = null) => ({ row: r, view: viewRow(r, now, DEFAULT_FRESHNESS), distanceKm: d });

describe('sortRanked', () => {
  it('orders available → limited → needs update → unconfirmed → unavailable', () => {
    const items = [
      rank(row('unavailable', 10)),
      rank(row('available', 5 * 24 * 60)), // unconfirmed
      rank(row('available', 30 * 60)), // needs update
      rank(row('limited', 10)),
      rank(row('available', 10)),
    ];
    expect(sortRanked(items).map((x) => x.view.display)).toEqual([
      'available',
      'limited',
      'needs_update',
      'unconfirmed',
      'unavailable',
    ]);
  });

  it('within a group puts the nearest first when distance is known', () => {
    const far = rank(row('available', 5), 4);
    const near = rank(row('available', 50), 1);
    expect(sortRanked([far, near])[0]).toBe(near);
  });

  it('within a group puts the most recent first without distance', () => {
    const older = rank(row('available', 50));
    const newer = rank(row('available', 5));
    expect(sortRanked([older, newer])[0]).toBe(newer);
  });
});

describe('summarize', () => {
  it('counts reporting, fresh, available-only and the lowest visible price', () => {
    const s = summarize(
      [row('available', 12, 42), row('limited', 60, 44.5), row('available', 26 * 60), row('available', 4 * 24 * 60, 30)],
      now,
      DEFAULT_FRESHNESS,
    );
    expect(s).toEqual({ reporting: 4, fresh: 2, availableCount: 3, lastAvailableAt: minAgo(12), minPrice: 42 });
  });

  it('ignores the price of an unconfirmed report', () => {
    expect(summarize([row('available', 5 * 24 * 60, 1)], now, DEFAULT_FRESHNESS).minPrice).toBeNull();
  });
});

describe('updatedToday', () => {
  it('compares calendar days in Palestine time', () => {
    expect(updatedToday('2026-11-03T06:00:00Z', now)).toBe(true);
    expect(updatedToday('2026-11-02T21:30:00Z', now)).toBe(false); // 23:30 local on Nov 2
  });
});
