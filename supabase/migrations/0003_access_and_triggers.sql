-- MADAD 0003 · access helpers and triggers (SPEC §4, §13).
-- Helpers are SECURITY DEFINER so policies can call them without recursing into RLS.

create function public.is_platform(r public.platform_role) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (p.platform_role = r or (r = 'reviewer' and p.platform_role = 'super_admin'))
  );
$$;

-- has_org_perm(org, perm): the caller is a member with that permission; perm 'member' = any member.
create function public.has_org_perm(p_org uuid, p_perm text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = p_org and m.user_id = auth.uid()
      and (p_perm = 'member' or coalesce((m.perms ->> p_perm)::boolean, false))
  );
$$;

create function public.is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.org_members m where m.org_id = p_org and m.user_id = auth.uid() and m.member_role = 'owner');
$$;

-- Default permissions per role (SPEC §4 table; src/data/perms.ts).
create function public.default_perms(r public.member_role) returns jsonb
language sql immutable set search_path = ''
as $$
  select case r
    when 'owner' then '{"availability":true,"prices":true,"medicines":true,"publish":true,"inquiries":true,"profile":true,"team":true,"reports":true}'::jsonb
    when 'manager' then '{"availability":true,"prices":true,"medicines":true,"publish":true,"inquiries":true,"profile":true,"team":false,"reports":true}'::jsonb
    when 'staff' then '{"availability":true,"prices":false,"medicines":false,"publish":false,"inquiries":true,"profile":false,"team":false,"reports":true}'::jsonb
    else '{"availability":false,"prices":false,"medicines":false,"publish":false,"inquiries":false,"profile":false,"team":false,"reports":true}'::jsonb
  end;
$$;

create function public.setting_int(p_key text) returns integer
language sql stable security definer set search_path = ''
as $$ select (s.value #>> '{}')::integer from public.settings s where s.key = p_key; $$;

create function public.require_user() returns uuid
language plpgsql stable set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function public.forbid() returns void
language plpgsql set search_path = ''
as $$ begin raise exception 'forbidden' using errcode = '42501'; end; $$;

-- ---------------------------------------------------------------- audit_log
-- Rows are written only here, by triggers (and by the few RPCs that log an action rather than a
-- row change). No role can insert, update or delete audit_log directly.
-- Functions set two transaction-local values before writing: madad.action (the action name shown
-- in AD-10) and madad.note (a reason). madad.audit = 'off' skips per-row logging (seed, CSV import).

create function public.write_audit(p_action text, p_entity_type text, p_entity_id text, p_old jsonb, p_new jsonb)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, entity_type, entity_id, old_value, new_value)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_old, p_new);
$$;

create function public.set_action(p_action text, p_note text default null) returns void
language sql set search_path = ''
as $$
  select set_config('madad.action', coalesce(p_action, ''), true), set_config('madad.note', coalesce(p_note, ''), true);
$$;

create function public.audit_row() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_ignore text[] := coalesce(string_to_array(tg_argv[1], ','), '{}');
  v_keys text[];
  v_action text := nullif(current_setting('madad.action', true), '');
  v_note text := nullif(current_setting('madad.note', true), '');
  v_id text;
  k text;
  o jsonb := '{}'::jsonb;
  n jsonb := '{}'::jsonb;
begin
  if current_setting('madad.audit', true) = 'off' then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    select array_agg(key) into v_keys
    from jsonb_each(v_new) e
    where not (e.key = any (v_ignore)) and v_old -> e.key is distinct from e.value;
    if v_keys is null then
      return null; -- only ignored columns changed (e.g. confirm_all touching reported_at)
    end if;
    foreach k in array v_keys loop
      o := o || jsonb_build_object(k, v_old -> k);
      n := n || jsonb_build_object(k, v_new -> k);
    end loop;
    v_old := o;
    v_new := n;
  elsif tg_op = 'INSERT' then
    v_new := v_new - v_ignore;
  else
    v_old := v_old - v_ignore;
  end if;
  if v_note is not null then
    v_new := coalesce(v_new, '{}'::jsonb) || jsonb_build_object('note', v_note);
  end if;
  v_id := case tg_table_name
    when 'pharmacy_stock' then (v_row ->> 'pharmacy_id') || '/' || (v_row ->> 'medicine_id')
    when 'org_members' then (v_row ->> 'org_id') || '/' || (v_row ->> 'user_id')
    when 'org_invitations' then (v_row ->> 'org_id') || '/' || (v_row ->> 'email')
    when 'org_documents' then (v_row ->> 'org_id') || '/' || (v_row ->> 'file_name')
    when 'settings' then v_row ->> 'key'
    else v_row ->> 'id'
  end;
  perform public.write_audit(coalesce(v_action, tg_argv[0] || '.' || lower(tg_op)), tg_table_name, v_id, v_old, v_new);
  return null;
