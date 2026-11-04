// Per-viewer conveniences kept in localStorage: last governorate, "available only", data saver.
import { useSyncExternalStore } from 'react';
import { env } from '../lib/env';

export interface Preferences {
  gov: string;
  availableOnly: boolean;
  /** null = follow the browser's Save-Data signal. */
  dataSaver: boolean | null;
}

const KEY = 'madad.prefs';
const defaults: Preferences = { gov: env.defaultGov, availableOnly: true, dataSaver: null };

function read(): Preferences {
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Preferences>) };
  } catch {
    return defaults;
  }
}

let current = read();
const listeners = new Set<() => void>();

function write(patch: Partial<Preferences>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // preference just won't persist
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => void] {
  const prefs = useSyncExternalStore(subscribe, () => current, () => defaults);
  return [prefs, write];
}

interface NetworkInformation {
  saveData?: boolean;
}

/** Data saver: explicit choice, else on when the browser asks to save data (SPEC §11). */
export function useDataSaver(): boolean {
  const [prefs] = usePreferences();
  if (prefs.dataSaver !== null) return prefs.dataSaver;
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return conn?.saveData === true;
}
