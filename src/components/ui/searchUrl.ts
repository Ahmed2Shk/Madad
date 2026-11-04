import type { GovFilter } from '../../data';

/** /search?q=&gov= (SPEC §6), with avail=0 only when "available only" is off. */
export function searchUrl(q: string, gov: GovFilter, availableOnly: boolean) {
  const p = new URLSearchParams({ q, gov });
  if (!availableOnly) p.set('avail', '0');
  return `/search?${p}`;
}
