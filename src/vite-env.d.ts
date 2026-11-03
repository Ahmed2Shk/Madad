/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'mock' | 'supabase';
  readonly VITE_DEMO?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TILE_URL?: string;
  readonly VITE_DEFAULT_GOV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
