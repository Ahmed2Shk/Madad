// Phase 5 on the real migrations: provider content waits for moderation, programmes are confirmed,
// visitors see approved content only, and AD-09 suspension and roles work. Every new RPC runs once.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createDb, one, rows, uuidOf, type Db } from './pglite';

const PATIENT = uuidOf('u-patient');
const ORG_OWNER = uuidOf('u-org-owner'); // owner of جمعية سند الطبية
const PH_OWNER = uuidOf('u-ph-owner'); // owner of صيدلية النور
const REVIEWER = uuidOf('u-reviewer');
const ADMIN = uuidOf('u-admin');
const SANAD = uuidOf('pr-sanad');
const NOUR = uuidOf('ph-nour');

let db: Db;
beforeAll(async () => {
  db = await createDb();
}, 120_000);
afterAll(async () => {
  await db?.close();
});
beforeEach(() => db.exec('select public.demo_seed()'));

const denied = (p: Promise<unknown>) => expect(p).rejects.toThrow(/permission denied|forbidden|row-level security/);
const program = {
  kind: 'program', name: 'برنامج اختبار', category: 'chronic', description: 'وصف', beneficiaries: 'الجميع', eligibility: ['شرط ١', ' '],
  requiredDocs: ['هوية'], howToApply: 'الحضور', programStatus: 'active', startsOn: '2026-11-01', endsOn: null,
};

describe('seeded provider content', () => {
  it('visitors see approved services and current announcements of approved providers only', async () => {
    const svc = await as(db, null, () => rows<{ name: string; review_status: string }>(db, 'select name, review_status from public.services where org_id = $1', [SANAD]));
    expect(svc.length).toBeGreaterThan(0);
    expect(svc.every((s) => s.review_status === 'approved')).toBe(true);
    expect(svc.map((s) => s.name)).not.toContain('جلسات توعية بالسكري');
    const ann = await as(db, null, () => rows<{ title: string }>(db, 'select title from public.announcements order by title'));
    expect(ann.map((a) => a.title).sort()).toEqual(['تسجيل جديد في برنامج الأمراض المزمنة', 'مدد: بيانات تجريبية'].sort());
  });

  it('members see their own pending and draft items', async () => {
    const all = await as(db, ORG_OWNER, () => rows<{ review_status: string }>(db, 'select review_status from public.announcements where org_id = $1', [SANAD]));
    expect(all.map((a) => a.review_status).sort()).toEqual(['approved', 'draft']);
  });
});

