// Phase 4 acceptance on the real migrations (SPEC §14): RLS keeps visitors out of stock_private and
// search_logs, a pharmacy cannot change another pharmacy, and the database agrees with the app's own
// freshness, normalization and search rules.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mapCatalog, type RawCatalog } from '../../src/data/catalog';
import { normalizeArabic } from '../../src/lib/normalizeArabic';
import { matchCatalog } from '../../src/lib/search';
import categories from '../../src/data/mock/seed/categories.json';
import medicines from '../../src/data/mock/seed/medicines.json';
import { as, createDb, one, rows, uuidOf, type Db } from './pglite';

const PATIENT = uuidOf('u-patient');
const OWNER = uuidOf('u-ph-owner'); // owner of ph-nour (Khan Younis)
const STAFF = uuidOf('u-ph-staff'); // staff of ph-shifa (Gaza): availability, no prices
const REVIEWER = uuidOf('u-reviewer');
const ADMIN = uuidOf('u-admin');
const NOUR = uuidOf('ph-nour');
const SHIFA = uuidOf('ph-shifa');
const BUSHRA = uuidOf('ph-bushra'); // pending

let db: Db;
beforeAll(async () => {
  db = await createDb();
}, 120_000);
afterAll(async () => {
  await db?.close();
});

/** Each mutating test starts from the seeds again. */
const reseed = () => db.exec('select public.demo_seed()');

const denied = (p: Promise<unknown>) => expect(p).rejects.toThrow(/permission denied|forbidden|row-level security/);

describe('Arabic normalization', () => {
  it('normalize_ar() in Postgres gives exactly what normalizeArabic() gives in the app', async () => {
    const samples = [
      ...medicines.flatMap((m) => [m.name_ar, m.name_en, m.generic_name, m.strength, ...m.aliases]),
      'باراسيتامول500', 'إنسولين', 'أَمُوكْسِيسِيلِّين', 'Insulin-Glargine', '٥٠٠ ملغ', '۲۰ قرص', 'فيتامين د٣',
      'Vitamin D3 (1000 IU)', '«بنادول»، أدول؛ ؟', 'مـــدد', 'x-5', '5.5%', 'a/b', '  مسافات   كثيرة ', 'مستشفىٰ',
    ];
    const got = await rows<{ t: string; n: string }>(db, 'select t, public.normalize_ar(t) as n from unnest($1::text[]) t', [samples]);
    for (const r of got) expect(r.n, r.t).toBe(normalizeArabic(r.t));
  });
});

describe('search_medicines()', () => {
  const catalog = mapCatalog({ version: 1, categories, medicines } as RawCatalog).medicines;

  it.each([
    'انسولين', 'إنسولين', 'insulin', 'باراسيتامول 500', 'باراسيتامول500', 'بنادول', 'panadol', '6250000000001', 'امو', 'فيتامين', 'سالبوتامول', 'zzzz',
  ])('ranks «%s» the way matchCatalog() does', async (query) => {
    const sql = await as(db, null, () => rows<{ medicine_id: string }>(db, `select medicine_id from public.search_medicines($1, 'all')`, [query]));
    expect(sql.map((r) => r.medicine_id)).toEqual(matchCatalog(catalog, query).map((m) => m.id));
  });

  it('«انسولين», «إنسولين» and «insulin» give the same result (phase 1 acceptance)', async () => {
    const ids = async (query: string) => (await as(db, null, () => rows<{ medicine_id: string }>(db, 'select medicine_id from public.search_medicines($1)', [query]))).map((r) => r.medicine_id);
    const a = await ids('انسولين');
    expect(a.length).toBeGreaterThan(0);
    expect(await ids('إنسولين')).toEqual(a);
    expect(new Set(await ids('insulin'))).toEqual(new Set(a));
  });
});

