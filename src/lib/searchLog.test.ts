import { describe, expect, it } from 'vitest';
import { LOG_WINDOW_MS, shouldLogSearch, type KeyValueStore } from './searchLog';

const memory = (): KeyValueStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

describe('shouldLogSearch', () => {
  it('logs once per text and governorate within 10 minutes', () => {
    const s = memory();
    expect(shouldLogSearch('إنسولين', 'khan_younis', 0, s)).toBe(true);
    expect(shouldLogSearch('انسولين', 'khan_younis', 60_000, s)).toBe(false); // same after normalizing
    expect(shouldLogSearch('انسولين', 'gaza', 60_000, s)).toBe(true); // other governorate
  });

  it('logs again after the window', () => {
    const s = memory();
    shouldLogSearch('سالبوتامول', 'rafah', 0, s);
    expect(shouldLogSearch('سالبوتامول', 'rafah', LOG_WINDOW_MS, s)).toBe(true);
  });

  it('still logs when storage throws', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(shouldLogSearch('x', 'gaza', 0, broken)).toBe(true);
  });
});
