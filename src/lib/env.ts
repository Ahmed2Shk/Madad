/** Build-time flags from .env (SPEC §12). */
export const env = {
  demo: import.meta.env.VITE_DEMO === 'true',
  dataMode: import.meta.env.VITE_DATA_MODE === 'supabase' ? 'supabase' : 'mock',
  defaultGov: import.meta.env.VITE_DEFAULT_GOV ?? 'khan_younis',
} as const;
