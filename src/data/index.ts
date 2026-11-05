// Chooses the data source from VITE_DATA_MODE (SPEC §12). Both load lazily: the demo seeds and the
// Supabase clients each stay in their own chunk, out of the main bundle.
import type { Repos } from './types';

let pending: Promise<Repos> | null = null;

export function getRepos(): Promise<Repos> {
  pending ??=
    // Read straight from import.meta.env so the build drops the data layer it does not use.
    import.meta.env.VITE_DATA_MODE === 'supabase'
      ? import('./supabase').then((m) => m.supabaseRepos)
      : import('./mock/repos').then((m) => m.mockRepos);
  return pending;
}

export * from './types';
export { GOVERNORATES, governorateById } from './governorates';
export { DEFAULT_PERMS } from './perms';
