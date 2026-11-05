// Supabase clients for VITE_DATA_MODE=supabase (SPEC §12). Built from the separate auth, database
// and storage packages rather than @supabase/supabase-js, so Realtime (not used, SPEC §12) stays out
// of the bundle. This module is only reached through the lazy import in src/data/index.ts.
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient, type PostgrestError } from '@supabase/postgrest-js';
import { StorageClient } from '@supabase/storage-js';
import { env } from '../../lib/env';

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required when VITE_DATA_MODE=supabase');
}

const key = env.supabaseAnonKey;

export const auth = new AuthClient({
  url: `${env.supabaseUrl}/auth/v1`,
  headers: { apikey: key, Authorization: `Bearer ${key}` },
  // Starts with "madad." so the demo reset (which clears madad.* keys) also signs out, as in mock mode.
  storageKey: 'madad.auth',
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  // PKCE: the provider sends back a one-time code (exchanged here), not tokens in the URL.
  flowType: 'pkce',
});

/** The demo role switcher reloads the page right after signing in; the open page must not refetch with the new account first. */
export const authNotify = { paused: false };

/** Every database and storage request carries the signed-in user's token, or the anon key. */
const authedFetch: typeof fetch = async (input, init) => {
  const { data } = await auth.getSession();
  const headers = new Headers(init?.headers);
  headers.set('apikey', key);
  headers.set('Authorization', `Bearer ${data.session?.access_token ?? key}`);
  return fetch(input, { ...init, headers });
};

export const db = new PostgrestClient(`${env.supabaseUrl}/rest/v1`, { headers: { apikey: key }, fetch: authedFetch, timeout: 20_000 });

export const storage = new StorageClient(`${env.supabaseUrl}/storage/v1`, { apikey: key }, authedFetch);

/** Database errors keep the code raised in SQL (e.g. "forbidden", "note_required") as their message. */
export class DbError extends Error {
  constructor(
    message: string,
    public readonly code: string | undefined,
  ) {
    super(message);
  }
}

/** Unwraps a PostgREST result: data, or a thrown DbError. */
export function must<T>(r: { data: T | null; error: PostgrestError | null }): T {
  if (r.error) throw new DbError(r.error.message, r.error.code);
  return r.data as T;
}

/** Calls an RPC (SPEC §13) and unwraps its result. */
export async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  return must<T>(await db.rpc(fn, args));
}
