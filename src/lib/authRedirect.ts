// Sign-in with Google (docs/DECISIONS.md): where Google sends the user back, and what the return carries.

export const CALLBACK_PATH = '/auth/callback';

/** A same-site path to return to after sign-in, or null (no open redirects, no loop through the callback). */
export function safeFrom(from: unknown): string | null {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.startsWith('/\\')) return null;
  return from.startsWith(CALLBACK_PATH) ? null : from;
}

/** The URL Google (through Supabase Auth) redirects to: our callback page, keeping where the user came from. */
export function callbackUrl(origin: string, from?: string | null): string {
  const back = safeFrom(from);
  return `${origin}${CALLBACK_PATH}${back ? `?from=${encodeURIComponent(back)}` : ''}`;
}

/** Reads the return: the page to go to, and an error if the user cancelled or the provider refused. */
export function readCallback(search: string, hash = ''): { from: string | null; error: string | null } {
  const q = new URLSearchParams(search);
  const h = new URLSearchParams(hash.replace(/^#/, ''));
  const error = q.get('error_description') ?? q.get('error') ?? h.get('error_description') ?? h.get('error');
  return { from: safeFrom(q.get('from')), error };
}
