import { describe, expect, it } from 'vitest';
import { REPORT_LIMIT, allowReport } from './rateLimit';
import type { KeyValueStore } from './searchLog';

const memory = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('allowReport', () => {
  it(`allows ${REPORT_LIMIT} reports per hour, then blocks`, () => {
    const s = memory();
    for (let i = 0; i < REPORT_LIMIT; i++) expect(allowReport(s, i * 1000)).toBe(true);
    expect(allowReport(s, 10_000)).toBe(false);
  });

  it('allows again once the hour has passed', () => {
    const s = memory();
    for (let i = 0; i < REPORT_LIMIT; i++) allowReport(s, 0);
    expect(allowReport(s, 60 * 60 * 1000)).toBe(true);
  });
});
