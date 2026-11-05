// Runs the real migrations and seed in PGlite (Postgres compiled to WASM), with the few Supabase
// pieces they rely on stubbed: the anon/authenticated roles, auth.users and auth.uid(), and the
// storage tables. Lets CI test RLS and the RPCs without a Supabase project or Docker.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Tests run from the project root (vitest), under jsdom, so paths are resolved from cwd.
const at = (path: string) => resolve(process.cwd(), path);

const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated;
create table auth.users (
  instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz,
  updated_at timestamptz, confirmation_token text, email_change text, email_change_token_new text, recovery_token text
);
create table auth.identities (
  id uuid primary key, user_id uuid references auth.users (id) on delete cascade, provider_id text, identity_data jsonb,
  provider text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz, unique (provider_id, provider)
);
-- Same claim Supabase reads: the JWT "sub" set by PostgREST for each request.
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
grant usage on schema storage to anon, authenticated;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant select, insert on storage.objects to anon, authenticated;
`;

export const migrations = () =>
  readdirSync(at('supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort();

export const readSql = (path: string) => readFileSync(at(path), 'utf8');

export type Db = PGlite;

/** A fresh database with every migration and the demo seed applied. */
export async function createDb(opts: { seed?: boolean } = {}): Promise<Db> {
  const db = new PGlite({ extensions: { pg_trgm, pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  for (const f of migrations()) await db.exec(readSql(`supabase/migrations/${f}`));
  if (opts.seed !== false) await db.exec(readSql('supabase/seed.sql'));
  return db;
}

/**
 * Runs fn as a visitor (userId null) or a signed-in user, the way PostgREST would: role anon or
 * authenticated, and the JWT claims in request.jwt.claims. Always returns to the superuser.
 */
export async function as<T>(db: Db, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    userId
      ? `set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, role: 'authenticated' })}', false);`
      : `set role anon; select set_config('request.jwt.claims', '', false);`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
  }
}

export async function rows<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

export async function one<T = Record<string, unknown>>(db: Db, sql: string, params: unknown[] = []): Promise<T> {
  const r = await rows<T>(db, sql, params);
  if (!r[0]) throw new Error(`no row: ${sql}`);
  return r[0];
}

/** Seed text id → UUID, as scripts/build-seed.mjs and the SQL md5('madad:' || id)::uuid compute it. */
export function uuidOf(id: string): string {
  const h = createHash('md5').update(`madad:${id}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