describe('public_availability view (SPEC §3 table)', () => {
  beforeEach(reseed);

  /** Sets nine of ph-nour's rows to each status × age and reads them back in one transaction (one now()). */
  async function matrix(ages: Record<string, string>) {
    return db.transaction(async (tx) => {
      const targets = (await tx.query<{ medicine_id: string }>(
        'select medicine_id from public.pharmacy_stock where pharmacy_id = $1 and is_listed and not hidden_by_admin order by medicine_id limit 9', [NOUR])).rows;
      const cases = (['available', 'limited', 'unavailable'] as const).flatMap((status) => Object.entries(ages).map(([age, interval]) => ({ status, age, interval })));
      for (const [i, c] of cases.entries()) {
        await tx.query(
          `update public.pharmacy_stock set reported_status = $1, reported_at = now() - $2::interval, price_ils = 10, price_updated_at = now() - $2::interval
           where pharmacy_id = $3 and medicine_id = $4`, [c.status, c.interval, NOUR, targets[i]!.medicine_id]);
      }
      const out = (await tx.query<{ medicine_id: string; display_status: string; price_ils: string | null }>(
        'select medicine_id, display_status, price_ils from public.public_availability where pharmacy_id = $1', [NOUR])).rows;
      return cases.map((c, i) => ({ ...c, ...out.find((r) => r.medicine_id === targets[i]!.medicine_id)! }));
    });
  }

  it('matches displayOf() for all nine cases, and hides the price once unconfirmed', async () => {
    const got = await matrix({ fresh: '1 hour', stale: '30 hours', expired: '80 hours' });
    const expected: Record<string, Record<string, string>> = {
      available: { fresh: 'available', stale: 'needs_update', expired: 'unconfirmed' },
      limited: { fresh: 'limited', stale: 'needs_update', expired: 'unconfirmed' },
      unavailable: { fresh: 'unavailable', stale: 'unavailable', expired: 'unconfirmed' },
    };
    for (const g of got) {
      expect(g.display_status, `${g.status} ${g.age}`).toBe(expected[g.status]![g.age]);
      if (g.age === 'expired') expect(g.price_ils).toBeNull();
      else expect(Number(g.price_ils)).toBe(10);
    }
  });

  it('keeps the exact boundaries: 24:00 is fresh, 72:00 needs an update, 72:01 is unconfirmed', async () => {
    const got = await matrix({ h24: '24 hours', h72: '72 hours', h72m1: '72 hours 1 minute' });
    const available = Object.fromEntries(got.filter((g) => g.status === 'available').map((g) => [g.age, g.display_status]));
    expect(available).toEqual({ h24: 'available', h72: 'needs_update', h72m1: 'unconfirmed' });
  });

  it('follows fresh_hours when the admin changes it (AD-11)', async () => {
    await db.exec(`update public.settings set value = '36' where key = 'fresh_hours'`);
    const got = await matrix({ h30: '30 hours', h1: '1 hour', h40: '40 hours' });
    expect(got.find((g) => g.status === 'available' && g.age === 'h30')!.display_status).toBe('available');
    expect(got.find((g) => g.status === 'available' && g.age === 'h40')!.display_status).toBe('needs_update');
  });

  it('drops a price older than price_max_days even when the report is fresh', async () => {
    const [row] = await rows<{ medicine_id: string }>(db, 'select medicine_id from public.pharmacy_stock where pharmacy_id = $1 and is_listed and not hidden_by_admin limit 1', [NOUR]);
    await db.query(`update public.pharmacy_stock set reported_at = now(), price_ils = 9.5, price_updated_at = now() - interval '15 days' where pharmacy_id = $1 and medicine_id = $2`, [NOUR, row!.medicine_id]);
    const v = await one<{ price_ils: string | null }>(db, 'select price_ils from public.public_availability where pharmacy_id = $1 and medicine_id = $2', [NOUR, row!.medicine_id]);
    expect(v.price_ils).toBeNull();
  });
});

