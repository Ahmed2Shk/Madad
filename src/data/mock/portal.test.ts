import { beforeEach, describe, expect, it } from 'vitest';
import { mockRepos as r } from './repos';
import { store } from './store';
import { AccessError } from './access';

const PW = 'madad-demo-2026';
const asStaff = () => r.auth.signIn('staff@madad.test', PW); // staff at صيدلية الشفاء (Gaza), no price permission
const asOwner = () => r.auth.signIn('owner@madad.test', PW); // owner of صيدلية النور (Khan Younis)
const now = () => new Date().toISOString();

beforeEach(() => store.reset());

describe('sign-in (A-02)', () => {
  it('fails the same way for a wrong password and an unknown email', async () => {
    expect(await r.auth.signIn('owner@madad.test', 'wrong')).toBeNull();
    expect(await r.auth.signIn('nobody@madad.test', PW)).toBeNull();
  });

  it('returns memberships so the app can route to the right portal', async () => {
    const me = await asStaff();
    expect(me?.memberships).toEqual([expect.objectContaining({ orgId: 'ph-shifa', orgType: 'pharmacy', role: 'staff' })]);
  });

  it('accepts emails in any case', async () => {
    expect(await r.auth.signIn('  OWNER@madad.test ', PW)).not.toBeNull();
  });

  it('signs up a patient and rejects a taken email', async () => {
    const ok = await r.auth.signUp({ displayName: 'مريض جديد', email: 'new@madad.test', password: 'password1', phone: null });
    expect(ok.ok).toBe(true);
    expect(await r.auth.signUp({ displayName: 'x', email: 'NEW@madad.test', password: 'password1', phone: null })).toEqual({ ok: false, reason: 'email_taken' });
  });
});

