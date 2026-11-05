import { beforeEach, describe, expect, it } from 'vitest';
import { mockRepos as r } from './repos';
import { store } from './store';
import { AccessError } from './access';
import { viewRow } from '../../lib/availability';

const PW = 'madad-demo-2026';
const asReviewer = () => r.auth.signIn('reviewer@madad.test', PW);
const asAdmin = () => r.auth.signIn('admin@madad.test', PW);

beforeEach(() => store.reset());

describe('access', () => {
  it('patients and pharmacies cannot read admin data', async () => {
    await r.auth.signIn('patient@madad.test', PW);
    await expect(r.admin.overview()).rejects.toBeInstanceOf(AccessError);
    await r.auth.signIn('owner@madad.test', PW);
    await expect(r.admin.unmetDemand(30, 'all', 'gaza')).rejects.toBeInstanceOf(AccessError);
  });

  it('reviewers review, only the system admin changes settings and reads the audit log', async () => {
    await asReviewer();
    await expect(r.admin.verificationQueue()).resolves.toBeTruthy();
    await expect(r.admin.updateSettings({ freshHours: 12 })).rejects.toBeInstanceOf(AccessError);
    await expect(r.admin.audit()).rejects.toBeInstanceOf(AccessError);
  });
});

describe('verification (AD-02)', () => {
  it('approving a pending pharmacy makes it appear in search (phase 3 acceptance)', async () => {
    expect(await r.orgs.pharmacy('ph-bushra')).toBeNull();
    await asReviewer();
    await r.admin.reviewOrg('ph-bushra', 'approve', '');
    expect(await r.orgs.pharmacy('ph-bushra')).not.toBeNull();
    const hits = await r.availability.searchMedicines('باراسيتامول', 'gaza');
    expect(hits.some((h) => h.reports.some((x) => x.pharmacyId === 'ph-bushra'))).toBe(true);
  });

  it('needs a note to ask for more information or to reject', async () => {
    await asReviewer();
    await expect(r.admin.reviewOrg('ph-huda', 'reject', '  ')).rejects.toThrow('note_required');
    await r.admin.reviewOrg('ph-huda', 'needs_info', 'هوية المسؤول غير واضحة');
    expect(store.get().orgs.find((o) => o.id === 'ph-huda')).toMatchObject({ verificationStatus: 'needs_info', reviewerNote: 'هوية المسؤول غير واضحة' });
  });

  it('warns when a phone is already used by another organization', async () => {
    await asReviewer();
    const bushra = (await r.admin.verificationQueue()).find((v) => v.orgId === 'ph-bushra')!;
    expect(bushra.warnings).toContainEqual(expect.objectContaining({ field: 'phone', otherOrgId: 'ph-zaytoon' }));
  });

  it('writes the decision to the audit log', async () => {
    await asReviewer();
    await r.admin.reviewOrg('ph-bushra', 'approve', '');
    expect(store.get().audit.at(-1)).toMatchObject({ action: 'verification.approve', actorId: 'u-reviewer', entityId: 'ph-bushra' });
  });
});

describe('suspension (AD-03)', () => {
  it('a suspended pharmacy disappears from search at once and keeps its data', async () => {
    await asReviewer();
    await r.admin.suspendOrg('ph-nour', 'بلاغات متكررة');
    expect(await r.orgs.pharmacy('ph-nour')).toBeNull();
    expect(store.get().stock.some((s) => s.pharmacyId === 'ph-nour')).toBe(true);
    await r.admin.reactivateOrg('ph-nour');
    expect(await r.orgs.pharmacy('ph-nour')).not.toBeNull();
  });
});