describe('provider portal RPC (PR-03, PR-04, PR-05)', () => {
  it('save_service creates a pending item with clean lists, one audit row, then the reviewer approves it', async () => {
    const r = await as(db, ORG_OWNER, () => one<{ id: string }>(db, 'select public.save_service($1, $2::jsonb) as id', [SANAD, JSON.stringify(program)]));
    const s = await one<{ review_status: string; eligibility: string[]; confirmed_at: Date | null; program_status: string }>(db,
      'select review_status, eligibility, confirmed_at, program_status from public.services where id = $1', [r.id]);
    expect(s).toMatchObject({ review_status: 'pending', eligibility: ['شرط ١'], program_status: 'active' });
    expect(s.confirmed_at).not.toBeNull();
    expect(await rows(db, `select 1 from public.audit_log where entity_id = $1 and action = 'service.add'`, [r.id])).toHaveLength(1);
    expect(await as(db, null, () => rows(db, 'select 1 from public.services where id = $1', [r.id]))).toHaveLength(0);

    await as(db, REVIEWER, () => db.query(`select public.moderate_content('service', $1, 'approve', '')`, [r.id]));
    expect(await as(db, null, () => rows(db, 'select 1 from public.services where id = $1', [r.id]))).toHaveLength(1);
    expect(await as(db, ORG_OWNER, () => rows(db, `select 1 from public.notifications where kind = 'content_review'`))).toHaveLength(1);
  });

  it('editing an approved service sends it back to review', async () => {
    const [s] = await rows<{ id: string; kind: string; name: string }>(db, `select id, kind, name from public.services where org_id = $1 and review_status = 'approved' limit 1`, [SANAD]);
    await as(db, ORG_OWNER, () => db.query('select public.save_service($1, $2::jsonb)', [SANAD, JSON.stringify({ id: s!.id, kind: s!.kind, name: s!.name + ' (محدّث)' })]));
    expect((await one<{ r: string }>(db, 'select review_status as r from public.services where id = $1', [s!.id])).r).toBe('pending');
  });

  it('set_program_status confirms the programme without a new review', async () => {
    const [s] = await rows<{ id: string }>(db, `select id from public.services where org_id = $1 and program_status = 'paused'`, [SANAD]);
    await as(db, ORG_OWNER, () => db.query(`select public.set_program_status($1, $2, 'active')`, [SANAD, s!.id]));
    const after = await one<{ program_status: string; review_status: string; fresh: boolean }>(db,
      `select program_status, review_status, confirmed_at > now() - interval '1 minute' as fresh from public.services where id = $1`, [s!.id]);
    expect(after).toEqual({ program_status: 'active', review_status: 'approved', fresh: true });
  });

  it('announcements: draft or submitted, 300 characters at most, reviewer rejects with a reason', async () => {
    const draft = await as(db, ORG_OWNER, () => one<{ id: string }>(db, `select public.save_announcement($1, '{"title":"عنوان","body":"نص"}'::jsonb, false) as id`, [SANAD]));
    expect((await one<{ r: string }>(db, 'select review_status as r from public.announcements where id = $1', [draft.id])).r).toBe('draft');
    await as(db, ORG_OWNER, () => db.query(`select public.save_announcement($1, $2::jsonb, true)`, [SANAD, JSON.stringify({ id: draft.id, title: 'عنوان', body: 'نص' })]));
    await as(db, ORG_OWNER, () => expect(db.query('select public.save_announcement($1, $2::jsonb, true)', [SANAD, JSON.stringify({ title: 'x', body: 'x'.repeat(301) })])).rejects.toThrow(/announcements_body_length/));
    await as(db, REVIEWER, () => expect(db.query(`select public.moderate_content('announcement', $1, 'reject', ' ')`, [draft.id])).rejects.toThrow(/note_required/));
    await as(db, REVIEWER, () => db.query(`select public.moderate_content('announcement', $1, 'reject', 'غير واضح')`, [draft.id]));
    expect(await one(db, 'select review_status, rejection_reason from public.announcements where id = $1', [draft.id])).toEqual({ review_status: 'rejected', rejection_reason: 'غير واضح' });
    await as(db, ORG_OWNER, () => db.query('select public.delete_announcement($1, $2)', [SANAD, draft.id]));
    expect(await rows(db, 'select 1 from public.announcements where id = $1', [draft.id])).toHaveLength(0);
  });

  it('a pharmacy and another organization cannot publish here; visitors cannot moderate', async () => {
    await as(db, PH_OWNER, async () => {
      await denied(db.query('select public.save_service($1, $2::jsonb)', [SANAD, JSON.stringify(program)]));
      await denied(db.query('select public.save_service($1, $2::jsonb)', [NOUR, JSON.stringify(program)])); // a pharmacy has no services
    });
    const [s] = await rows<{ id: string }>(db, 'select id from public.services where org_id = $1 limit 1', [SANAD]);
    await as(db, PH_OWNER, () => denied(db.query('select public.delete_service($1, $2)', [NOUR, s!.id])));
    expect(await rows(db, 'select 1 from public.services where id = $1', [s!.id])).toHaveLength(1);
    await as(db, PATIENT, () => denied(db.query(`select public.moderate_content('service', $1, 'approve', '')`, [s!.id])));
  });

  it('update_org_profile saves the website, extra locations and contact person', async () => {
    const patch = { website: 'https://sanad.example.org/new', locations: [{ name: 'فرع', area: 'east', hours: null }], contactPerson: 'منسق' };
    await as(db, ORG_OWNER, () => db.query('select public.update_org_profile($1, $2::jsonb)', [SANAD, JSON.stringify(patch)]));
    const o = await one<{ website: string; n: number; contact_person: string }>(db,
      'select o.website, jsonb_array_length(o.locations) as n, p.contact_person from public.organizations o join public.organization_private p on p.org_id = o.id where o.id = $1', [SANAD]);
    expect(o).toEqual({ website: 'https://sanad.example.org/new', n: 1, contact_person: 'منسق' });
  });
});

describe('inquiries and notifications (P-08 → PR-06, PH-09)', () => {
  it('an inquiry about a programme notifies the members who answer inquiries', async () => {
    const [s] = await rows<{ id: string }>(db, `select id from public.services where org_id = $1 and review_status = 'approved' limit 1`, [SANAD]);
    await as(db, PATIENT, () => db.query(`select public.send_inquiry($1, null, 'سؤال', 'كيف أسجل؟', $2)`, [SANAD, s!.id]));
    expect((await one<{ service_id: string }>(db, 'select service_id from public.inquiries where org_id = $1 order by created_at desc limit 1', [SANAD])).service_id).toBe(s!.id);
    const n = await as(db, ORG_OWNER, () => rows<{ link: string }>(db, `select link from public.notifications where kind = 'inquiry_new'`));
    expect(n).toEqual([{ link: '/provider/inquiries' }]);
  });

  it('approving a requested medicine tells the pharmacy', async () => {
    const [m] = await rows<{ id: string }>(db, `select id from public.medicines where status = 'pending' and requested_by_org = $1`, [NOUR]);
    await as(db, REVIEWER, () => db.query(`select public.review_medicine($1, 'approve')`, [m!.id]));
    expect(await as(db, PH_OWNER, () => rows(db, `select 1 from public.notifications where kind = 'medicine_approved'`))).toHaveLength(1);
  });

  it('members save their notification preferences, and only those', async () => {
    await as(db, PH_OWNER, () => db.query(`update public.profiles set prefs = '{"reminderHour":9}' where id = $1`, [PH_OWNER]));
    expect((await one<{ h: string }>(db, `select prefs ->> 'reminderHour' as h from public.profiles where id = $1`, [PH_OWNER])).h).toBe('9');
    await as(db, PH_OWNER, () => denied(db.query('update public.profiles set suspended_at = now() where id = $1', [PH_OWNER])));
  });
});