describe('permissions (RLS in mock mode)', () => {
  it('rejects stock updates without a session', async () => {
    await expect(r.availability.updateStock('ph-shifa', [{ medicineId: 'ors', status: 'available', clientUpdatedAt: now() }])).rejects.toBeInstanceOf(AccessError);
  });

  it('a pharmacy cannot update another pharmacy', async () => {
    await asStaff();
    await expect(r.availability.updateStock('ph-nour', [{ medicineId: 'ors', status: 'available', clientUpdatedAt: now() }])).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('staff without the price permission cannot change prices', async () => {
    await asStaff();
    const before = store.get().stock.find((s) => s.pharmacyId === 'ph-shifa' && s.priceIls != null)!;
    await r.availability.updateStock('ph-shifa', [{ medicineId: before.medicineId, status: 'available', priceIls: 1, clientUpdatedAt: now() }]);
    const after = store.get().stock.find((s) => s.pharmacyId === 'ph-shifa' && s.medicineId === before.medicineId)!;
    expect(after.priceIls).toBe(before.priceIls);
    expect(after.reportedStatus).toBe('available');
  });

  it('internal quantity is returned only with the medicines permission', async () => {
    await asStaff();
    expect((await r.pharmacyPortal.stock('ph-shifa')).every((x) => x.quantity === null)).toBe(true);
    await asOwner();
    expect((await r.pharmacyPortal.stock('ph-nour')).some((x) => x.quantity !== null)).toBe(true);
  });

  it('only the owner can change the team', async () => {
    await asStaff();
    await expect(r.pharmacyPortal.invite('ph-shifa', 'x@madad.test', 'staff')).rejects.toBeInstanceOf(AccessError);
    await asOwner();
    await r.pharmacyPortal.invite('ph-nour', 'helper@madad.test', 'staff');
    expect((await r.pharmacyPortal.team('ph-nour')).map((m) => [m.email, m.status])).toContainEqual(['helper@madad.test', 'invited']);
  });
});

describe('pharmacy portal', () => {
  it('records every save in stock_history and the audit log', async () => {
    await asStaff();
    const historyBefore = store.get().stockHistory.length;
    await r.availability.updateStock('ph-shifa', [{ medicineId: 'levothyroxine-100', status: 'available', clientUpdatedAt: now() }]);
    expect(store.get().stockHistory.length).toBe(historyBefore + 1);
    expect(store.get().audit.at(-1)).toMatchObject({ action: 'stock.update', actorId: 'u-ph-staff', newValue: { status: 'available' } });
  });

  it('confirm_all shows as one history line with its count', async () => {
    await asOwner();
    const n = await r.availability.confirmAll('ph-nour');
    expect((await r.pharmacyPortal.history('ph-nour'))[0]).toMatchObject({ action: 'confirm_all', count: n, actorName: 'مالك صيدلية تجريبي' });
  });

  it('overview counts freshness and lists unmet demand nearby', async () => {
    await asOwner();
    const o = await r.pharmacyPortal.overview('ph-nour');
    expect(o.fresh + o.stale + o.expired).toBe(o.listed);
    expect(o.newInquiries).toBe(2);
    expect(o.searchesByDay).toHaveLength(7);
    expect(o.unmetNearby.length).toBeGreaterThan(0);
  });

  it('a reply notifies the patient', async () => {
    await asOwner();
    await r.pharmacyPortal.replyInquiry('ph-nour', 'inq-1001', 'متوفر، يمكنك المرور.');
    const n = store.get().notifications.find((x) => x.userId === 'u-p2');
    expect(n).toMatchObject({ kind: 'inquiry_reply', data: { orgId: 'ph-nour' } });
    expect(store.get().inquiries.find((q) => q.id === 'inq-1001')!.status).toBe('replied');
  });

  it('hiding a medicine removes it from public reads', async () => {
    await asOwner();
    await r.pharmacyPortal.setListed('ph-nour', 'insulin-aspart', false);
    const rows = await r.availability.pharmaciesFor('insulin-aspart', 'khan_younis');
    expect(rows.some((x) => x.pharmacyId === 'ph-nour')).toBe(false);
  });

  it('changing the name sends an approved pharmacy back to review and out of search', async () => {
    await asOwner();
    expect(await r.pharmacyPortal.updateProfile('ph-nour', { nameAr: 'صيدلية النور الجديدة' })).toEqual({ reReview: true });
    expect(await r.orgs.pharmacy('ph-nour')).toBeNull();
    expect(await r.orgs.pharmacy('ph-nour', { preview: true })).not.toBeNull();
  });

  it('changing hours only does not trigger review', async () => {
    await asOwner();
    expect(await r.pharmacyPortal.updateProfile('ph-nour', { hours: { sat: [['09:00', '17:00']] } })).toEqual({ reReview: false });
  });
});

describe('registration (A-05, A-06)', () => {
  const draft = {
    account: { contactName: 'مسؤول جديد', contactRole: 'صيدلي', email: 'newph@madad.test', phone: '059-000-0099', password: 'password1' },
    org: {
      type: 'pharmacy' as const,
      nameAr: 'صيدلية تجريبية جديدة',
      nameEn: '',
      licenseNo: 'DEMO-NEW-1',
      governorate: 'rafah',
      area: 'center',
      addressText: 'رفح، وسط المدينة',
      landmark: '',
      lat: null,
      lng: null,
      locationPrecision: 'area' as const,
      phone: '059-000-0099',
      whatsapp: '',
      hours: {},
    },
    documents: [{ docType: 'license', fileName: 'license.pdf', size: 1000, mime: 'application/pdf' }],
  };

  it('creates a pending pharmacy that stays out of public search', async () => {
    const res = await r.registration.submit(draft);
    expect(res.ok).toBe(true);
    const status = await r.registration.myStatus();
    expect(status).toMatchObject({ status: 'pending', nameAr: 'صيدلية تجريبية جديدة' });
    expect((await r.orgs.pharmacies('all')).some((p) => p.nameAr === 'صيدلية تجريبية جديدة')).toBe(false);
  });

  it('a needs_info application goes back to pending on resubmit', async () => {
    store.mutate((s) => {
      s.sessionUserId = null;
    });
    await r.registration.submit(draft);
    const { orgId } = (await r.registration.myStatus())!;
    store.mutate((s) => {
      s.orgs.find((o) => o.id === orgId)!.verificationStatus = 'needs_info';
    });
    await r.registration.resubmit(orgId, 'رفعت الصورة', []);
    expect((await r.registration.myStatus())!.status).toBe('pending');
  });
});
