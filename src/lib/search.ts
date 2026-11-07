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

/** Edit distance with swaps of neighbours (بندول ↔ بنادول = 1, Panadool ↔ Panadol = 1). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  return d[a.length]![b.length]!;
}

/** How many typing mistakes a word of this length may have and still count as close. */
const allowed = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : len <= 10 ? 2 : 3);

/**
 * «هل تقصد؟» — medicines whose name, active ingredient or alias is a few typing mistakes away from
 * the query, closest first. Only for suggestions the user chooses from: similar names can be
 * different medicines, so a close match must never replace the query by itself.
 */
export function closeMatches<T extends Searchable>(catalog: T[], query: string, limit = 3): T[] {
  const words = normalizeArabic(query).split(' ').filter((w) => w.length > 3);
  if (words.length === 0) return [];
  return catalog
    .flatMap((m) => {
      const names = normalizeArabic([m.nameAr, m.nameEn, m.genericName, ...m.aliases].join(' ')).split(' ').filter(Boolean);
      let total = 0;
      for (const w of words) {
        const best = Math.min(...names.map((n) => editDistance(w, n)));
        if (best > allowed(w.length)) return [];
        total += best;
      }
      return [{ m, total }];
    })
    .sort((a, b) => a.total - b.total)
    .slice(0, limit)
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
