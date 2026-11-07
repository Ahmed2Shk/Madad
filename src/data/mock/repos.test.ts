import { beforeEach, describe, expect, it } from 'vitest';
import { mockRepos as r } from './repos';
import { store } from './store';
import { viewOf } from '../../lib/freshness';

const view = (row: { reportedStatus: 'available' | 'limited' | 'unavailable'; reportedAt: string; priceIls: number | null; priceUpdatedAt: string | null }) =>
  viewOf({ ...row, reportedAt: new Date(row.reportedAt), priceUpdatedAt: row.priceUpdatedAt ? new Date(row.priceUpdatedAt) : null }, new Date());

beforeEach(() => store.reset());

describe('public reads', () => {
  it('never returns unverified pharmacies', async () => {
    const list = await r.orgs.pharmacies('all');
    const ids = list.map((p) => p.id);
    expect(ids).not.toContain('ph-bushra'); // pending
    expect(ids).not.toContain('ph-huda'); // pending
    expect(ids).not.toContain('ph-wafa'); // needs_info
    expect(await r.orgs.pharmacy('ph-bushra')).toBeNull();
    expect(list).toHaveLength(12);
  });

  it('exposes no licence number, contact person or quantity', async () => {
    const p = await r.orgs.pharmacy('ph-nour');
    const rows = await r.availability.pharmaciesFor('insulin-aspart', 'khan_younis');
    const json = JSON.stringify([p, rows]);
    expect(json).not.toMatch(/license|licence|contact|quantity|reported_by|reportedBy/i);
  });

  it('publishes coordinates only for exact precision', async () => {
    expect((await r.orgs.pharmacy('ph-nour'))!.publicLat).not.toBeNull(); // exact
    const amal = (await r.orgs.pharmacy('ph-amal'))!; // area
    expect([amal.publicLat, amal.publicLng]).toEqual([null, null]);
    const fajr = (await r.orgs.pharmacy('ph-fajr'))!; // hidden
    expect(fajr.publicLat).toBeNull();
  });

  it('insulin NovoRapid in Khan Younis shows the four demo states', async () => {
    const rows = await r.availability.pharmaciesFor('insulin-aspart', 'khan_younis');
    const byPharmacy = Object.fromEntries(rows.map((x) => [x.pharmacyId, view(x).display]));
    expect(byPharmacy).toMatchObject({
      'ph-nour': 'available',
      'ph-rahma': 'limited',
      'ph-yasmeen': 'needs_update',
      'ph-amal': 'unconfirmed',
    });
    const amal = rows.find((x) => x.pharmacyId === 'ph-amal')!;
    expect(view(amal).priceIls).toBeNull();
  });

  it('levothyroxine 100 has nothing available in Gaza', async () => {
    const rows = await r.availability.pharmaciesFor('levothyroxine-100', 'gaza');
    expect(rows.every((x) => view(x).display === 'unavailable' || view(x).display === 'unconfirmed')).toBe(true);
  });

  it('search returns the same medicines for انسولين, إنسولين and insulin', async () => {
    const ids = async (q: string) => (await r.availability.searchMedicines(q, 'khan_younis')).map((h) => h.medicine.id).sort();
    const expected = ['insulin-aspart', 'insulin-glargine', 'insulin-mixtard', 'insulin-nph', 'insulin-regular'];
    expect(await ids('انسولين')).toEqual(expected);
    expect(await ids('إنسولين')).toEqual(expected);
    expect(await ids('insulin')).toEqual(expected);
  });

  it('Khan Younis has at least three pharmacies updated within the hour', async () => {
    expect((await r.availability.recentlyUpdated('khan_younis', 60, 3)).length).toBe(3);
  });
});

const PW = 'madad-demo-2026';
const asStaff = () => r.auth.signIn('staff@madad.test', PW); // صيدلية الشفاء, Gaza
const asOwner = () => r.auth.signIn('owner@madad.test', PW); // صيدلية النور, Khan Younis

describe('updateStock', () => {
  beforeEach(async () => {
    await asStaff();
  });

  it('uses the device time, never a future one', async () => {
    const before = Date.now();
    const tenMinAgo = new Date(before - 10 * 60_000).toISOString();
    await r.availability.updateStock('ph-shifa', [{ medicineId: 'levothyroxine-100', status: 'available', clientUpdatedAt: tenMinAgo }]);
    let row = (await r.availability.pharmaciesFor('levothyroxine-100', 'gaza')).find((x) => x.pharmacyId === 'ph-shifa')!;
    expect(row.reportedAt).toBe(tenMinAgo);

    const future = new Date(Date.now() + 3_600_000).toISOString();
    await r.availability.updateStock('ph-shifa', [{ medicineId: 'levothyroxine-100', status: 'limited', clientUpdatedAt: future }]);
    row = (await r.availability.pharmaciesFor('levothyroxine-100', 'gaza')).find((x) => x.pharmacyId === 'ph-shifa')!;
    expect(new Date(row.reportedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('ignores an offline change older than the current report', async () => {
    const old = new Date(Date.now() - 10 * 3_600_000).toISOString(); // older than the seeded 5h report
    await r.availability.updateStock('ph-shifa', [{ medicineId: 'levothyroxine-100', status: 'available', clientUpdatedAt: old }]);
    const row = (await r.availability.pharmaciesFor('levothyroxine-100', 'gaza')).find((x) => x.pharmacyId === 'ph-shifa')!;
    expect(row.reportedStatus).toBe('unavailable');
  });

  it('notifies people waiting for that medicine in that governorate', async () => {
    await r.account.signInDemoPatient();
    await r.account.createAlert('levothyroxine-100', 'gaza');
    await r.account.createAlert('levothyroxine-100', 'rafah');
    await asStaff();
    await r.availability.updateStock('ph-shifa', [{ medicineId: 'levothyroxine-100', status: 'available', clientUpdatedAt: new Date().toISOString() }]);
    await r.account.signInDemoPatient();
    const notes = await r.account.notifications();
    expect(notes).toHaveLength(1);
    expect(notes[0]!.data).toMatchObject({ pharmacyId: 'ph-shifa', medicineId: 'levothyroxine-100' });
    const alerts = await r.account.alerts();
    expect(alerts.find((a) => a.governorate === 'gaza')!.active).toBe(false);
    expect(alerts.find((a) => a.governorate === 'rafah')!.active).toBe(true);
  });

  it('confirm_all renews reports but not prices unless asked', async () => {
    await asOwner();
    const before = store.get().stock.find((s) => s.pharmacyId === 'ph-nour' && s.priceIls != null)!;
    const oldPriceAt = before.priceUpdatedAt;
    const n = await r.availability.confirmAll('ph-nour');
    expect(n).toBeGreaterThan(20);
    const after = store.get().stock.find((s) => s.pharmacyId === 'ph-nour' && s.medicineId === before.medicineId)!;
    expect(after.priceUpdatedAt).toBe(oldPriceAt);
    expect(store.get().stockHistory.at(-1)).toMatchObject({ action: 'confirm_all', count: n });
  });
});

describe('search log', () => {
  it('stores no user identity', async () => {
    await r.account.signInDemoPatient();
    await r.insights.logSearch({ query: 'إنسولين', governorate: 'khan_younis', medicineId: null, resultCount: 0 });
    const last = store.get().searchLogs.at(-1)!;
    expect(Object.keys(last).sort()).toEqual(['createdAt', 'governorate', 'medicineId', 'queryNorm', 'resultCount']);
    expect(last.queryNorm).toBe('انسولين');
  });
});
