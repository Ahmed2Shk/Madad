// Going live and back (docs/GO_LIVE.md) on the real migrations: seed-live.sql leaves only the catalog
// and settings, keeps real accounts, removes every demo account; seed.sql brings the demo back.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createDb, one, readSql, rows, type Db } from './pglite';
import medicines from '../../src/data/mock/seed/medicines.json';
import categories from '../../src/data/mock/seed/categories.json';

const CATALOG = medicines.length;

const REAL = '11111111-1111-4111-8111-111111111111';
let db: Db;

beforeAll(async () => {
  db = await createDb();
  // A real account made on the demo site before going live (signed up with Google, say).
  await db.query(
    `insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', 'real@example.com', '{"full_name":"حساب حقيقي"}', now(), now())`,
    [REAL],
  );
}, 120_000);
afterAll(async () => {
  await db?.close();
});

const count = async (sql: string) => (await one<{ n: number }>(db, `select (${sql})::int as n`)).n;

describe('seed-live.sql', () => {
  it('keeps the catalog and settings only, with demo mode off', async () => {
    await db.exec(readSql('supabase/seed-live.sql'));
    expect(await count('select count(*) from public.organizations')).toBe(0);
    expect(await count('select count(*) from public.pharmacy_stock')).toBe(0);
    expect(await count('select count(*) from public.search_logs')).toBe(0);
    expect(await count('select count(*) from public.audit_log')).toBe(0);
    expect(await count(`select count(*) from public.medicines where status = 'approved' and not is_demo and barcode is null`)).toBe(CATALOG);
    expect(await count('select count(*) from public.categories')).toBe(categories.length);
    expect((await one<{ v: string }>(db, `select value #>> '{}' as v from public.settings where key = 'demo_mode'`)).v).toBe('false');
    expect((await one<{ v: string }>(db, `select value #>> '{}' as v from public.settings where key = 'fresh_hours'`)).v).toBe('24');
  });

  it('removes every demo account and the demo seed, and keeps real accounts', async () => {
    expect(await count(`select count(*) from auth.users where email like '%@madad.test'`)).toBe(0);
    expect(await count(`select count(*) from public.profiles where is_demo or platform_role is not null`)).toBe(0);
    expect(await rows(db, `select 1 from public.profiles where id = $1`, [REAL])).toHaveLength(1);
    expect(await count(`select count(*) from pg_proc where proname = 'demo_seed'`)).toBe(0);
    await as(db, REAL, () => expect(db.query('select public.demo_reset()')).rejects.toThrow());
  });

  it('a visitor sees the catalog', async () => {
    expect(await as(db, null, () => rows(db, `select id from public.medicines`))).toHaveLength(CATALOG);
  });
});

describe('back to the demo', () => {
  it('seed.sql restores the demo accounts, data and demo mode', async () => {
    await db.exec(readSql('supabase/seed.sql'));
    expect(await count(`select count(*) from auth.users where email = 'patient@madad.test'`)).toBe(1);
    expect(await count(`select count(*) from public.organizations where verification_status = 'approved'`)).toBeGreaterThan(10);
    expect(await count('select count(*) from public.pharmacy_stock')).toBeGreaterThan(300);
    expect((await one<{ v: string }>(db, `select value #>> '{}' as v from public.settings where key = 'demo_mode'`)).v).toBe('true');
    expect(await rows(db, `select 1 from public.profiles where id = $1`, [REAL])).toHaveLength(1);
  });
});
