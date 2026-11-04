// Client-side de-duplication for the anonymous search log (SPEC §7 P-02):
// one entry per normalized text + governorate per 10 minutes, with no session id stored anywhere.
import { normalizeArabic } from './normalizeArabic';

export const LOG_WINDOW_MS = 10 * 60 * 1000;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'madad.searchlog.recent';

function read(store: KeyValueStore): Record<string, number> {
  try {
    return JSON.parse(store.getItem(KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

/** Returns true (and remembers it) when this search should be logged now. */
export function shouldLogSearch(query: string, gov: string, now: number, store: KeyValueStore): boolean {
  const key = `${normalizeArabic(query)}|${gov}`;
  const recent = read(store);
  for (const [k, t] of Object.entries(recent)) if (now - t >= LOG_WINDOW_MS) delete recent[k];
  if (recent[key] !== undefined) return false;
  recent[key] = now;
  try {
    store.setItem(KEY, JSON.stringify(recent));
  } catch {
    // storage blocked: log anyway, duplicates are better than silence
  }
  return true;
}
