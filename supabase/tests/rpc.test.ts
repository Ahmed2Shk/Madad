// Every RPC run once on its happy path. PL/pgSQL only resolves names (e.g. a parameter that shares a
// column's name) when a function runs, so a function no test calls can still fail in production.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createDb, one, rows, uuidOf, type Db } from './pglite';

const PATIENT = uuidOf('u-patient');
const OWNER = uuidOf('u-ph-owner');
const REVIEWER = uuidOf('u-reviewer');
const ADMIN = uuidOf('u-admin');
const NOUR = uuidOf('ph-nour');
const BUSHRA = uuidOf('ph-bushra');
const SHIFA = uuidOf('ph-shifa');

let db: Db;
beforeAll(async () => {
  db = await createDb();
}, 120_000);
afterAll(async () => {
  await db?.close();
});

const call = (user: string | null, sql: string, params: unknown[] = []) => as(db, user, () => db.query(sql, params));

describe('public and patient RPC', () => {
  it('log_search, top_searched and view_pharmacy', async () => {
    await call(null, `select public.log_search('انسولين', 'gaza', 'insulin-aspart', 0)`);
    await call(null, `select public.log_search('', 'gaza', null, 0)`);
    const top = await as(db, null, () => rows<{ medicine_id: string; count: number }>(db, `select * from public.top_searched('all', 3)`));
    expect(top).toHaveLength(3);
    await call(null, 'select public.view_pharmacy($1)', [NOUR]);
    await call(null, 'select public.view_pharmacy($1)', [NOUR]);
    const v = await one<{ count: number }>(db, `select count from public.page_views where pharmacy_id = $1 and day = (now() at time zone 'utc')::date`, [NOUR]);
    expect(v.count).toBeGreaterThanOrEqual(2);
  });

  it('send_inquiry, favorites, alerts and delete_my_account (demo account keeps the user)', async () => {
    const id = await as(db, PATIENT, () => one<{ id: string }>(db, `select public.send_inquiry($1, 'insulin-aspart', 'سؤال', 'هل يتوفر؟') as id`, [NOUR]));
    const q = await one<{ patient_name: string }>(db, 'select patient_name from public.inquiries where id = $1', [id.id]);
    expect(q.patient_name).toBe('مريض تجريبي');
    await call(PATIENT, `insert into public.favorites (user_id, entity_type, entity_id) values ($1, 'medicine', 'insulin-aspart')`, [PATIENT]);
    await call(PATIENT, 'select public.delete_my_account()');
    expect(await rows(db, 'select 1 from public.favorites where user_id = $1', [PATIENT])).toHaveLength(0);
    expect(await rows(db, 'select 1 from auth.users where id = $1', [PATIENT])).toHaveLength(1);
  });
});

