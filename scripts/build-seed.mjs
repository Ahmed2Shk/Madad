// Builds supabase/seed.sql from the same JSON seeds mock mode uses (SPEC §13 «البذور والترحيل»),
// so both modes show the same demo data.
//   node scripts/build-seed.mjs
// Times stay relative (now() - interval '…'), so freshness states are varied on any day it runs.
// Text ids from the seeds become stable UUIDs: md5('madad:' || id)::uuid, the same in JS and SQL.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const seed = (name) => JSON.parse(readFileSync(new URL(`../src/data/mock/seed/${name}.json`, import.meta.url), 'utf8'));

const categories = seed('categories');
const medicines = seed('medicines');
const pharmacies = seed('pharmacies');
const providers = seed('providers');
const stock = seed('stock');
const stockPrivate = seed('stock_private');
const history = seed('stock_history');
const logs = seed('search_logs');
const views = seed('page_views');
const inquiries = seed('inquiries');
const requests = seed('medicine_requests');
const reports = seed('reports');
const users = seed('users');
const announcements = seed('announcements');

export const uuidOf = (id) => {
  const h = createHash('md5').update(`madad:${id}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const q = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v == null ? 'null' : String(Number(v)));
const bool = (v) => (v ? 'true' : 'false');
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;
const arr = (xs) => (xs?.length ? `array[${xs.map(q).join(', ')}]::text[]` : `'{}'::text[]`);
const ago = (minutes) => (minutes == null ? 'null' : `now() - interval '${Number(minutes)} minutes'`);
/** Days from today as a date (negative = in the past). */
const days = (n) => (n == null ? 'null' : `((now() at time zone 'utc')::date + ${Number(n)})`);
const id = (textId) => `'${uuidOf(textId)}'::uuid`;

const orgIds = new Set([...pharmacies, ...providers].map((o) => o.id));
/** Report targets like "ph-nour/paracetamol-500": org ids become their UUIDs. */
const remapEntity = (e) =>
  e
    .split('/')
    .map((part) => (orgIds.has(part) ? uuidOf(part) : part))
    .join('/');

const values = (rows) => rows.map((r) => `    (${r.join(', ')})`).join(',\n');
const insert = (table, cols, rows) => (rows.length ? `  insert into public.${table} (${cols.join(', ')}) values\n${values(rows)};\n` : '');

// Pharmacy requests become pending catalog rows (SPEC §13: medicines.status = pending, requested_by_org).
const taken = new Set(medicines.map((m) => m.id));
const slug = (name) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'medicine';
  let s = base;
  for (let i = 2; taken.has(s); i++) s = `${base}-${i}`;
  taken.add(s);
  return s;
};
const requestIds = new Map(requests.map((r) => [r.id, slug(r.name_en)]));

const demoUsers = users.map((u) => ({ ...u, uuid: uuidOf(u.id) }));
const DEMO_PASSWORD = users.find((u) => u.password)?.password;

const settingsDefaults = `  update public.settings set value = case key
    when 'fresh_hours' then '24'::jsonb
    when 'expire_hours' then '72'::jsonb
    when 'price_max_days' then '14'::jsonb
    when 'program_confirm_days' then '7'::jsonb
    when 'disclaimer_ar' then 'null'::jsonb
    when 'disclaimer_en' then 'null'::jsonb
    when 'required_docs' then '{"pharmacy":["practice_license","pharmacy_license","contact_id"],"hospital":["facility_license","contact_id"],"medical_point":["authorization_letter","contact_id"],"humanitarian":["registration_certificate","contact_id"]}'::jsonb
    when 'rejection_reasons' then '["وثائق غير واضحة أو ناقصة","الرخصة غير سارية","البيانات لا تطابق الوثائق","مؤسسة مكررة"]'::jsonb
    else value end
  where key <> 'demo_mode';
`;

const orgRow = (o, infoMinutes) => [
  id(o.id),
  q(o.type ?? 'pharmacy'),
  q(o.name_ar),
  q(o.name_en),
  q(o.governorate),
  q(o.area),
  q(o.address_text),
  q(o.landmark),
  q(o.location_precision),
  q(o.phone),
  q(o.whatsapp),
  json(o.hours),
  q(o.description),
  q(o.verification_status),
  ago(infoMinutes),
  bool(o.is_demo),
  q(o.website ?? null),
  json(o.locations ?? []),
];

const PROVIDER_INFO_MINUTES = 10 * 24 * 60;
const PROVIDER_APPROVED_MINUTES = 30 * 24 * 60;

const body = [
  "  perform set_config('madad.audit', 'off', true);",
  '  truncate public.organizations, public.medicines, public.categories, public.search_logs, public.page_views,',
  '    public.reports, public.audit_log, public.notifications, public.favorites, public.availability_alerts,',
  '    public.inquiries, public.announcements cascade;',
  settingsDefaults,
  ...demoUsers.map(
    (u) =>
      `  update public.profiles set full_name = ${q(u.display_name)}, phone = ${q(u.phone)}, platform_role = ${q(u.platform_role)}, is_demo = true where id = ${id(u.id)};`,
  ),
  insert(
    'categories',
    ['id', 'name_ar', 'name_en', 'sort_order'],
    categories.map((c, i) => [q(c.id), q(c.name_ar), q(c.name_en), num(i)]),
  ),
  insert(
    'medicines',
    ['id', 'name_ar', 'name_en', 'generic_name', 'strength', 'strength_en', 'dosage_form', 'pack_size', 'pack_size_en', 'manufacturer', 'barcode', 'aliases', 'category_id', 'prescription', 'status', 'is_demo'],
    medicines.map((m) => [
      q(m.id), q(m.name_ar), q(m.name_en), q(m.generic_name), q(m.strength), q(m.strength_en), q(m.dosage_form), q(m.pack_size), q(m.pack_size_en),
      q(m.manufacturer), q(m.barcode), arr(m.aliases), q(m.category_id), q(m.prescription ?? 'unspecified'), q(m.status ?? 'approved'), bool(m.is_demo ?? true),
    ]),
  ),
  insert(
    'organizations',
    ['id', 'type', 'name_ar', 'name_en', 'governorate', 'area', 'address_text', 'landmark', 'location_precision', 'phone', 'whatsapp', 'hours', 'description', 'verification_status', 'info_updated_at', 'is_demo', 'website', 'locations'],
    [...pharmacies.map((p) => orgRow(p, p.info_updated_minutes_ago)), ...providers.map((p) => orgRow(p, PROVIDER_INFO_MINUTES))],
  ),
  insert(
    'organization_private',
    ['org_id', 'license_no', 'exact_lat', 'exact_lng', 'contact_person', 'reviewer_notes'],
    [...pharmacies, ...providers].map((o) => [
      id(o.id), q(o.private.license_no), num(o.private.exact_lat), num(o.private.exact_lng), q(o.private.contact_person),
      q(o.verification_status === 'needs_info' ? 'صورة ترخيص الصيدلية غير واضحة، يُرجى رفعها مجددًا.' : null),
    ]),
  ),
  insert(
    'verification_events',
    ['org_id', 'action', 'created_at'],
    [
      ...pharmacies.map((p) => [id(p.id), q('submitted'), ago(p.info_updated_minutes_ago)]),
      ...providers.map((p) => [id(p.id), q('approved'), ago(PROVIDER_APPROVED_MINUTES)]),
    ],
  ),
  insert(
    'org_documents',
    ['org_id', 'doc_type', 'file_name', 'size_bytes', 'mime', 'status'],
    pharmacies.flatMap((p) => (p.documents ?? []).map((d) => [id(p.id), q(d.doc_type), q(d.file_name), num(d.size), q(d.mime), q(d.status)])),
  ),
  insert(
    'org_members',
    ['org_id', 'user_id', 'member_role', 'perms'],
    demoUsers.flatMap((u) => u.memberships.map((m) => [id(m.org_id), id(u.id), q(m.member_role), json(m.perms)])),
  ),
  insert(
    'pharmacy_stock',
    ['pharmacy_id', 'medicine_id', 'reported_status', 'reported_at', 'price_ils', 'price_updated_at', 'is_listed', 'hidden_by_admin'],
    stock.map((s) => [
      id(s.pharmacy_id), q(s.medicine_id), q(s.reported_status), ago(s.reported_minutes_ago), num(s.price_ils), ago(s.price_minutes_ago), bool(s.is_listed), bool(s.hidden_by_admin),
    ]),
  ),
  insert(
    'stock_private',
    ['pharmacy_id', 'medicine_id', 'quantity', 'low_threshold'],
    stockPrivate.map((s) => [id(s.pharmacy_id), q(s.medicine_id), num(s.quantity), num(s.low_threshold)]),
  ),
  insert(
    'stock_history',
    ['pharmacy_id', 'medicine_id', 'action', 'old_status', 'new_status', 'old_price', 'new_price', 'item_count', 'actor_id', 'created_at'],
    history.map((h) => [
      id(h.pharmacy_id), q(h.medicine_id), q(h.action), q(h.old_status), q(h.new_status), num(h.old_price), num(h.new_price), num(h.count),
      h.actor_id ? id(h.actor_id) : 'null', ago(h.minutes_ago),
    ]),
  ),
  insert(
    'services',
    ['id', 'org_id', 'kind', 'name', 'category', 'description', 'place', 'phone', 'operating', 'beneficiaries', 'eligibility', 'required_docs', 'contact', 'hours', 'location',
      'how_to_apply', 'starts_on', 'ends_on', 'program_status', 'confirmed_at', 'review_status', 'rejection_reason', 'updated_at', 'is_demo'],
    providers.flatMap((p) =>
      (p.services ?? []).map((s) => [
        id(s.id), id(p.id), q(s.kind), q(s.name), q(s.category), q(s.description), q(s.place), q(s.phone), bool(s.operating ?? true), q(s.beneficiaries),
        arr(s.eligibility), arr(s.required_docs), q(s.contact), s.hours ? json(s.hours) : 'null', q(s.location), q(s.how_to_apply),
        days(s.starts_days), days(s.ends_days), q(s.program_status), ago(s.confirmed_minutes_ago), q(s.review_status), q(s.rejection_reason),
        ago(s.updated_minutes_ago ?? s.confirmed_minutes_ago ?? 14400), 'true',
      ]),
    ),
  ),
  insert(
    'announcements',
    ['id', 'org_id', 'title', 'body', 'starts_at', 'ends_at', 'review_status', 'rejection_reason', 'is_demo', 'created_at'],
    announcements.map((a) => [
      id(a.id), a.org_id ? id(a.org_id) : 'null', q(a.title), q(a.body), ago(a.starts_minutes_ago),
      a.ends_days == null ? 'null' : `now() + interval '${Number(a.ends_days)} days'`, q(a.review_status), q(a.rejection_reason), 'true', ago(a.created_minutes_ago),
    ]),
  ),
  insert(
    'medicines',
    ['id', 'name_ar', 'name_en', 'generic_name', 'strength', 'dosage_form', 'pack_size', 'manufacturer', 'barcode', 'category_id', 'status', 'requested_by_org', 'is_demo', 'created_at'],
    requests.map((r) => [
      q(requestIds.get(r.id)), q(r.name_ar), q(r.name_en), q(r.generic_name), q(r.strength), q(r.dosage_form), q(r.pack_size), q(r.manufacturer), q(r.barcode),
      q(r.category_id), q(r.status), id(r.org_id), 'true', ago(r.minutes_ago),
    ]),
  ),
  insert(
    'search_logs',
    ['query_norm', 'medicine_id', 'governorate', 'result_count', 'is_demo', 'created_at'],
    logs.map((l) => [q(l.query_norm), q(l.medicine_id), q(l.governorate), num(l.result_count), 'true', ago(l.minutes_ago)]),
  ),
  insert(
    'page_views',
    ['pharmacy_id', 'day', 'count'],
    views.map((v) => [id(v.pharmacy_id), `(now() at time zone 'utc')::date - ${Number(v.days_ago)}`, num(v.count)]),
  ),
  insert(
    'inquiries',
    ['id', 'org_id', 'patient_id', 'medicine_id', 'subject', 'status', 'created_at', 'updated_at'],
    inquiries.map((i) => [
      id(i.id), id(i.org_id), id(i.patient_id), q(i.medicine_id), q(i.subject), q(i.status), ago(i.messages[0].minutes_ago), ago(i.messages.at(-1).minutes_ago),
    ]),
  ),
  insert(
    'inquiry_messages',
    ['inquiry_id', 'sender_id', 'sender_side', 'body', 'created_at'],
    inquiries.flatMap((i) => i.messages.map((m) => [id(i.id), m.sender === 'patient' ? id(i.patient_id) : 'null', q(m.sender), q(m.body), ago(m.minutes_ago)])),
  ),
  insert(
    'reports',
    ['id', 'entity_type', 'entity_id', 'reason', 'details', 'governorate', 'status', 'is_demo', 'created_at'],
    reports.map((r) => [id(r.id), q(r.entity_type), q(remapEntity(r.entity_id)), q(r.reason), q(r.details), q(r.governorate), q(r.status), 'true', ago(r.minutes_ago)]),
  ),
  "  perform set_config('madad.audit', '', true);",
].join('\n');

const authUsers = demoUsers
  .map((u) => {
    // Accounts without a seed password (other patients in the inquiries) get one nobody knows.
    const pw = u.password ? q(u.password) : 'gen_random_uuid()::text';
    const meta = json({ full_name: u.display_name });
    return `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
values ('00000000-0000-0000-0000-000000000000', ${id(u.id)}, 'authenticated', 'authenticated', ${q(u.email)}, extensions.crypt(${pw}, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, ${meta}, now(), now(), '', '', '', '')
on conflict (id) do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (${id(u.id)}, ${id(u.id)}, '${u.uuid}', jsonb_build_object('sub', '${u.uuid}', 'email', ${q(u.email)}, 'email_verified', true), 'email', now(), now(), now())
on conflict do nothing;`;
  })
  .join('\n');

const sql = `-- GENERATED by scripts/build-seed.mjs from src/data/mock/seed/*.json. Do not edit by hand.
-- Demo data only (is_demo = true, fictional names). Run once on a demo project after the migrations:
-- it creates the demo accounts (password: ${DEMO_PASSWORD}), turns on demo_mode, and loads the data.
-- demo_reset() (the role switcher's «إعادة ضبط بيانات العرض») runs demo_seed() again.

create or replace function public.demo_seed() returns void
language plpgsql security definer set search_path = ''
as $seed$
begin
${body}
end;
$seed$;
revoke execute on function public.demo_seed() from public, anon, authenticated;

-- Demo accounts (Supabase Auth). The on_auth_user_created trigger creates their profiles.
${authUsers}

update public.settings set value = 'true'::jsonb where key = 'demo_mode';
select public.demo_seed();
`;

writeFileSync(new URL('../supabase/seed.sql', import.meta.url), sql);
console.log(`supabase/seed.sql: ${(sql.length / 1024).toFixed(0)} KB, ${demoUsers.length} accounts, ${stock.length} stock rows, ${logs.length} search logs`);
