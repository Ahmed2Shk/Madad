import { useEffect, useRef } from 'react';
import { logSearch } from '../../data/queries';
import type { SearchLogEntry } from '../../data';
import { shouldLogSearch } from '../../lib/searchLog';
import { safeStorage } from '../../lib/storage';

/**
 * Logs one anonymous search once `entry` is known (results loaded). Duplicate text+governorate
 * within 10 minutes is skipped in the browser; no session id is sent (SPEC §7).
 */
export function useSearchLog(entry: SearchLogEntry | null) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!entry) return;
    const key = `${entry.query}|${entry.governorate}`;
    if (done.current === key) return;
    done.current = key;
    if (shouldLogSearch(entry.query, String(entry.governorate), Date.now(), safeStorage)) void logSearch(entry);
  }, [entry]);
}

const LAST_KEY = 'madad.lastSearch';

export interface LastSearch {
  q: string;
  gov: string;
  at: number;
}

/** The last search, shown on the home page when offline (SPEC §7 P-01). */
export function rememberLastSearch(q: string, gov: string) {
  safeStorage.setItem(LAST_KEY, JSON.stringify({ q, gov, at: Date.now() }));
}

export function readLastSearch(): LastSearch | null {
  try {
    const raw = safeStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as LastSearch) : null;
  } catch {
    return null;
  }
}
