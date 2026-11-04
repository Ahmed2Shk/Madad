// Client-side catalog matching for suggestions and mock search (SPEC §7 P-02, §12).
import { normalizeArabic, phoneticKey } from './normalizeArabic';

export interface Searchable {
  id: string;
  nameAr: string;
  nameEn: string;
  genericName: string;
  strength: string;
  strengthEn?: string | null;
  aliases: string[];
  barcode: string | null;
}

/** Everything a medicine can be found by, normalized once. */
export function searchTextOf(m: Searchable): string {
  return normalizeArabic([m.nameAr, m.nameEn, m.genericName, m.strength, m.strengthEn ?? '', ...m.aliases, m.barcode ?? ''].join(' '));
}

function rank<T extends Searchable>(catalog: T[], tokens: string[], phonetic: boolean): T[] {
  const fold = (s: string) => (phonetic ? phoneticKey(s) : s);
  return catalog
    .flatMap((m) => {
      const text = fold(searchTextOf(m));
      if (!tokens.every((t) => text.includes(t))) return [];
      const name = fold(normalizeArabic(`${m.nameAr} ${m.nameEn}`));
      const first = tokens[0]!;
      const score = (name.startsWith(first) ? 0 : 1) + (name.includes(first) ? 0 : 1);
      return [{ m, score }];
    })
    .sort((a, b) => a.score - b.score)
    .map((x) => x.m);
}

/**
 * Every query token must appear in the medicine's search text. A barcode matches exactly.
 * The phonetic key is a fallback used only when the normal pass finds nothing.
 */
export function matchCatalog<T extends Searchable>(catalog: T[], query: string, limit = 20): T[] {
  const q = normalizeArabic(query);
  if (!q) return [];
  if (/^\d{8,14}$/.test(q)) return catalog.filter((m) => m.barcode === q).slice(0, limit);
  const direct = rank(catalog, q.split(' '), false);
  if (direct.length) return direct.slice(0, limit);
  return rank(catalog, phoneticKey(q).split(' '), true).slice(0, limit);
}