describe('sign-in with Google (0009)', () => {
  it('takes the profile name from Google metadata, which uses "name"', async () => {
    const uid = '22222222-3333-4444-8555-666666666666';
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'g.user@gmail.test', '{"name":"سلمى من Google","email_verified":true}')`, [uid]);
    expect((await one<{ full_name: string }>(db, 'select full_name from public.profiles where id = $1', [uid])).full_name).toBe('سلمى من Google');
  });
});

describe('pharmacy portal RPC', () => {
  it('stock_add, stock_set_listed, stock_remove and the history they write', async () => {
    const [free] = await rows<{ id: string }>(db,
      `select id from public.medicines m where status = 'approved' and not exists (select 1 from public.pharmacy_stock s where s.pharmacy_id = $1 and s.medicine_id = m.id) limit 1`, [NOUR]);
    await call(OWNER, `select public.stock_add($1, $2, 'available')`, [NOUR, free!.id]);
    await call(OWNER, 'select public.stock_set_listed($1, $2, false)', [NOUR, free!.id]);
    await call(OWNER, 'select public.stock_set_listed($1, $2, true)', [NOUR, free!.id]);
    await call(OWNER, `insert into public.stock_private (pharmacy_id, medicine_id, quantity, low_threshold) values ($1, $2, 7, 2)
      on conflict (pharmacy_id, medicine_id) do update set quantity = excluded.quantity`, [NOUR, free!.id]);
    await call(OWNER, 'select public.stock_remove($1, $2)', [NOUR, free!.id]);
    const h = await rows<{ action: string }>(db, 'select action from public.stock_history where pharmacy_id = $1 and medicine_id = $2 order by id', [NOUR, free!.id]);
    expect(h.map((x) => x.action)).toEqual(['add', 'hide', 'show', 'remove']);
    const a = await rows<{ action: string }>(db, `select action from public.audit_log where entity_id = $1 order by id`, [`${NOUR}/${free!.id}`]);
    expect(a.map((x) => x.action)).toEqual(['stock.add', 'stock.hide', 'stock.show', 'stock.remove']);
  });

  it('portal_overview', async () => {
    const o = await as(db, OWNER, () => one<{ o: { listed: number; searchesByDay: unknown[]; activity: unknown[]; viewsThisWeek: number } }>(db, 'select public.portal_overview($1) as o', [NOUR]));
    expect(o.o.listed).toBeGreaterThan(0);
    expect(o.o.searchesByDay).toHaveLength(7);
    expect(o.o.activity.length).toBeGreaterThan(0);
  });

  it('request_medicine, then the reviewer approves, merges or rejects (review_medicine)', async () => {
    const input = { nameAr: 'دواء تجريبي', nameEn: 'Test Drug 5', genericName: 'Test', strength: '5 ملغ', dosageForm: 'tablet', packSize: '10', manufacturer: null, barcode: null, categoryId: 'pain_fever' };
    const id = await as(db, OWNER, () => one<{ id: string }>(db, 'select public.request_medicine($1, $2::jsonb) as id', [NOUR, JSON.stringify(input)]));
    expect(id.id).toBe('test-drug-5');
    const second = await as(db, OWNER, () => one<{ id: string }>(db, 'select public.request_medicine($1, $2::jsonb) as id', [NOUR, JSON.stringify(input)]));
    expect(second.id).toBe('test-drug-5-2');
    await call(REVIEWER, `select public.review_medicine($1, 'approve')`, [id.id]);
    await call(REVIEWER, `select public.review_medicine($1, 'merge', 'paracetamol-500')`, [second.id]);
    const m = await rows<{ id: string; status: string }>(db, 'select id, status from public.medicines where id in ($1, $2) order by id', [id.id, second.id]);
    expect(m.map((x) => x.status)).toEqual(['approved', 'merged']);
    const p = await one<{ aliases: string[] }>(db, `select aliases from public.medicines where id = 'paracetamol-500'`);
    expect(p.aliases).toContain('Test Drug 5');
  });

  it('reply_inquiry and set_inquiry_status notify the patient', async () => {
    const [q] = await rows<{ id: string }>(db, 'select id from public.inquiries where org_id = $1 limit 1', [NOUR]);
    await call(OWNER, `select public.reply_inquiry($1, $2, 'نعم متوفر')`, [NOUR, q!.id]);
    await call(OWNER, `select public.set_inquiry_status($1, $2, 'closed')`, [NOUR, q!.id]);
    expect((await one<{ status: string }>(db, 'select status from public.inquiries where id = $1', [q!.id])).status).toBe('closed');
    expect(await rows(db, `select 1 from public.notifications where kind = 'inquiry_reply'`)).not.toHaveLength(0);
  });

  it('update_org_profile: a phone change stays approved, a name change goes back to review', async () => {
    const plain = await as(db, OWNER, () => one<{ r: boolean }>(db, `select public.update_org_profile($1, '{"phone":"059-111-1111","temporarilyClosed":{"reason":"جرد"}}'::jsonb) as r`, [NOUR]));
    expect(plain.r).toBe(false);
    const o = await one<{ phone: string; temporarily_closed: boolean; closed_reason: string }>(db, 'select phone, temporarily_closed, closed_reason from public.organizations where id = $1', [NOUR]);
    expect(o).toEqual({ phone: '059-111-1111', temporarily_closed: true, closed_reason: 'جرد' });
    const renamed = await as(db, OWNER, () => one<{ r: boolean }>(db, `select public.update_org_profile($1, '{"nameAr":"صيدلية النور الجديدة"}'::jsonb) as r`, [NOUR]));
    expect(renamed.r).toBe(true);
    expect((await one<{ s: string }>(db, 'select verification_status as s from public.organizations where id = $1', [NOUR])).s).toBe('pending');
    await call(REVIEWER, `select public.review_org($1, 'approve', '')`, [NOUR]);
  });

  it('org_team, invite_member, update_member and remove_member', async () => {
    await call(OWNER, `select public.invite_member($1, 'New@Madad.test', 'staff')`, [NOUR]);
    await call(OWNER, `select public.update_member($1, 'new@madad.test', 'manager', null)`, [NOUR]);
    const team = await as(db, OWNER, () => one<{ t: { key: string; role: string; status: string; perms: { prices: boolean } }[] }>(db, 'select public.org_team($1) as t', [NOUR]));
    const invited = team.t.find((m) => m.key === 'new@madad.test')!;
    expect(invited).toMatchObject({ role: 'manager', status: 'invited', perms: { prices: true } });
    expect(team.t.some((m) => m.key === OWNER && m.status === 'active')).toBe(true);
    await call(OWNER, `select public.remove_member($1, 'new@madad.test')`, [NOUR]);
    await as(db, OWNER, () => expect(db.query('select public.remove_member($1, $2)', [NOUR, OWNER])).rejects.toThrow(/forbidden/));
    await as(db, OWNER, () => expect(db.query(`select public.update_member($1, $2, 'staff', null)`, [NOUR, OWNER])).rejects.toThrow(/forbidden/));
  });

  it('a new user signs up (profile by trigger), registers an organization, and resubmits it', async () => {
    const uid = '11111111-2222-4333-8444-555555555555';
    await db.query(`insert into public.org_invitations (org_id, email, member_role, perms) values ($1, 'new.owner@madad.test', 'viewer', public.default_perms('viewer'))`, [NOUR]);
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'new.owner@madad.test', '{"full_name":"صاحب جديد"}')`, [uid]);
    expect((await one<{ full_name: string }>(db, 'select full_name from public.profiles where id = $1', [uid])).full_name).toBe('صاحب جديد');
    expect(await rows(db, 'select 1 from public.org_members where org_id = $1 and user_id = $2', [NOUR, uid])).toHaveLength(1);

    const draft = {
      account: { contactName: 'صاحب جديد', contactRole: 'صيدلي', email: 'new.owner@madad.test', phone: '' },
      org: { type: 'pharmacy', nameAr: 'صيدلية جديدة', nameEn: 'New Pharmacy', licenseNo: 'L-1', governorate: 'gaza', area: 'center', addressText: 'غزة', landmark: '', lat: 31.5, lng: 34.46, locationPrecision: 'exact', phone: '059', whatsapp: '', hours: {} },
      documents: [{ docType: 'pharmacy_license', fileName: 'رخصة.pdf', size: 1000, mime: 'application/pdf', upload: true }, { docType: 'contact_id', fileName: 'id.png', size: 10, mime: 'image/png', upload: false }],
    };
    const out = await as(db, uid, () => one<{ r: { orgId: string; uploads: { fileName: string; path: string }[] } }>(db, 'select public.register_org($1::jsonb) as r', [JSON.stringify(draft)]));
    expect(out.r.uploads).toHaveLength(1);
    expect(out.r.uploads[0]!.path.startsWith(`${out.r.orgId}/`)).toBe(true);
    const org = await one<{ verification_status: string; public_lat: number | null }>(db, 'select verification_status, public_lat from public.organizations where id = $1', [out.r.orgId]);
    expect(org).toEqual({ verification_status: 'pending', public_lat: 31.5 });
    // Storage: the member may upload to the org's folder, not to an org they are not in (they joined NOUR by invitation).
    await call(uid, `insert into storage.objects (bucket_id, name) values ('org-docs', $1)`, [out.r.uploads[0]!.path]);
    await as(db, uid, () => expect(db.query(`insert into storage.objects (bucket_id, name) values ('org-docs', $1)`, [`${SHIFA}/x.pdf`])).rejects.toThrow(/row-level security/));

    await call(REVIEWER, `select public.review_org($1, 'needs_info', 'صورة أوضح')`, [out.r.orgId]);
    const re = await as(db, uid, () => one<{ r: { uploads: unknown[] } }>(db, `select public.resubmit_org($1, 'تم', '[{"docType":"additional","fileName":"b.pdf","size":5,"mime":"application/pdf","upload":true}]'::jsonb) as r`, [out.r.orgId]));
    expect(re.r.uploads).toHaveLength(1);
    expect((await one<{ s: string }>(db, 'select verification_status as s from public.organizations where id = $1', [out.r.orgId])).s).toBe('pending');
  });
});

