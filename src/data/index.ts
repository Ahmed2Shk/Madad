// Chooses the data source from VITE_DATA_MODE (SPEC §12). Both load lazily so the demo seeds
// stay out of the main bundle.
import { env } from '../lib/env';
import type { Repos } from './types';

let pending: Promise<Repos> | null = null;

export function getRepos(): Promise<Repos> {
  pending ??=
    env.dataMode === 'supabase'
      ? Promise.reject(new Error('Supabase mode arrives in phase 4'))
      : import('./mock/repos').then((m) => m.mockRepos);
  return pending;
}

export * from './types';
export { GOVERNORATES, governorateById } from './governorates';
export { DEFAULT_PERMS } from './perms';