describe('catalog (AD-04)', () => {
  it('flags a near-duplicate request', async () => {
    await asReviewer();
    const req = (await r.admin.requests()).find((x) => x.id === 'req-2')!;
    expect(req.duplicates[0]?.medicineId).toBe('paracetamol-500');
  });

  it('approving a request adds it to the catalog; merging adds aliases', async () => {
    await asReviewer();
    await r.admin.reviewRequest('req-1', 'approve');
    expect((await r.admin.catalog()).medicines.some((m) => m.nameEn === 'Montelukast 10')).toBe(true);
    await r.admin.reviewRequest('req-2', 'merge', 'paracetamol-500');
    const para = (await r.admin.catalog()).medicines.find((m) => m.id === 'paracetamol-500')!;
    expect(para.aliases).toContain('Paracetamol 500mg');
  });
});

describe('settings (AD-11)', () => {
  it('changing fresh_hours changes what patients see', async () => {
    const row = store.get().stock.find((s) => {
      const h = (Date.now() - new Date(s.reportedAt).getTime()) / 36e5;
      return h > 24 && h < 30 && s.reportedStatus === 'available';
    })!;
    const before = await r.settings.get();
    expect(viewRow(row, new Date(), before).display).toBe('needs_update');
    await asAdmin();
    await r.admin.updateSettings({ freshHours: 36 });
    const after = await r.settings.get();
    expect(viewRow(row, new Date(), after).display).toBe('available');
  });

  it('rejects fresh_hours that are not below expire_hours', async () => {
    await asAdmin();
    await expect(r.admin.updateSettings({ freshHours: 72 })).rejects.toThrow('invalid_settings');
  });

  it('the public settings read leaves reviewer-only lists out', async () => {
    expect(Object.keys(await r.settings.get()).sort()).toEqual(['disclaimerAr', 'disclaimerEn', 'expireHours', 'freshHours', 'priceMaxDays', 'programConfirmDays', 'requiredDocs']);
  });
});

describe('data quality (AD-05)', () => {
  it('finds the same-day conflict and the box-ticking pharmacy', async () => {
    await asReviewer();
    const q = await r.admin.dataQuality();
    expect(q.conflicts).toContainEqual(expect.objectContaining({ pharmacyId: 'ph-nour', medicineId: 'paracetamol-500' }));
    expect(q.pharmacies.find((p) => p.pharmacyId === 'ph-salam')!.confirmAllRatio).toBeGreaterThan(0.8);
  });

  it('hiding a report removes it from the public view', async () => {
    await asReviewer();
    await r.admin.hideReport('ph-nour', 'insulin-aspart', 'بلاغ متضارب');
    const rows = await r.availability.pharmaciesFor('insulin-aspart', 'khan_younis');
    expect(rows.some((x) => x.pharmacyId === 'ph-nour')).toBe(false);
  });
});

describe('unmet demand (AD-06)', () => {
  it('never returns a cell under 5 nor a total that would reveal one', async () => {
    await asReviewer();
    const d = await r.admin.unmetDemand(30, 'all', 'gaza');
    expect(d.medicineIds.length).toBeGreaterThan(0);
    for (const row of d.matrix.cells) for (const c of row) expect(c === null || c === 0 || c >= 5).toBe(true);
    d.matrix.cells.forEach((row, i) => row.some((c) => c === null) && expect(d.matrix.rowTotals[i]).toBeNull());
    expect(d.unmatched.every((u) => u.count >= 5)).toBe(true);
  });

  it('includes failed searches made during the demo session', async () => {
    await asReviewer();
    const before = (await r.admin.unmetDemand(7, 'all', 'gaza')).failedTotal;
    await r.insights.logSearch({ query: 'ليفوثيروكسين 100', governorate: 'gaza', medicineId: 'levothyroxine-100', resultCount: 0 });
    expect((await r.admin.unmetDemand(7, 'all', 'gaza')).failedTotal).toBe(before + 1);
  });
});

describe('demo mode', () => {
  it('switches roles without a password and resets the data', async () => {
    const me = await r.demo.signInAs('u-reviewer');
    expect(me?.platformRole).toBe('reviewer');
    store.mutate((s) => {
      s.stock = [];
    });
    await r.demo.reset();
    expect(store.get().stock.length).toBe(400);
    expect(store.get().sessionUserId).toBeNull();
  });
});