describe('admin RPC', () => {
  it('admin_overview', async () => {
    const o = await as(db, REVIEWER, () => one<{ o: { verifiedPharmacies: number; daily: unknown[]; pending: { pharmacies: number } } }>(db, 'select public.admin_overview() as o'));
    expect(o.o.verifiedPharmacies).toBeGreaterThan(0);
    expect(o.o.daily).toHaveLength(30);
    expect(o.o.pending.pharmacies).toBeGreaterThan(0);
  });

  it('set_document_status, suspend_org and reactivate_org', async () => {
    const [d] = await rows<{ org_id: string; file_name: string }>(db, 'select org_id, file_name from public.org_documents limit 1');
    await call(REVIEWER, `select public.set_document_status($1, $2, 'rejected')`, [d!.org_id, d!.file_name]);
    expect((await one<{ status: string }>(db, 'select status from public.org_documents where org_id = $1 and file_name = $2', [d!.org_id, d!.file_name])).status).toBe('rejected');
    await call(REVIEWER, `select public.suspend_org($1, 'شكاوى متكررة')`, [BUSHRA]);
    await call(REVIEWER, 'select public.reactivate_org($1)', [BUSHRA]);
    const a = await rows<{ action: string }>(db, `select action from public.audit_log where entity_id = $1 order by id`, [BUSHRA]);
    expect(a.map((x) => x.action)).toEqual(['organization.suspend', 'organization.reactivate']);
  });

  it('add_medicine, set_aliases and import_catalog', async () => {
    const input = { nameAr: 'دواء جديد', nameEn: 'Brand New 10', genericName: 'New', strength: '10 ملغ', dosageForm: 'tablet', packSize: '20', manufacturer: null, barcode: null, categoryId: 'pain_fever', aliases: ['جديد'] };
    const id = await as(db, REVIEWER, () => one<{ id: string }>(db, 'select public.add_medicine($1::jsonb) as id', [JSON.stringify(input)]));
    await call(REVIEWER, `select public.set_aliases($1, array['اسم بديل', ' '])`, [id.id]);
    expect((await one<{ aliases: string[] }>(db, 'select aliases from public.medicines where id = $1', [id.id])).aliases).toEqual(['اسم بديل']);
    const n = await as(db, REVIEWER, () => one<{ n: number }>(db, 'select public.import_catalog($1::jsonb) as n', [JSON.stringify([{ ...input, nameEn: 'Imported 1' }, input])]));
    expect(n.n).toBe(1);
    const hit = await as(db, null, () => rows<{ medicine_id: string }>(db, `select medicine_id from public.search_medicines('اسم بديل')`));
    expect(hit.map((h) => h.medicine_id)).toEqual([id.id]);
  });

  it('remind_pharmacy and hide_report', async () => {
    await call(REVIEWER, 'select public.remind_pharmacy($1)', [NOUR]);
    expect(await as(db, OWNER, () => rows(db, `select 1 from public.notifications where kind = 'platform'`))).not.toHaveLength(0);
    const [s] = await rows<{ medicine_id: string }>(db, 'select medicine_id from public.pharmacy_stock where pharmacy_id = $1 and not hidden_by_admin limit 1', [NOUR]);
    await call(REVIEWER, `select public.hide_report($1, $2, 'بلاغات متكررة')`, [NOUR, s!.medicine_id]);
    expect(await as(db, null, () => rows(db, 'select 1 from public.public_availability where pharmacy_id = $1 and medicine_id = $2', [NOUR, s!.medicine_id]))).toHaveLength(0);
    const a = await one<{ action: string; new_value: { note: string } }>(db, `select action, new_value from public.audit_log where action = 'quality.hide_report' order by id desc limit 1`);
    expect(a.new_value.note).toBe('بلاغات متكررة');
  });

  it('reviewers handle reports; update_settings changes several keys', async () => {
    const [r] = await rows<{ id: string }>(db, 'select id from public.reports limit 1');
    await call(REVIEWER, `update public.reports set status = 'resolved', admin_note = 'تم' where id = $1`, [r!.id]);
    await as(db, REVIEWER, () => expect(db.query(`update public.reports set handled_by = $1 where id = $2`, [REVIEWER, r!.id])).rejects.toThrow(/permission denied/));
    await call(ADMIN, `select public.update_settings('{"priceMaxDays":10,"disclaimerAr":"نص","rejectionReasons":["سبب"]}'::jsonb)`);
    const s = await rows<{ key: string; v: string }>(db, `select key, value #>> '{}' as v from public.settings where key in ('price_max_days', 'disclaimer_ar') order by key`);
    expect(s).toEqual([{ key: 'disclaimer_ar', v: 'نص' }, { key: 'price_max_days', v: '10' }]);
    const audit = await as(db, ADMIN, () => rows(db, `select 1 from public.audit_log where action = 'settings.update'`));
    expect(audit.length).toBeGreaterThanOrEqual(3);
  });
});
