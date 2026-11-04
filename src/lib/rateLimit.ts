// Per-browser limit for anonymous reports (SPEC §7 P-13): at most REPORT_LIMIT per hour.
import type { KeyValueStore } from './searchLog';

export const REPORT_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;
const KEY = 'madad.reports.sent';

export function allowReport(store: KeyValueStore, now = Date.now()): boolean {
  let times: number[];
  try {
    times = (JSON.parse(store.getItem(KEY) ?? '[]') as number[]).filter((t) => now - t < WINDOW_MS);
  } catch {
    times = [];
  }
  if (times.length >= REPORT_LIMIT) return false;
  try {
    store.setItem(KEY, JSON.stringify([...times, now]));
  } catch {
    // storage blocked: allow, the server keeps its own limit
  }
  return true;
}
