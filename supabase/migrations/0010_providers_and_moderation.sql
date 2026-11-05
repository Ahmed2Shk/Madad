-- MADAD 0010 · phase 5: service providers and the medical directory (SPEC §9), content moderation
-- (AD-08), users (AD-09), and pharmacy notifications and settings (PH-09, PH-10).

-- ---------------------------------------------------------------- columns

alter type public.review_status add value if not exists 'draft' before 'pending';

alter table public.organizations
  add column website text check (website is null or website ~* '^https?://'),
  add column locations jsonb not null default '[]'::jsonb check (jsonb_typeof(locations) = 'array');

alter table public.services
  add column place text,
  add column phone text,
  add column operating boolean not null default true,
  add column contact text,
  add column location text,
  add column starts_on date,
  add column ends_on date,
  add column rejection_reason text,
  add column updated_at timestamptz not null default now(),
  add constraint services_name_length check (char_length(name) between 1 and 160),
  add constraint services_category_known check (category is null or category in
    ('emergency', 'dialysis', 'maternity', 'chronic', 'mental_health', 'vaccination', 'rehab', 'pediatrics', 'general'));

alter table public.announcements
  add column rejection_reason text,
  add column updated_at timestamptz not null default now(),
  add constraint announcements_title_length check (char_length(title) between 1 and 120),
  add constraint announcements_body_length check (char_length(body) between 1 and 300);

-- AD-09 suspension and PH-10 notification preferences.
alter table public.profiles
  add column suspended_at timestamptz,
  add column prefs jsonb not null default '{}'::jsonb;
grant update (prefs) on public.profiles to authenticated;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('alert_met', 'inquiry_reply', 'verification', 'platform', 'inquiry_new', 'medicine_approved', 'content_review'));

alter table public.reports drop constraint reports_entity_type_check;
alter table public.reports add constraint reports_entity_type_check
  check (entity_type in ('pharmacy', 'medicine', 'availability', 'catalog', 'organization'));

create trigger audit_services after insert or update or delete on public.services
  for each row execute function public.audit_row('service', 'updated_at,created_at');
create trigger audit_announcements after insert or update or delete on public.announcements
  for each row execute function public.audit_row('announcement', 'updated_at,created_at');

-- ---------------------------------------------------------------- a suspended account cannot act

-- Every RPC starts with require_user() (directly or through require_perm / require_platform).
create or replace function public.require_user() returns uuid
language plpgsql stable set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- ---------------------------------------------------------------- provider portal (PR-02..PR-05)

create function public.require_provider(p_org uuid, p_perm text) returns void
language plpgsql stable set search_path = ''
as $$
begin
  perform public.require_perm(p_org, p_perm);
  if (select type from public.organizations where id = p_org) is not distinct from 'pharmacy' then
    perform public.forbid();
  end if;
end;
$$;

create function public.text_array(p jsonb) returns text[]
language sql immutable set search_path = ''
as $$
  select coalesce(array(select btrim(x) from jsonb_array_elements_text(coalesce(p, '[]'::jsonb)) x where btrim(x) <> ''), '{}');
$$;

