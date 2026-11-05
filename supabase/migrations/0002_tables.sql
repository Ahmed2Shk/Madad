-- MADAD 0002 · tables (SPEC §13). The 22 tables of the spec, plus page_views (docs/DECISIONS.md,
-- phases 2–3 #5) and org_invitations (PH-08 invitations).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  default_gov text,
  platform_role public.platform_role,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.org_type not null,
  name_ar text not null check (char_length(name_ar) between 2 and 120),
  name_en text not null default '' check (char_length(name_en) <= 120),
  governorate text not null,
  area text not null default '',
  address_text text not null default '',
  landmark text,
  location_precision public.location_precision not null default 'area',
  -- Filled by a trigger from organization_private: NULL unless precision is 'exact'.
  public_lat double precision,
  public_lng double precision,
  phone text not null default '',
  whatsapp text,
  hours jsonb not null default '{}'::jsonb,
  description text,
  verification_status public.verification_status not null default 'draft',
  suspended_reason text,
  temporarily_closed boolean not null default false,
  closed_reason text,
  info_updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index organizations_public_idx on public.organizations (verification_status, type, governorate);

-- Never readable by visitors or patients: organization members and reviewers only.
create table public.organization_private (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  license_no text not null default '',
  exact_lat double precision,
  exact_lng double precision,
  contact_person text not null default '',
  reviewer_notes text
);

create table public.org_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  member_role public.member_role not null,
  perms jsonb not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members (user_id);

create table public.org_invitations (
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email)),
  member_role public.member_role not null check (member_role <> 'owner'),
  perms jsonb not null,
  created_at timestamptz not null default now(),
  primary key (org_id, email)
);

create table public.org_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  doc_type text not null,
  file_name text not null,
  size_bytes integer not null default 0 check (size_bytes >= 0),
  mime text not null default '',
  -- "<org_id>/<file>" in the private org-docs bucket; NULL for metadata-only rows.
  storage_path text,
  status public.document_status not null default 'pending',
  reviewer_note text,
  created_at timestamptz not null default now()
);
create index org_documents_org_idx on public.org_documents (org_id);

create table public.verification_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  action text not null check (action in ('submitted', 'approved', 'needs_info', 'rejected', 'resubmitted', 'profile_changed')),
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index verification_events_org_idx on public.verification_events (org_id, created_at);

create table public.categories (
  id text primary key,
  name_ar text not null,
  name_en text not null,
  sort_order integer not null default 0
);

create table public.medicines (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  name_ar text not null,
  name_en text not null,
  generic_name text not null default '',
  strength text not null default '',
  strength_en text,
  dosage_form text not null check (dosage_form in ('tablet', 'capsule', 'syrup', 'suspension', 'injection_pen', 'vial', 'inhaler', 'sachet', 'cream')),
  pack_size text not null default '',
  pack_size_en text,
  manufacturer text,
  barcode text,
  aliases text[] not null default '{}',
  category_id text not null references public.categories (id),
  prescription text not null default 'unspecified',
  status public.medicine_status not null default 'pending',
  requested_by_org uuid references public.organizations (id) on delete set null,
  merged_into text references public.medicines (id),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  -- Catalog order, used to break ties in search ranking the way the client does.
  sort_order bigint generated always as identity,
  search_text text generated always as (
    public.medicine_search_text(name_ar, name_en, generic_name, strength, strength_en, aliases, barcode)
  ) stored
);
create index medicines_search_trgm on public.medicines using gin (search_text extensions.gin_trgm_ops);
create index medicines_status_idx on public.medicines (status);
create index medicines_barcode_idx on public.medicines (barcode) where barcode is not null;

-- The latest report per medicine per pharmacy. Who reported it lives only in stock_history.
create table public.pharmacy_stock (
  pharmacy_id uuid not null references public.organizations (id) on delete cascade,
  medicine_id text not null references public.medicines (id),
  reported_status public.reported_status not null,
  -- When the change was made on the device (LEAST(client_updated_at, now())), never when it was sent.
  reported_at timestamptz not null,
  price_ils numeric(8, 2) check (price_ils is null or price_ils >= 0),
  price_updated_at timestamptz,
  is_listed boolean not null default true,
  hidden_by_admin boolean not null default false,
  primary key (pharmacy_id, medicine_id)
);
create index pharmacy_stock_medicine_idx on public.pharmacy_stock (medicine_id);

-- Internal quantity: members of the pharmacy only, never public.
create table public.stock_private (
  pharmacy_id uuid not null,
  medicine_id text not null,
  quantity integer not null check (quantity >= 0),
  low_threshold integer not null default 0 check (low_threshold >= 0),
  primary key (pharmacy_id, medicine_id),
  foreign key (pharmacy_id, medicine_id) references public.pharmacy_stock (pharmacy_id, medicine_id) on delete cascade
);