describe('RLS: visitors', () => {
  it('cannot read stock_private, search_logs, organization_private, page_views or audit_log', async () => {
    await as(db, null, async () => {
      for (const t of ['stock_private', 'search_logs', 'organization_private', 'page_views', 'audit_log']) await denied(db.query(`select * from public.${t} limit 1`));
    });
  });

  it('see approved organizations only, and no quantity or reporter in the public view', async () => {
    const approved = await one<{ n: number }>(db, `select count(*)::int as n from public.organizations where verification_status = 'approved'`);
    const seen = await as(db, null, () => one<{ n: number; bushra: number }>(db,
      `select count(*)::int as n, count(*) filter (where id = $1)::int as bushra from public.organizations`, [BUSHRA]));
    expect(seen.n).toBe(approved.n);
    expect(seen.bushra).toBe(0);
    const cols = await as(db, null, () => db.query('select * from public.public_availability limit 1'));
    expect(cols.fields.map((f) => f.name)).toEqual(['pharmacy_id', 'medicine_id', 'governorate', 'reported_status', 'reported_at', 'display_status', 'price_ils', 'price_updated_at']);
    const bushra = await as(db, null, () => rows(db, 'select 1 from public.public_availability where pharmacy_id = $1', [BUSHRA]));
    expect(bushra).toHaveLength(0);
  });

  it('cannot write the audit log, change stock or call team functions', async () => {
    await as(db, null, async () => {
      await denied(db.query(`insert into public.audit_log (action, entity_type, entity_id) values ('x', 'x', 'x')`));
      await denied(db.query(`select public.write_audit('x', 'x', 'x', null, null)`));
      await denied(db.query(`update public.pharmacy_stock set reported_status = 'available'`));
      await denied(db.query(`select public.update_stock($1, '[]'::jsonb)`, [NOUR]));
      await denied(db.query(`select public.admin_overview()`));
    });
  });

  it('can send a report but not read reports', async () => {
    await as(db, null, async () => {
      await db.query(`insert into public.reports (entity_type, entity_id, reason, details) values ('pharmacy', $1, 'wrong_phone', 'test')`, [NOUR]);
      expect((await db.query('select * from public.reports')).rows).toHaveLength(0);
    });
  });
});

describe('RLS: signed-in users', () => {
  beforeEach(reseed);

  it('a patient sees no stock_private rows and cannot read search_logs', async () => {
    await as(db, PATIENT, async () => {
      expect((await db.query('select * from public.stock_private')).rows).toHaveLength(0);
      await denied(db.query('select * from public.search_logs limit 1'));
    });
  });

  it('a patient cannot give themselves a platform role', async () => {
    await as(db, PATIENT, () => denied(db.query(`update public.profiles set platform_role = 'super_admin' where id = $1`, [PATIENT])));
    await as(db, PATIENT, () => denied(db.query('select public.admin_overview()')));
  });

  it('only members with the medicines permission read the internal quantity', async () => {
    const owner = await as(db, OWNER, () => rows<{ pharmacy_id: string }>(db, 'select pharmacy_id from public.stock_private'));
    expect(owner.length).toBeGreaterThan(0);
    expect(new Set(owner.map((r) => r.pharmacy_id))).toEqual(new Set([NOUR]));
    const staff = await as(db, STAFF, () => rows(db, 'select 1 from public.stock_private'));
    expect(staff).toHaveLength(0);
  });

  it('a pharmacy cannot change another pharmacy (phase 4 acceptance)', async () => {
    const before = await rows(db, 'select * from public.pharmacy_stock where pharmacy_id = $1 order by medicine_id', [NOUR]);
    const [row] = before as { medicine_id: string }[];
    const change = JSON.stringify([{ medicineId: row!.medicine_id, status: 'unavailable', clientUpdatedAt: new Date().toISOString() }]);
    await as(db, STAFF, async () => {
      await denied(db.query('select public.update_stock($1, $2::jsonb)', [NOUR, change]));
      await denied(db.query('select public.confirm_all($1)', [NOUR]));
      await denied(db.query(`select public.stock_remove($1, $2)`, [NOUR, row!.medicine_id]));
      await denied(db.query(`select public.update_org_profile($1, '{"phone":"000"}'::jsonb)`, [NOUR]));
      await denied(db.query(`insert into public.stock_private (pharmacy_id, medicine_id, quantity) values ($1, $2, 1) on conflict do nothing`, [NOUR, row!.medicine_id]));
    });
    await as(db, OWNER, () => denied(db.query('select public.update_stock($1, $2::jsonb)', [SHIFA, change])));
    expect(await rows(db, 'select * from public.pharmacy_stock where pharmacy_id = $1 order by medicine_id', [NOUR])).toEqual(before);
  });

  it('staff without the prices permission update availability but not the price', async () => {
    const [row] = await rows<{ medicine_id: string; price_ils: string | null }>(db,
      'select medicine_id, price_ils from public.pharmacy_stock where pharmacy_id = $1 order by medicine_id limit 1', [SHIFA]);
    const change = JSON.stringify([{ medicineId: row!.medicine_id, status: 'limited', priceIls: 99, clientUpdatedAt: new Date().toISOString() }]);
    await as(db, STAFF, () => db.query('select public.update_stock($1, $2::jsonb)', [SHIFA, change]));
    const after = await one<{ reported_status: string; price_ils: string | null }>(db,
      'select reported_status, price_ils from public.pharmacy_stock where pharmacy_id = $1 and medicine_id = $2', [SHIFA, row!.medicine_id]);
    expect(after.reported_status).toBe('limited');
    expect(after.price_ils).toBe(row!.price_ils);
  });
});

