// Fuzzy matching for catalog requests (SPEC §10 AD-04 "قد يكرر دواءً موجودًا"), mirroring pg_trgm.
import { normalizeArabic } from './normalizeArabic';

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of normalizeArabic(s).split(' ')) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** Trigram similarity in [0, 1], like pg_trgm's similarity(). */
export function similarity(a: string, b: string): number {
  const x = trigrams(a);
  const y = trigrams(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const t of x) if (y.has(t)) shared++;
  return shared / (x.size + y.size - shared);
}

export interface Candidate {
  id: string;
  names: string[];
}

/** Catalog entries that look like the requested medicine, best first. */
export function likelyDuplicates(names: string[], catalog: Candidate[], threshold = 0.45): { id: string; score: number }[] {
  return catalog
    .map((c) => ({ id: c.id, score: Math.max(...names.flatMap((n) => c.names.map((cn) => similarity(n, cn)))) }))
    .filter((x) => x.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
