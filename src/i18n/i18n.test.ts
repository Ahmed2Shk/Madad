import { describe, expect, it } from 'vitest';
import ar from './ar.json';
import en from './en.json';

const PLURAL = /_(zero|one|two|few|many|other)$/;

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}
/** Plural variants collapse to their base key; languages have different plural forms. */
const base = (obj: object) => [...new Set(keys(obj).map((k) => k.replace(PLURAL, '')))].sort();

const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('i18n resources', () => {
  it('ar and en define the same keys', () => {
    expect(base(en)).toEqual(base(ar));
  });

  it('every literal t("...") key used in the code exists', () => {
    const used = new Set<string>();
    for (const text of Object.values(sources)) {
      for (const m of text.matchAll(/\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g)) used.add(m[1]!);
      for (const m of text.matchAll(/'(auth\.reason[A-Za-z]+)'/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(100);
    const known = new Set(base(ar));
    expect([...used].filter((k) => !known.has(k))).toEqual([]);
  });

  it('no Arabic string uses Eastern Arabic digits', () => {
    expect(JSON.stringify(ar)).not.toMatch(/[٠-٩]/);
  });
});
