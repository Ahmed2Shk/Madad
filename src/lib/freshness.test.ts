import { describe, expect, it } from 'vitest';
import {
  DISPLAY_RANK,
  displayOf,
  freshnessOf,
  passesAvailableOnly,
  viewOf,
  type Display,
  type Freshness,
  type Reported,
} from './freshness';

const now = new Date('2026-11-03T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 36e5);
const minutesAgo = (m: number) => new Date(now.getTime() - m * 6e4);

describe('displayOf — the 9 cases of the SPEC §3 matrix', () => {
  const matrix: [Reported, Freshness, Display][] = [
    ['available', 'fresh', 'available'],
    ['available', 'stale', 'needs_update'],
    ['available', 'expired', 'unconfirmed'],
    ['limited', 'fresh', 'limited'],
    ['limited', 'stale', 'needs_update'],
    ['limited', 'expired', 'unconfirmed'],
    ['unavailable', 'fresh', 'unavailable'],
    ['unavailable', 'stale', 'unavailable'],
    ['unavailable', 'expired', 'unconfirmed'],
  ];
  it.each(matrix)('%s + %s → %s', (r, f, d) => {
    expect(displayOf(r, f)).toBe(d);
  });
});

describe('freshnessOf — exact boundaries', () => {
  it('24:00 exactly is fresh', () => expect(freshnessOf(hoursAgo(24), now)).toBe('fresh'));
  it('24:01 is stale', () => expect(freshnessOf(minutesAgo(24 * 60 + 1), now)).toBe('stale'));
  it('72:00 exactly is stale (needs update)', () => expect(freshnessOf(hoursAgo(72), now)).toBe('stale'));
  it('72:01 is expired (unconfirmed)', () => expect(freshnessOf(minutesAgo(72 * 60 + 1), now)).toBe('expired'));
  it('just now is fresh', () => expect(freshnessOf(now, now)).toBe('fresh'));
});

describe('freshnessOf — admin settings change the result', () => {
  it('30-hour report is stale with defaults, fresh with fresh_hours=36', () => {
    expect(freshnessOf(hoursAgo(30), now)).toBe('stale');
    expect(freshnessOf(hoursAgo(30), now, 36, 72)).toBe('fresh');
  });
  it('50-hour report is expired when expire_hours=48', () => {
    expect(freshnessOf(hoursAgo(50), now, 24, 48)).toBe('expired');
  });
});

describe('viewOf — price visibility', () => {
  const base = { reportedStatus: 'available' as const, priceIls: 9.5 };

  it('shows the price on a fresh report with a recent price', () => {
    const v = viewOf({ ...base, reportedAt: minutesAgo(12), priceUpdatedAt: hoursAgo(2) }, now);
    expect(v).toEqual({ display: 'available', freshness: 'fresh', priceIls: 9.5 });
  });

  it('keeps the price while the report only needs an update', () => {
    const v = viewOf({ ...base, reportedAt: hoursAgo(30), priceUpdatedAt: hoursAgo(30) }, now);
    expect(v.display).toBe('needs_update');
    expect(v.priceIls).toBe(9.5);
  });

  it('hides the price when the report is unconfirmed', () => {
    const v = viewOf({ ...base, reportedAt: hoursAgo(73), priceUpdatedAt: hoursAgo(73) }, now);
    expect(v.display).toBe('unconfirmed');
    expect(v.priceIls).toBeNull();
  });

  it('hides a price older than price_max_days even on a fresh report', () => {
    const v = viewOf({ ...base, reportedAt: minutesAgo(5), priceUpdatedAt: hoursAgo(15 * 24) }, now);
    expect(v.display).toBe('available');
    expect(v.priceIls).toBeNull();
  });

  it('respects a custom price_max_days', () => {
    const r = { ...base, reportedAt: minutesAgo(5), priceUpdatedAt: hoursAgo(15 * 24) };
    expect(viewOf(r, now, { freshHours: 24, expireHours: 72, priceMaxDays: 30 }).priceIls).toBe(9.5);
  });

  it('returns null when no price was entered', () => {
    expect(viewOf({ ...base, priceIls: null, reportedAt: now, priceUpdatedAt: null }, now).priceIls).toBeNull();
  });
});

describe('ordering and the "available only" filter', () => {
  it('ranks displays in SPEC order', () => {
    const order = (Object.keys(DISPLAY_RANK) as Display[]).sort((a, b) => DISPLAY_RANK[a] - DISPLAY_RANK[b]);
    expect(order).toEqual(['available', 'limited', 'needs_update', 'unconfirmed', 'unavailable']);
  });

  it('"available only" keeps available, limited and needs update', () => {
    expect(passesAvailableOnly('available')).toBe(true);
    expect(passesAvailableOnly('limited')).toBe(true);
    expect(passesAvailableOnly('needs_update')).toBe(true);
    expect(passesAvailableOnly('unconfirmed')).toBe(false);
    expect(passesAvailableOnly('unavailable')).toBe(false);
  });
});
