import { describe, expect, it } from 'vitest';
import { isOpenNow, localDayMinutes, type Hours } from './hours';

// 2026-11-03 is a Tuesday. Palestine is UTC+2 in November.
const at = (iso: string) => new Date(iso);

describe('localDayMinutes', () => {
  it('converts to Palestine local time', () => {
    expect(localDayMinutes(at('2026-11-03T08:30:00Z'))).toEqual({ day: 'tue', minutes: 10 * 60 + 30 });
  });
});

describe('isOpenNow', () => {
  const hours: Hours = { tue: [['08:00', '14:00'], ['16:00', '22:00']], wed: [['20:00', '02:00']] };

  it('is open inside a range', () => {
    expect(isOpenNow(hours, at('2026-11-03T08:30:00Z'))).toBe(true); // 10:30
  });

  it('is closed in the midday gap', () => {
    expect(isOpenNow(hours, at('2026-11-03T13:00:00Z'))).toBe(false); // 15:00
  });

  it('handles a range that runs past midnight', () => {
    expect(isOpenNow(hours, at('2026-11-04T22:30:00Z'))).toBe(true); // Thu 00:30, from Wed 20:00–02:00
    expect(isOpenNow(hours, at('2026-11-05T01:00:00Z'))).toBe(false); // Thu 03:00
  });

  it('returns null when hours are unknown', () => {
    expect(isOpenNow(null, at('2026-11-03T08:30:00Z'))).toBeNull();
    expect(isOpenNow({}, at('2026-11-03T08:30:00Z'))).toBeNull();
  });
});