describe('update_stock() and confirm_all()', () => {
  beforeEach(reseed);

  const nourRow = async () =>
    one<{ medicine_id: string; reported_at: Date }>(db, `select medicine_id, reported_at from public.pharmacy_stock where pharmacy_id = $1 and is_listed order by medicine_id limit 1`, [NOUR]);
  const update = (medicineId: string, status: string, clientUpdatedAt: string, priceIls?: number) =>
    as(db, OWNER, () => db.query('select public.update_stock($1, $2::jsonb)', [NOUR, JSON.stringify([{ medicineId, status, clientUpdatedAt, ...(priceIls === undefined ? {} : { priceIls }) }])]));
  const current = (medicineId: string) =>
    one<{ reported_status: string; reported_at: Date; price_ils: string | null }>(db, 'select reported_status, reported_at, price_ils from public.pharmacy_stock where pharmacy_id = $1 and medicine_id = $2', [NOUR, medicineId]);

  it('takes the device time, never a future one (LEAST(client, now()))', async () => {
    const { medicine_id } = await nourRow();
    const edited = new Date(Date.now() - 5 * 60_000).toISOString();
    await update(medicine_id, 'available', edited, 12.5);
    const r = await current(medicine_id);
    expect(r.reported_at.toISOString()).toBe(edited);
    expect(Number(r.price_ils)).toBe(12.5);

    await update(medicine_id, 'limited', new Date(Date.now() + 86_400_000).toISOString());
    expect((await current(medicine_id)).reported_at.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('ignores a queued change older than the current report', async () => {
    const { medicine_id } = await nourRow();
    await update(medicine_id, 'available', new Date().toISOString());
    await update(medicine_id, 'unavailable', new Date(Date.now() - 3_600_000).toISOString());
    expect((await current(medicine_id)).reported_status).toBe('available');
  });

  it('writes stock_history and the audit log with the actor', async () => {
    const { medicine_id } = await nourRow();
    await update(medicine_id, 'limited', new Date().toISOString());
    const h = await one<{ action: string; actor_name: string }>(db, 'select action, actor_name from public.stock_history where pharmacy_id = $1 order by id desc limit 1', [NOUR]);
    expect(h).toEqual({ action: 'update', actor_name: 'مالك صيدلية تجريبي' });
    const a = await one<{ action: string; actor_id: string; entity_id: string }>(db, 'select action, actor_id, entity_id from public.audit_log order by id desc limit 1');
    expect(a).toEqual({ action: 'stock.update', actor_id: OWNER, entity_id: `${NOUR}/${medicine_id}` });
  });

  it('notifies a patient waiting for the medicine in that governorate, once', async () => {
    const { medicine_id } = await nourRow();
    await update(medicine_id, 'unavailable', new Date().toISOString());
    await as(db, PATIENT, () => db.query(`insert into public.availability_alerts (user_id, medicine_id, governorate) values ($1, $2, 'khan_younis')`, [PATIENT, medicine_id]));
    await update(medicine_id, 'available', new Date().toISOString());
    await update(medicine_id, 'limited', new Date().toISOString());
    const mine = await as(db, PATIENT, () => rows<{ kind: string; link: string }>(db, 'select kind, link from public.notifications'));
    expect(mine).toEqual([{ kind: 'alert_met', link: `/medicine/${medicine_id}?gov=khan_younis` }]);
    const alert = await as(db, PATIENT, () => one<{ active: boolean }>(db, 'select active from public.availability_alerts'));
    expect(alert.active).toBe(false);
  });

  it('confirm_all renews every listed row and is logged once', async () => {
    const listed = await one<{ n: number }>(db, 'select count(*)::int as n from public.pharmacy_stock where pharmacy_id = $1 and is_listed', [NOUR]);
    const n = await as(db, OWNER, () => one<{ n: number }>(db, 'select public.confirm_all($1) as n', [NOUR]));
    expect(n.n).toBe(listed.n);
    const stale = await one<{ n: number }>(db, `select count(*)::int as n from public.pharmacy_stock where pharmacy_id = $1 and is_listed and reported_at < now() - interval '1 minute'`, [NOUR]);
    expect(stale.n).toBe(0);
    const logs = await rows<{ action: string }>(db, `select action from public.audit_log where action like 'stock.%'`);
    expect(logs).toEqual([{ action: 'stock.confirm_all' }]);
    const h = await one<{ item_count: number }>(db, `select item_count from public.stock_history where pharmacy_id = $1 and action = 'confirm_all' order by id desc limit 1`, [NOUR]);
    expect(h.item_count).toBe(listed.n);
  });
});

describe('admin', () => {
  beforeEach(reseed);

  it('approving a pending pharmacy makes it public (phase 3 acceptance)', async () => {
    await as(db, REVIEWER, () => db.query(`select public.review_org($1, 'approve', '')`, [BUSHRA]));
    const seen = await as(db, null, () => rows(db, 'select 1 from public.organizations where id = $1', [BUSHRA]));
    expect(seen).toHaveLength(1);
    const a = await one<{ action: string }>(db, `select action from public.audit_log where entity_id = $1 order by id limit 1`, [BUSHRA]);
    expect(a.action).toBe('verification.approve');
  });

  it('requires a note to reject or ask for more information', async () => {
    await as(db, REVIEWER, () => expect(db.query(`select public.review_org($1, 'reject', ' ')`, [BUSHRA])).rejects.toThrow(/note_required/));
  });

  it('never sends a cell under 5 in unmet_demand()', async () => {
    const r = await as(db, REVIEWER, () =>
      one<{ r: { matrix: { cells: (number | null)[][]; rowTotals: (number | null)[] }; unmatched: { count: number }[] } }>(db,
        `select public.unmet_demand(now() - interval '30 days', now(), array['north_gaza','gaza','deir_al_balah','khan_younis','rafah'], 'all') as r`));
    const cells = r.r.matrix.cells.flat();
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.some((c) => c === null)).toBe(true);
    for (const c of cells) if (c !== null) expect(c === 0 || c >= 5).toBe(true);
    for (const u of r.r.unmatched) expect(u.count).toBeGreaterThanOrEqual(5);
  });

  it('lets reviewers read settings but only the system admin change them', async () => {
    await as(db, REVIEWER, () => denied(db.query(`select public.update_settings('{"freshHours":36}'::jsonb)`)));
    await as(db, ADMIN, () => db.query(`select public.update_settings('{"freshHours":36}'::jsonb)`));
    expect((await one<{ v: string }>(db, `select value #>> '{}' as v from public.settings where key = 'fresh_hours'`)).v).toBe('36');
    await as(db, ADMIN, () => expect(db.query(`select public.update_settings('{"freshHours":80}'::jsonb)`)).rejects.toThrow(/invalid_settings/));
  });

  it('demo_reset() restores the seeds on a demo project, and is refused elsewhere', async () => {
    await as(db, REVIEWER, () => db.query(`select public.suspend_org($1, 'test')`, [NOUR]));
    await as(db, null, () => db.query('select public.demo_reset()'));
    expect((await one<{ s: string }>(db, 'select verification_status as s from public.organizations where id = $1', [NOUR])).s).toBe('approved');
    await db.exec(`update public.settings set value = 'false' where key = 'demo_mode'`);
    await as(db, null, () => denied(db.query('select public.demo_reset()')));
    await db.exec(`update public.settings set value = 'true' where key = 'demo_mode'`);
  });
});
