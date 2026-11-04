import type { KeyValueStore } from './searchLog';

/** localStorage that never throws (private windows, blocked site data, previews). */
export const safeStorage: KeyValueStore = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignored on purpose
    }
  },
};

/** Reads a JSON value, falling back when missing or unreadable. */
export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = safeStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
