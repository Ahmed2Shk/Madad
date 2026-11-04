// Offline send queue for pharmacy updates (SPEC §8 PH-02, §11). Each change keeps the time it was
// made on the device; the server takes LEAST(that time, now) and ignores anything older than its
// current report, so a queued change can never overwrite a newer one.
import type { StockChange } from '../data/types';
import type { KeyValueStore } from './searchLog';

const key = (orgId: string) => `madad.queue.${orgId}`;

export function queued(store: KeyValueStore, orgId: string): StockChange[] {
  try {
    return JSON.parse(store.getItem(key(orgId)) ?? '[]') as StockChange[];
  } catch {
    return [];
  }
}

/** Adds changes; for the same medicine only the most recent edit is kept. */
export function enqueue(store: KeyValueStore, orgId: string, changes: StockChange[]): StockChange[] {
  const byMedicine = new Map(queued(store, orgId).map((c) => [c.medicineId, c]));
  for (const c of changes) {
    const prev = byMedicine.get(c.medicineId);
    if (!prev || c.clientUpdatedAt >= prev.clientUpdatedAt) byMedicine.set(c.medicineId, { ...prev, ...c });
  }
  const next = [...byMedicine.values()];
  store.setItem(key(orgId), JSON.stringify(next));
  return next;
}

export function clearQueue(store: KeyValueStore, orgId: string) {
  store.setItem(key(orgId), '[]');
}
