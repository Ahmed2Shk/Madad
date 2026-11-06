// Phase 5 in mock mode: the directory shows approved content only, edits wait for AD-08, programmes
// need confirming, and AD-09 suspension stops an account from acting.
import { beforeEach, describe, expect, it } from 'vitest';
import { programDisplayOf } from '../../lib/programs';
import { mockRepos as r } from './repos';
import { store } from './store';

const PW = 'madad-demo-2026';
const asOrg = () => r.auth.signIn('org@madad.test', PW); // owner of جمعية سند الطبية (humanitarian)
const asReviewer = () => r.auth.signIn('reviewer@madad.test', PW);
const asAdmin = () => r.auth.signIn('admin@madad.test', PW);
const asPatient = () => r.auth.signIn('patient@madad.test', PW);
const SANAD = 'pr-sanad';

beforeEach(() => store.reset());

const program = {
  kind: 'program' as const,
  name: 'برنامج جديد',
  category: 'chronic' as const,
  description: 'وصف',
  place: null,
  phone: null,
  operating: true,
  beneficiaries: 'الجميع',
  requiredDocs: ['هوية'],
  contact: null,
  hours: null,
  location: null,
  eligibility: ['شرط'],
  howToApply: 'الحضور',
  startsOn: null,
  endsOn: null,
  programStatus: 'active' as const,
};

describe('directory (P-07, P-08)', () => {
  it('lists approved providers by type, with up to three published services', async () => {
    const hospitals = await r.directory.providers({ type: 'hospital' });
    expect(hospitals.map((h) => h.id).sort()).toEqual(['pr-karma', 'pr-nakheel']);
    for (const h of hospitals) expect(h.topServices.length).toBeLessThanOrEqual(3);
    expect((await r.directory.providers({ gov: 'khan_younis' })).map((p) => p.id).sort()).toEqual(['pr-nakheel', 'pr-sanad']);
  });

  it('shows approved services and current announcements only', async () => {
    const sanad = (await r.directory.provider(SANAD))!;
    expect(sanad.services.every((s) => s.reviewStatus === 'approved')).toBe(true);
    expect(sanad.services.map((s) => s.name)).not.toContain('جلسات توعية بالسكري');
    expect(sanad.announcements.map((a) => a.id)).toEqual(['ann-1']);
  });

  it('never lists pharmacies, and the seeded weekly clinic shows «يحتاج تحديث»', async () => {
    expect(await r.directory.provider('ph-nour')).toBeNull();
    const mobile = (await r.directory.provider('pr-mobile-care'))!;
    const weekly = mobile.services.find((s) => s.name === 'عيادة متنقلة أسبوعية')!;
    expect(programDisplayOf(weekly.programStatus!, new Date(weekly.confirmedAt!), new Date())).toBe('needs_update');
  });
});

describe('provider portal (PR-03, PR-04, PR-05)', () => {
  it('a new programme waits for review, then appears once approved (AD-08)', async () => {
    await asOrg();
    const id = await r.providerPortal.saveService(SANAD, program);
    expect((await r.directory.provider(SANAD))!.services.map((s) => s.id)).not.toContain(id);
    expect((await r.directory.provider(SANAD, { preview: true }))!.services.map((s) => s.id)).toContain(id);

    await asReviewer();
    const queue = await r.admin.moderationQueue();
    expect(queue.map((q) => q.id)).toContain(id);
    await r.admin.moderate('service', id, 'approve', '');
    expect((await r.directory.provider(SANAD))!.services.map((s) => s.id)).toContain(id);
  });

  it('a rejection needs a reason and tells the organization', async () => {
    await asReviewer();
    // The pending programme of جمعية سند, whose owner is a demo account.
    const pending = store.get().services.find((x) => x.orgId === SANAD && x.reviewStatus === 'pending')!;
    await expect(r.admin.moderate('service', pending.id, 'reject', ' ')).rejects.toThrow('note_required');
    await r.admin.moderate('service', pending.id, 'reject', 'التاريخ غير واضح');
    const after = store.get().services.find((x) => x.id === pending.id)!;
    expect([after.reviewStatus, after.rejectionReason]).toEqual(['rejected', 'التاريخ غير واضح']);
    expect(store.get().notifications.some((n) => n.kind === 'content_review' && n.data.reason === 'التاريخ غير واضح')).toBe(true);
  });

  it('setting a programme status confirms it, so it is active again', async () => {
    await r.auth.signIn('org@madad.test', PW);
    const s = store.get().services.find((x) => x.orgId === SANAD && x.programStatus === 'paused')!;
    await r.providerPortal.setProgramStatus(SANAD, s.id, 'active');
    const after = store.get().services.find((x) => x.id === s.id)!;
    expect(programDisplayOf(after.programStatus!, new Date(after.confirmedAt!), new Date())).toBe('active');
  });

  it('announcements: a draft stays private, the body is limited to 300 characters', async () => {
    await asOrg();
    const id = await r.providerPortal.saveAnnouncement(SANAD, { title: 'عنوان', body: 'نص', startsAt: new Date().toISOString(), endsAt: null }, false);
    expect(store.get().announcements.find((a) => a.id === id)!.reviewStatus).toBe('draft');
    await expect(r.providerPortal.saveAnnouncement(SANAD, { title: 'عنوان', body: 'x'.repeat(301), startsAt: new Date().toISOString(), endsAt: null }, true)).rejects.toThrow();
  });

  it("another organization's member cannot edit these services", async () => {
    await r.auth.signIn('owner@madad.test', PW); // a pharmacy owner
    await expect(r.providerPortal.saveService(SANAD, program)).rejects.toThrow('forbidden');
    await expect(r.providerPortal.services(SANAD)).rejects.toThrow('forbidden');
  });
});

