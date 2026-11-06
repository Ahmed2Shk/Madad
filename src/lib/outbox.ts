// A small on-device outbox for actions made offline (SPEC §11: "الاستفسارات تُحفظ محليًا وتُرسل عند
// عودة الاتصال"). Items keep the time they were made and leave the box only once sent.
import type { KeyValueStore } from './searchLog';

export interface OutboxItem<T> {
  id: string;
  /** When the user did it on the device. */
  at: string;
  payload: T;
}

const key = (box: string) => `madad.outbox.${box}`;
/** A full box stops taking more, so a long outage cannot fill the device's storage. */
export const OUTBOX_MAX = 20;

export function outboxItems<T>(store: KeyValueStore, box: string): OutboxItem<T>[] {
  try {
    const v = JSON.parse(store.getItem(key(box)) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as OutboxItem<T>[]) : [];
  } catch {
    return [];
  }
}

/** Adds an item; returns false when the box is full. */
export function addToOutbox<T>(store: KeyValueStore, box: string, payload: T, now = new Date()): boolean {
  const items = outboxItems<T>(store, box);
  if (items.length >= OUTBOX_MAX) return false;
  const id = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  store.setItem(key(box), JSON.stringify([...items, { id, at: now.toISOString(), payload }]));
  return true;
}

export function removeFromOutbox(store: KeyValueStore, box: string, id: string) {
  store.setItem(key(box), JSON.stringify(outboxItems(store, box).filter((x) => x.id !== id)));
}

/**
 * Sends items oldest first and removes each one that went through. Stops at the first failure,
 * so order is kept and nothing is lost; returns how many were sent.
 */
export async function flushOutbox<T>(store: KeyValueStore, box: string, send: (payload: T) => Promise<unknown>): Promise<number> {
  let sent = 0;
  for (const item of outboxItems<T>(store, box)) {
    try {
      await send(item.payload);
    } catch {
      break;
    }
    removeFromOutbox(store, box, item.id);
    sent++;
  }
  return sent;
}