-- Creating or editing the content sends it to review (AD-08); a programme's status does not.
create function public.save_service(org uuid, input jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := nullif(input ->> 'id', '')::uuid;
  v_kind public.service_kind := (input ->> 'kind')::public.service_kind;
begin
  perform public.require_provider(org, 'publish');
  if v_id is not null and not exists (select 1 from public.services s where s.id = v_id and s.org_id = org) then
    perform public.forbid();
  end if;
  perform public.set_action(case when v_id is null then 'service.add' else 'service.update' end);
  if v_id is null then
    -- The update below fills the fields and writes the one audit row for the new service.
    perform set_config('madad.audit', 'off', true);
    insert into public.services (org_id, kind, name, program_status, confirmed_at, review_status, is_demo)
    values (org, v_kind, btrim(input ->> 'name'),
      case when v_kind = 'program' then coalesce((input ->> 'programStatus')::public.program_status, 'info') end,
      case when v_kind = 'program' then now() end, 'pending',
      coalesce((select (value #>> '{}')::boolean from public.settings where key = 'demo_mode'), false))
    returning id into v_id;
    perform set_config('madad.audit', '', true);
  end if;
  update public.services s set
    kind = v_kind,
    name = btrim(input ->> 'name'),
    category = nullif(input ->> 'category', ''),
    description = nullif(btrim(input ->> 'description'), ''),
    place = nullif(btrim(input ->> 'place'), ''),
    phone = nullif(btrim(input ->> 'phone'), ''),
    operating = coalesce((input ->> 'operating')::boolean, true),
    beneficiaries = nullif(btrim(input ->> 'beneficiaries'), ''),
    required_docs = public.text_array(input -> 'requiredDocs'),
    contact = nullif(btrim(input ->> 'contact'), ''),
    hours = case when jsonb_typeof(input -> 'hours') = 'object' then input -> 'hours' end,
    location = nullif(btrim(input ->> 'location'), ''),
    eligibility = public.text_array(input -> 'eligibility'),
    how_to_apply = nullif(btrim(input ->> 'howToApply'), ''),
    starts_on = nullif(input ->> 'startsOn', '')::date,
    ends_on = nullif(input ->> 'endsOn', '')::date,
    program_status = case when v_kind = 'program' then coalesce((input ->> 'programStatus')::public.program_status, s.program_status, 'info') end,
    review_status = 'pending',
    rejection_reason = null,
    updated_at = now()
  where s.id = v_id;
  return v_id;
end;
$$;

create function public.delete_service(org uuid, service uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_provider(org, 'publish');
  perform public.set_action('service.remove');
  delete from public.services s where s.id = service and s.org_id = org;
end;
$$;

-- Choosing a status, even the same one, confirms it («نشط الآن» needs this every program_confirm_days).
create function public.set_program_status(org uuid, service uuid, status public.program_status) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_provider(org, 'publish');
  perform public.set_action('program.status');
  update public.services s set program_status = set_program_status.status, confirmed_at = now()
  where s.id = service and s.org_id = org and s.kind = 'program';
  if not found then
    perform public.forbid();
  end if;
end;
$$;

-- submit = false keeps a draft; true sends it to review.
create function public.save_announcement(org uuid, input jsonb, submit boolean) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := nullif(input ->> 'id', '')::uuid;
  v_status public.review_status := case when submit then 'pending' else 'draft' end::public.review_status;
begin
  perform public.require_provider(org, 'publish');
  if v_id is not null and not exists (select 1 from public.announcements a where a.id = v_id and a.org_id = org) then
    perform public.forbid();
  end if;
  perform public.set_action(case when v_id is null then 'announcement.add' else 'announcement.update' end);
  if v_id is null then
    insert into public.announcements (org_id, title, body, starts_at, ends_at, review_status, is_demo)
    values (org, btrim(input ->> 'title'), btrim(input ->> 'body'), coalesce((input ->> 'startsAt')::timestamptz, now()),
      nullif(input ->> 'endsAt', '')::timestamptz, v_status,
      coalesce((select (value #>> '{}')::boolean from public.settings where key = 'demo_mode'), false))
    returning id into v_id;
  else
    update public.announcements a set
      title = btrim(input ->> 'title'),
      body = btrim(input ->> 'body'),
      starts_at = coalesce((input ->> 'startsAt')::timestamptz, a.starts_at),
      ends_at = nullif(input ->> 'endsAt', '')::timestamptz,
      review_status = v_status,
      rejection_reason = null,
      updated_at = now()
    where a.id = v_id;
  end if;
  return v_id;
end;
$$;

create function public.delete_announcement(org uuid, announcement uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_provider(org, 'publish');
  perform public.set_action('announcement.remove');
  delete from public.announcements a where a.id = announcement and a.org_id = org;
end;
$$;

-- PR-02 adds the website, extra locations and contact person to the PH-07 profile fields.
create or replace function public.update_org_profile(org uuid, patch jsonb) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  o public.organizations;
  p public.organization_private;
  v_identity boolean;
begin
  perform public.require_perm(org, 'profile');
  select * into o from public.organizations where id = org for update;
  select * into p from public.organization_private where org_id = org;
  v_identity := (patch ? 'nameAr' and patch ->> 'nameAr' is distinct from o.name_ar)
    or (patch ? 'nameEn' and patch ->> 'nameEn' is distinct from o.name_en)
    or (patch ? 'licenseNo' and patch ->> 'licenseNo' is distinct from p.license_no);
  v_identity := v_identity and o.verification_status = 'approved';
  perform public.set_action(case when v_identity then 'verification.re_review' else 'organization.update' end);

  update public.organization_private set
    license_no = case when patch ? 'licenseNo' then btrim(coalesce(patch ->> 'licenseNo', '')) else license_no end,
    exact_lat = case when patch ? 'exactLat' then (patch ->> 'exactLat')::double precision else exact_lat end,
    exact_lng = case when patch ? 'exactLng' then (patch ->> 'exactLng')::double precision else exact_lng end,
    contact_person = case when patch ? 'contactPerson' then btrim(coalesce(patch ->> 'contactPerson', '')) else contact_person end
  where org_id = org;

  update public.organizations set
    name_ar = case when patch ? 'nameAr' then btrim(patch ->> 'nameAr') else name_ar end,
    name_en = case when patch ? 'nameEn' then btrim(coalesce(patch ->> 'nameEn', '')) else name_en end,
    governorate = case when patch ? 'governorate' then patch ->> 'governorate' else governorate end,
    area = case when patch ? 'area' then coalesce(patch ->> 'area', '') else area end,
    address_text = case when patch ? 'addressText' then btrim(coalesce(patch ->> 'addressText', '')) else address_text end,
    landmark = case when patch ? 'landmark' then nullif(btrim(patch ->> 'landmark'), '') else landmark end,
    location_precision = case when patch ? 'locationPrecision' then (patch ->> 'locationPrecision')::public.location_precision else location_precision end,
    phone = case when patch ? 'phone' then btrim(coalesce(patch ->> 'phone', '')) else phone end,
    whatsapp = case when patch ? 'whatsapp' then nullif(btrim(patch ->> 'whatsapp'), '') else whatsapp end,
    hours = case when patch ? 'hours' then coalesce(patch -> 'hours', '{}'::jsonb) else hours end,
    description = case when patch ? 'description' then nullif(btrim(patch ->> 'description'), '') else description end,
    website = case when patch ? 'website' then nullif(btrim(patch ->> 'website'), '') else website end,
    locations = case when patch ? 'locations' and jsonb_typeof(patch -> 'locations') = 'array' then patch -> 'locations' else locations end,
    temporarily_closed = case when patch ? 'temporarilyClosed' then jsonb_typeof(patch -> 'temporarilyClosed') = 'object' else temporarily_closed end,
    closed_reason = case when patch ? 'temporarilyClosed' then nullif(btrim(patch -> 'temporarilyClosed' ->> 'reason'), '') else closed_reason end,
    verification_status = case when v_identity then 'pending' else verification_status end,
    info_updated_at = now()
  where id = org;

  if v_identity then
    insert into public.verification_events (org_id, action, actor_id) values (org, 'profile_changed', auth.uid());
  end if;
  return v_identity;
end;
$$;

-- ---------------------------------------------------------------- inquiries and notifications (P-08, PH-09)

-- P-09 / P-08: the question may be about a medicine or about a service or programme; members who
-- answer inquiries get an «استفسار جديد» notification.
drop function public.send_inquiry(uuid, text, text, text);
create function public.send_inquiry(org uuid, medicine text, subject text, body text, service uuid default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_id uuid;
  o public.organizations;
begin
  select * into o from public.organizations where id = org and verification_status = 'approved';
  if o.id is null then
    perform public.forbid();
  end if;
  insert into public.inquiries (org_id, patient_id, medicine_id, service_id, subject)
  values (org, v_uid, (select id from public.medicines where id = medicine),
    (select s.id from public.services s where s.id = service and s.org_id = org), left(btrim(subject), 200))
  returning id into v_id;
  insert into public.inquiry_messages (inquiry_id, sender_id, sender_side, body)
  values (v_id, v_uid, 'patient', left(btrim(body), 2000));
  insert into public.notifications (user_id, kind, data, link)
  select m.user_id, 'inquiry_new',
    jsonb_build_object('orgId', org, 'orgNameAr', o.name_ar, 'orgNameEn', o.name_en, 'subject', left(btrim(subject), 200)),
    case when o.type = 'pharmacy' then '/pharmacy-portal/inquiries' else '/provider/inquiries' end
  from public.org_members m
  where m.org_id = org and coalesce((m.perms ->> 'inquiries')::boolean, false);
  return v_id;
end;
$$;

-- review_medicine, now also telling the requesting pharmacy «اعتماد دواء مطلوب» (PH-09).
create or replace function public.review_medicine(id text, decision text, merge_into text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  m public.medicines;
begin
  perform public.require_platform('reviewer');
  select * into m from public.medicines x where x.id = review_medicine.id;
  if m.id is null or m.status <> 'pending' then
    return;
  end if;
  if decision not in ('approve', 'merge', 'reject') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  perform public.set_action('catalog.request.' || decision);
  if decision = 'merge' then
    if merge_into is null or not exists (select 1 from public.medicines where public.medicines.id = merge_into and status = 'approved') then
      raise exception 'merge_target_required' using errcode = 'P0001';
    end if;
    update public.medicines t set aliases = array(select distinct a from unnest(t.aliases || array[m.name_ar, m.name_en]) a where a <> '')
    where t.id = merge_into;
    update public.medicines x set status = 'merged', merged_into = review_medicine.merge_into where x.id = m.id;
  else
    update public.medicines x set status = case when decision = 'approve' then 'approved' else 'rejected' end::public.medicine_status
    where x.id = m.id;
  end if;
  if decision = 'approve' and m.requested_by_org is not null then
    perform public.notify_members(m.requested_by_org, 'medicine_approved',
      jsonb_build_object('nameAr', m.name_ar, 'nameEn', m.name_en), '/pharmacy-portal/medicines/add');
  end if;
end;
$$;

-- ---------------------------------------------------------------- AD-08 content moderation

create function public.moderate_content(kind text, id uuid, decision text, reason text default '') returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org uuid;
  v_title text;
  v_status public.review_status;
begin
  perform public.require_platform('reviewer');
  if decision not in ('approve', 'reject') or kind not in ('service', 'announcement') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  if decision = 'reject' and coalesce(btrim(reason), '') = '' then
    raise exception 'note_required' using errcode = 'P0001';
  end if;
  v_status := case when decision = 'approve' then 'approved' else 'rejected' end::public.review_status;
  perform public.set_action('moderation.' || decision, nullif(btrim(reason), ''));
  if kind = 'service' then
    update public.services s set review_status = v_status, rejection_reason = case when decision = 'reject' then btrim(reason) end
    where s.id = moderate_content.id and s.review_status = 'pending'
    returning s.org_id, s.name into v_org, v_title;
  else
    update public.announcements a set review_status = v_status, rejection_reason = case when decision = 'reject' then btrim(reason) end
    where a.id = moderate_content.id and a.review_status = 'pending' and a.org_id is not null
    returning a.org_id, a.title into v_org, v_title;
  end if;
  if v_org is not null then
    perform public.notify_members(v_org, 'content_review',
      jsonb_build_object('status', v_status, 'title', v_title, 'reason', coalesce(nullif(btrim(reason), ''), '')),
      case when kind = 'service' then '/provider/services' else '/provider/announcements' end);
  end if;
end;
$$;

-- ---------------------------------------------------------------- AD-09 users (system admin)

create function public.admin_users() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_platform('super_admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', p.id,
      'displayName', p.full_name,
      'email', u.email,
      'type', case when p.platform_role is not null then 'team' when exists (select 1 from public.org_members m where m.user_id = p.id) then 'organization' else 'patient' end,
      'platformRole', p.platform_role,
      'memberships', coalesce((
        select jsonb_agg(jsonb_build_object('orgId', o.id, 'orgNameAr', o.name_ar, 'orgNameEn', o.name_en, 'role', m.member_role) order by m.created_at)
        from public.org_members m join public.organizations o on o.id = m.org_id where m.user_id = p.id), '[]'::jsonb),
      'suspended', p.suspended_at is not null,
      'isDemo', p.is_demo,
      'joinedAt', p.created_at) order by p.created_at desc)
    from public.profiles p join auth.users u on u.id = p.id), '[]'::jsonb);
end;
$$;

create function public.set_user_suspended(target uuid, suspended boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_platform('super_admin');
  if target = auth.uid() then
    perform public.forbid();
  end if;
  update public.profiles set suspended_at = case when suspended then coalesce(suspended_at, now()) end where id = target;
  perform public.write_audit(case when suspended then 'user.suspend' else 'user.reactivate' end, 'profile', target::text,
    jsonb_build_object('suspended', not suspended), jsonb_build_object('suspended', suspended));
end;
$$;

create function public.set_platform_role(target uuid, role public.platform_role default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_before public.platform_role;
begin
  perform public.require_platform('super_admin');
  if target = auth.uid() then
    perform public.forbid();
  end if;
  select platform_role into v_before from public.profiles where id = target;
  update public.profiles set platform_role = set_platform_role.role where id = target;
  perform public.write_audit('user.platform_role', 'profile', target::text,
    jsonb_build_object('platformRole', v_before), jsonb_build_object('platformRole', role));
end;
$$;

-- ---------------------------------------------------------------- privileges

revoke execute on function public.require_provider(uuid, text), public.text_array(jsonb) from public, anon, authenticated;
grant execute on function
  public.save_service(uuid, jsonb), public.delete_service(uuid, uuid), public.set_program_status(uuid, uuid, public.program_status),
  public.save_announcement(uuid, jsonb, boolean), public.delete_announcement(uuid, uuid),
  public.send_inquiry(uuid, text, text, text, uuid), public.moderate_content(text, uuid, text, text),
  public.admin_users(), public.set_user_suspended(uuid, boolean), public.set_platform_role(uuid, public.platform_role)
to authenticated;