describe('AD-09 users', () => {
  it('only the system admin lists users, suspends and assigns roles; a suspended account cannot act', async () => {
    await as(db, REVIEWER, () => denied(db.query('select public.admin_users()')));
    const list = await as(db, ADMIN, () => one<{ u: { email: string; type: string }[] }>(db, 'select public.admin_users() as u'));
    expect(list.u.find((x) => x.email === 'org@madad.test')?.type).toBe('organization');
    await as(db, ADMIN, () => denied(db.query('select public.set_user_suspended($1, true)', [ADMIN])));

    await as(db, ADMIN, () => db.query('select public.set_user_suspended($1, true)', [PH_OWNER]));
    await as(db, PH_OWNER, () => denied(db.query('select public.confirm_all($1)', [NOUR])));
    await as(db, ADMIN, () => db.query('select public.set_user_suspended($1, false)', [PH_OWNER]));
    await as(db, PH_OWNER, () => db.query('select public.confirm_all($1)', [NOUR]));

    await as(db, ADMIN, () => db.query(`select public.set_platform_role($1, 'reviewer')`, [PATIENT]));
    await as(db, PATIENT, () => db.query('select public.admin_overview()'));
    const audit = await rows<{ action: string }>(db, `select action from public.audit_log where action like 'user.%' order by id`);
    expect(audit.map((a) => a.action)).toEqual(['user.suspend', 'user.reactivate', 'user.platform_role']);
  });
});

describe('0011 fixes', () => {
  it('a suspended account loses table access through RLS too, not only through the RPCs', async () => {
    const privRead = (uid: string) => as(db, uid, () => rows(db, 'select 1 from public.organization_private where org_id = $1', [NOUR]));
    const stockRead = () => as(db, PH_OWNER, () => rows(db, 'select 1 from public.stock_private where pharmacy_id = $1', [NOUR]));
    expect(await privRead(PH_OWNER)).toHaveLength(1);
    expect((await stockRead()).length).toBeGreaterThan(0);
    expect(await privRead(REVIEWER)).toHaveLength(1);

    const suspend = (uid: string, on: boolean) => as(db, ADMIN, () => db.query('select public.set_user_suspended($1, $2)', [uid, on]));
    try {
      await suspend(PH_OWNER, true);
      await suspend(REVIEWER, true);
      expect(await privRead(PH_OWNER)).toHaveLength(0);
      expect(await stockRead()).toHaveLength(0);
      expect(await privRead(REVIEWER)).toHaveLength(0);
    } finally {
      await suspend(PH_OWNER, false);
      await suspend(REVIEWER, false);
    }
    expect(await privRead(PH_OWNER)).toHaveLength(1);
  });

  it('a reply from a medical provider links the patient to its /org page', async () => {
    await as(db, PATIENT, () => db.query(`select public.send_inquiry($1, null, 'سؤال', 'متى تفتحون؟', null)`, [SANAD]));
    const q = await one<{ id: string }>(db, 'select id from public.inquiries where org_id = $1 order by created_at desc limit 1', [SANAD]);
    await as(db, ORG_OWNER, () => db.query(`select public.reply_inquiry($1, $2, 'من 8 صباحًا')`, [SANAD, q.id]));
    const n = await as(db, PATIENT, () => one<{ link: string }>(db, `select link from public.notifications where kind = 'inquiry_reply' order by created_at desc limit 1`));
    expect(n.link).toBe(`/org/${SANAD}`);
  });

  it('AD-01 counts the content AD-08 lists', async () => {
    const o = await as(db, REVIEWER, () => one<{ n: number }>(db, `select (public.admin_overview() -> 'pending' ->> 'announcements')::int as n`));
    const listed = await one<{ n: number }>(db, `select ((select count(*) from public.services where review_status = 'pending')
      + (select count(*) from public.announcements where review_status = 'pending' and org_id is not null))::int as n`);
    expect(listed.n).toBeGreaterThan(0);
    expect(o.n).toBe(listed.n);
  });
});