end;
$$;

create trigger audit_pharmacy_stock after insert or update or delete on public.pharmacy_stock
  for each row execute function public.audit_row('stock', 'reported_at,price_updated_at');
create trigger audit_organizations after insert or update on public.organizations
  for each row execute function public.audit_row('organization', 'info_updated_at,public_lat,public_lng');
create trigger audit_org_members after insert or update or delete on public.org_members
  for each row execute function public.audit_row('team', 'created_at');
create trigger audit_org_invitations after insert or delete on public.org_invitations
  for each row execute function public.audit_row('team', 'created_at');
create trigger audit_org_documents after update on public.org_documents
  for each row execute function public.audit_row('verification.document', '');
create trigger audit_medicines after insert or update on public.medicines
  for each row execute function public.audit_row('catalog', 'search_text,sort_order,created_at');
create trigger audit_reports after update on public.reports
  for each row execute function public.audit_row('report', '');
create trigger audit_settings after update on public.settings
  for each row execute function public.audit_row('settings', '');

-- confirm_all is one action over many rows: logged once, from its stock_history row.
create function public.audit_confirm_all() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.action = 'confirm_all' and current_setting('madad.audit', true) is distinct from 'off' then
    perform public.write_audit('stock.confirm_all', 'organization', new.pharmacy_id::text, null,
      jsonb_build_object('count', new.item_count, 'pricesToo', current_setting('madad.note', true) = 'prices'));
  end if;
  return null;
end;
$$;
create trigger audit_stock_history_confirm_all after insert on public.stock_history
  for each row execute function public.audit_confirm_all();

-- ---------------------------------------------------------------- profiles

-- Every new Supabase Auth user gets a profile, and pending team invitations for that email become memberships.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
  )
  on conflict (id) do nothing;

  insert into public.org_members (org_id, user_id, member_role, perms)
  select i.org_id, new.id, i.member_role, i.perms
  from public.org_invitations i
  where i.email = lower(new.email)
  on conflict do nothing;
  delete from public.org_invitations where email = lower(new.email);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- organizations

-- public_lat / public_lng: the exact point only when precision is 'exact', otherwise NULL (SPEC §13).
create function public.sync_public_location() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p public.organization_private;
begin
  select * into p from public.organization_private where org_id = new.id;
  if new.location_precision = 'exact' and p.org_id is not null then
    new.public_lat := p.exact_lat;
    new.public_lng := p.exact_lng;
  else
    new.public_lat := null;
    new.public_lng := null;
  end if;
  return new;
end;
$$;
create trigger organizations_public_location before insert or update on public.organizations
  for each row execute function public.sync_public_location();

create function public.private_location_changed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Re-runs sync_public_location(); public_lat/lng are ignored by the audit trigger.
  update public.organizations set location_precision = location_precision where id = new.org_id;
  return null;
end;
$$;
create trigger organization_private_location after insert or update of exact_lat, exact_lng on public.organization_private
  for each row execute function public.private_location_changed();

-- ---------------------------------------------------------------- snapshots

create function public.snapshot_actor_name() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.actor_id is not null and new.actor_name is null then
    select full_name into new.actor_name from public.profiles where id = new.actor_id;
  end if;
  return new;
end;
$$;
create trigger stock_history_actor_name before insert on public.stock_history
  for each row execute function public.snapshot_actor_name();

create function public.snapshot_patient_name() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  select full_name into new.patient_name from public.profiles where id = new.patient_id;
  new.patient_name := coalesce(new.patient_name, '');
  return new;
end;
$$;
create trigger inquiries_patient_name before insert on public.inquiries
  for each row execute function public.snapshot_patient_name();