describe('inquiries and notifications (P-08 → PR-06, PH-09)', () => {
  it('an inquiry about a programme reaches the organization as a notification', async () => {
    await asPatient();
    const s = store.get().services.find((x) => x.orgId === SANAD && x.reviewStatus === 'approved')!;
    await r.account.sendInquiry({ orgId: SANAD, medicineId: null, serviceId: s.id, subject: 'سؤال', body: 'كيف أسجل؟' });
    await asOrg();
    expect((await r.pharmacyPortal.inquiries(SANAD))[0]).toMatchObject({ serviceId: s.id, subject: 'سؤال' });
    expect((await r.account.notifications()).some((n) => n.kind === 'inquiry_new')).toBe(true);
  });
});

describe('AD-09 users and PH-10 settings', () => {
  it('only the system admin lists users; a suspended account cannot act', async () => {
    await asReviewer();
    await expect(r.admin.users()).rejects.toThrow('forbidden');
    await asAdmin();
    const users = await r.admin.users();
    expect(users.find((u) => u.email === 'org@madad.test')?.type).toBe('organization');
    await r.admin.setUserSuspended('u-patient', true);
    await expect(r.admin.setUserSuspended('u-admin', true)).rejects.toThrow('forbidden');
    await asPatient();
    await expect(r.account.toggleFavorite('medicine', 'paracetamol-500')).rejects.toThrow('forbidden');
  });

  it('the system admin assigns MADAD team roles', async () => {
    await asAdmin();
    await r.admin.setPlatformRole('u-patient', 'reviewer');
    expect((await asPatient())?.platformRole).toBe('reviewer');
  });

  it('saves notification preferences and a new password', async () => {
    await asOrg();
    expect((await r.account.updatePrefs({ reminderHour: 9, platform: false })).reminderHour).toBe(9);
    await r.account.changePassword('a-new-password');
    expect(await r.auth.signIn('org@madad.test', PW)).toBeNull();
    expect(await r.auth.signIn('org@madad.test', 'a-new-password')).not.toBeNull();
  });
});

describe('fixes after the phase 6 review', () => {
  it('a reply from a medical provider links the patient to its /org page', async () => {
    await asPatient();
    await r.account.sendInquiry({ orgId: SANAD, medicineId: null, serviceId: null, subject: 'سؤال', body: 'متى تفتحون؟' });
    await asOrg();
    const [q] = await r.pharmacyPortal.inquiries(SANAD);
    await r.pharmacyPortal.replyInquiry(SANAD, q!.id, 'من 8 صباحًا');
    await asPatient();
    const n = (await r.account.notifications()).find((x) => x.kind === 'inquiry_reply');
    expect(n?.link).toBe(`/org/${SANAD}`);
  });

  it('AD-01 counts the content AD-08 lists', async () => {
    await asReviewer();
    const [o, queue] = await Promise.all([r.admin.overview(), r.admin.moderationQueue()]);
    expect(queue.length).toBeGreaterThan(0);
    expect(o.pending.announcements).toBe(queue.length);
  });
});
