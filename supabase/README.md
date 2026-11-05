# Supabase (VITE_DATA_MODE=supabase)

The database behind MADAD in `supabase` mode (SPEC §12–13). Mock mode does not need any of this.

| Path | What it is |
| --- | --- |
| `migrations/0001…0008` | Extensions, enums, tables, triggers, views, RLS, RPC and Storage, in order |
| `seed.sql` | Demo data, **generated** by `node scripts/build-seed.mjs` from `src/data/mock/seed/*.json` |
| `tests/` | The migrations and seed run in PGlite (Postgres in WASM) during `npm test`: RLS, RPC, freshness view |

## Set up a project (free plan)

1. Create a Supabase project. In **Authentication → Sign In / Providers → Email**, turn **Confirm email** off (SPEC §12).
2. Run the migrations in order (`supabase db push`, or paste each file into the SQL editor).
3. For a demo project only: run `seed.sql`. It creates the demo accounts (password `madad-demo-2026`),
   sets `demo_mode`, and loads the same data as mock mode. Never run it on a real project.
4. In `.env`: `VITE_DATA_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the **anon** key only).
5. For `.github/workflows/keepalive.yml`, add the repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

After changing a seed JSON file, run `node scripts/gen-seed.mjs` (if needed) and then `node scripts/build-seed.mjs`.

## Rules the schema enforces

- Visitors read approved organizations, the approved catalog and `public_availability` only.
  `stock_private`, `organization_private`, `search_logs`, `page_views` and `audit_log` have no public access.
- Every change to stock, team, verification, catalog or settings goes through a `SECURITY DEFINER`
  function that checks `has_org_perm()` or `is_platform()`. Clients have no direct write access to those tables.
- `audit_log` is written by triggers (and by the few functions that log an action rather than a row);
  the system admin reads it, nobody can change it.
- `reported_at = LEAST(clientUpdatedAt, now())`; a change older than the current report is ignored.
