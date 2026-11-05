/** Build-time flags from .env (SPEC §12). */
export const env = {
  demo: import.meta.env.VITE_DEMO === 'true',
  dataMode: import.meta.env.VITE_DATA_MODE === 'supabase' ? 'supabase' : 'mock',
  defaultGov: import.meta.env.VITE_DEFAULT_GOV ?? 'khan_younis',
  // The public anon key only. The service_role key never goes in the frontend.
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, ''),
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
} as const;
