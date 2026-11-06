// PH-02 "Undo": a save is kept on the device for a few seconds before it is sent, so a mistaken
// status can be taken back before anyone sees it or an alert goes out. Kept in storage (not only in
// memory) so a closed tab cannot lose it: whatever is still held is sent the next time.
// Each change keeps its device time (clientUpdatedAt); holding never changes when it was made.
import type { StockChange } from '../data/types';
import type { KeyValueStore } from './searchLog';

export const HOLD_MS = 5000;

export interface HeldSave {
  id: string;
  changes: StockChange[];
  /** When it goes out on its own (ms since epoch). */
  sendAt: number;
}

const key = (orgId: string) => `madad.held.${orgId}`;

export function heldSaves(store: KeyValueStore, orgId: string): HeldSave[] {
  try {
    const list = JSON.parse(store.getItem(key(orgId)) ?? '[]') as HeldSave[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const write = (store: KeyValueStore, orgId: string, list: HeldSave[]) => store.setItem(key(orgId), JSON.stringify(list));

/** Keeps changes back for `holdMs`; returns the held save (its id is what Undo takes back). */
export function holdSave(store: KeyValueStore, orgId: string, changes: StockChange[], now: number, holdMs = HOLD_MS): HeldSave {
  const held: HeldSave = { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, changes, sendAt: now + holdMs };
  write(store, orgId, [...heldSaves(store, orgId), held]);
  return held;
}

/**
 * Takes a held save out of storage to send it, or to drop it on Undo. Returns its changes, or null
 * when it is gone already (sent, or taken back) — so nothing is ever sent twice.
 */
export function takeHeld(store: KeyValueStore, orgId: string, id: string): StockChange[] | null {
  const list = heldSaves(store, orgId);
  const found = list.find((h) => h.id === id);
  if (!found) return null;
  write(store, orgId, list.filter((h) => h.id !== id));
  return found.changes;
}