create table public.stock_history (
  id bigint generated always as identity primary key,
  pharmacy_id uuid not null references public.organizations (id) on delete cascade,
  medicine_id text references public.medicines (id),
  action public.stock_action not null,
  old_status public.reported_status,
  new_status public.reported_status,
  old_price numeric(8, 2),
  new_price numeric(8, 2),
  -- Rows touched by confirm_all.
  item_count integer,
  actor_id uuid,
  -- Snapshot of the actor's display name, so the pharmacy sees who did it without reading profiles.
  actor_name text,
  created_at timestamptz not null default now()
);
create index stock_history_pharmacy_idx on public.stock_history (pharmacy_id, created_at desc);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind public.service_kind not null,
  name text not null,
  category text,
  description text,
  beneficiaries text,
  eligibility text[] not null default '{}',
  required_docs text[] not null default '{}',
  how_to_apply text,
  hours jsonb,
  program_status public.program_status,
  confirmed_at timestamptz,
  review_status public.review_status not null default 'pending',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index services_org_idx on public.services (org_id);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  -- NULL = a platform announcement.
  org_id uuid references public.organizations (id) on delete cascade,
  title text not null,
  body text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  review_status public.review_status not null default 'pending',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid not null references public.profiles (id) on delete cascade,
  -- Display name only (SPEC §2 rule 8), copied when the inquiry is sent.
  patient_name text not null default '',
  medicine_id text references public.medicines (id),
  service_id uuid references public.services (id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 200),
  status public.inquiry_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inquiries_org_idx on public.inquiries (org_id, updated_at desc);
create index inquiries_patient_idx on public.inquiries (patient_id);

create table public.inquiry_messages (
  id bigint generated always as identity primary key,
  inquiry_id uuid not null references public.inquiries (id) on delete cascade,
  sender_id uuid,
  sender_side text not null check (sender_side in ('patient', 'org')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index inquiry_messages_inquiry_idx on public.inquiry_messages (inquiry_id, created_at);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('medicine', 'pharmacy', 'provider')),
  entity_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

create table public.availability_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  medicine_id text not null references public.medicines (id),
  -- A governorate id, or 'all'.
  governorate text not null,
  active boolean not null default true,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index availability_alerts_waiting_idx on public.availability_alerts (medicine_id) where active;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('alert_met', 'inquiry_reply', 'verification', 'platform')),
  title text,
  body text,
  -- i18n-ready parts; the UI composes the sentence.
  data jsonb not null default '{}'::jsonb,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Anonymous on purpose: no user_id, no IP, no session.
create table public.search_logs (
  id bigint generated always as identity primary key,
  query_norm text not null,
  medicine_id text references public.medicines (id) on delete set null,
  governorate text not null,
  result_count integer not null check (result_count >= 0),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index search_logs_created_idx on public.search_logs (created_at);

-- Anonymous daily view counter per pharmacy (docs/DECISIONS.md, phases 2–3 #5).
create table public.page_views (
  pharmacy_id uuid not null references public.organizations (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (pharmacy_id, day)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('pharmacy', 'medicine', 'availability', 'catalog')),
  entity_id text not null,
  reason text not null check (reason in ('wrong_availability', 'closed_or_moved', 'wrong_phone', 'misleading', 'other', 'shortage', 'suggest_medicine')),
  details text not null default '' check (char_length(details) <= 1000),
  governorate text,
  status public.report_status not null default 'new',
  admin_note text,
  resolution text,
  handled_by uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- Read values with (value #>> '{}'), so 24 and "24" both work.
create table public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false
);

insert into public.settings (key, value, is_public) values
  ('fresh_hours', '24', true),
  ('expire_hours', '72', true),
  ('price_max_days', '14', true),
  ('program_confirm_days', '7', true),
  ('disclaimer_ar', 'null', true),
  ('disclaimer_en', 'null', true),
  ('required_docs', '{"pharmacy":["practice_license","pharmacy_license","contact_id"],"hospital":["facility_license","contact_id"],"medical_point":["authorization_letter","contact_id"],"humanitarian":["registration_certificate","contact_id"]}', true),
  ('rejection_reasons', '["وثائق غير واضحة أو ناقصة","الرخصة غير سارية","البيانات لا تطابق الوثائق","مؤسسة مكررة"]', false),
  -- true only on a demo project (set by seed.sql): enables demo_reset().
  ('demo_mode', 'false', false);
