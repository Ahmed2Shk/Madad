-- MADAD 0006 · RPC for organization members (SPEC §8, §13). Every function checks has_org_perm().

create function public.require_perm(p_org uuid, p_perm text) returns void
language plpgsql stable set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.has_org_perm(p_org, p_perm) then
    perform public.forbid();
  end if;
end;
$$;

create function public.require_owner(p_org uuid) returns void
language plpgsql stable set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.is_org_owner(p_org) then
    perform public.forbid();
  end if;
end;
$$;

-- ---------------------------------------------------------------- availability

-- update_stock(pharmacy, changes): [{medicineId, status, priceIls?, clientUpdatedAt}, ...].
-- reported_at = LEAST(clientUpdatedAt, now()); a change older than the current report is ignored.
-- Prices change only with the prices permission. Waiting patients are notified (notify_alerts).
create function public.update_stock(pharmacy uuid, changes jsonb) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_org public.organizations;
  v_can_price boolean;
  c jsonb;
  v_med text;
  v_status public.reported_status;
  v_at timestamptz;
  v_now timestamptz := now();
  v_old public.pharmacy_stock;
  v_found boolean;
  v_set_price boolean;
  v_price numeric(8, 2);
  v_new_price numeric(8, 2);
  n integer := 0;
begin
  perform public.require_perm(pharmacy, 'availability');
  select * into v_org from public.organizations where id = pharmacy;
  if v_org.type is distinct from 'pharmacy' then
    perform public.forbid();
  end if;
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes) > 500 then
    raise exception 'invalid_changes' using errcode = '22023';
  end if;
  v_can_price := public.has_org_perm(pharmacy, 'prices');
  perform public.set_action('stock.update');

  for c in select value from jsonb_array_elements(changes) loop
    v_med := c ->> 'medicineId';
    v_status := (c ->> 'status')::public.reported_status;
    v_at := least(coalesce((c ->> 'clientUpdatedAt')::timestamptz, v_now), v_now);
    continue when not exists (select 1 from public.medicines where id = v_med and status = 'approved');

    select * into v_old from public.pharmacy_stock where pharmacy_id = pharmacy and medicine_id = v_med for update;
    v_found := found;
    continue when v_found and v_at < v_old.reported_at;

    v_set_price := v_can_price and c ? 'priceIls';
    v_price := case when jsonb_typeof(c -> 'priceIls') = 'number' then (c ->> 'priceIls')::numeric end;
    if v_price is not null and (v_price < 0 or v_price > 100000) then
      raise exception 'invalid_price' using errcode = '22023';
    end if;

    if v_found then
      v_new_price := case when v_set_price then v_price else v_old.price_ils end;
      update public.pharmacy_stock set
        reported_status = v_status,
        reported_at = v_at,
        price_ils = v_new_price,
        price_updated_at = case when v_set_price then (case when v_price is null then null else v_at end) else price_updated_at end
      where pharmacy_id = pharmacy and medicine_id = v_med;
    else
      v_new_price := case when v_set_price then v_price end;
      insert into public.pharmacy_stock (pharmacy_id, medicine_id, reported_status, reported_at, price_ils, price_updated_at)
      values (pharmacy, v_med, v_status, v_at, v_new_price, case when v_new_price is not null then v_at end);
    end if;

    insert into public.stock_history (pharmacy_id, medicine_id, action, old_status, new_status, old_price, new_price, actor_id)
    values (pharmacy, v_med, 'update', case when v_found then v_old.reported_status end, v_status,
      case when v_found then v_old.price_ils end, v_new_price, auth.uid());
    n := n + 1;

    if v_org.verification_status = 'approved' and v_status in ('available', 'limited') then
      perform public.notify_alerts(pharmacy, v_med, v_org.governorate);
    end if;
  end loop;
  return n;
end;
$$;

-- «تأكيد الكل كما هو»: renews reported_at of every listed medicine without changing its status.
-- Prices are renewed only with prices_too and the prices permission. Logged once as confirm_all.
create function public.confirm_all(pharmacy uuid, prices_too boolean default false) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_prices boolean;
  n integer;
begin
  perform public.require_perm(pharmacy, 'availability');
  v_prices := coalesce(prices_too, false) and public.has_org_perm(pharmacy, 'prices');
  update public.pharmacy_stock set
    reported_at = now(),
    price_updated_at = case when v_prices and price_ils is not null then now() else price_updated_at end
  where pharmacy_id = pharmacy and is_listed;
  get diagnostics n = row_count;
  perform public.set_action(null, case when v_prices then 'prices' end);
  insert into public.stock_history (pharmacy_id, action, item_count, actor_id) values (pharmacy, 'confirm_all', n, auth.uid());
  return n;
end;
$$;

create function public.stock_add(pharmacy uuid, medicine text, status public.reported_status) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_perm(pharmacy, 'medicines');
  if not exists (select 1 from public.organizations where id = pharmacy and type = 'pharmacy')
     or not exists (select 1 from public.medicines m where m.id = medicine and m.status = 'approved') then
    perform public.forbid();
  end if;
  if exists (select 1 from public.pharmacy_stock where pharmacy_id = pharmacy and medicine_id = medicine) then
    return;
  end if;
  perform public.set_action('stock.add');
  insert into public.pharmacy_stock (pharmacy_id, medicine_id, reported_status, reported_at) values (pharmacy, medicine, stock_add.status, now());
  insert into public.stock_history (pharmacy_id, medicine_id, action, new_status, actor_id) values (pharmacy, medicine, 'add', stock_add.status, auth.uid());
end;
$$;

create function public.stock_remove(pharmacy uuid, medicine text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_perm(pharmacy, 'medicines');
  perform public.set_action('stock.remove');
  delete from public.pharmacy_stock where pharmacy_id = pharmacy and medicine_id = medicine;
  if found then
    insert into public.stock_history (pharmacy_id, medicine_id, action, actor_id) values (pharmacy, medicine, 'remove', auth.uid());
  end if;
end;
$$;

create function public.stock_set_listed(pharmacy uuid, medicine text, listed boolean) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_perm(pharmacy, 'medicines');
  perform public.set_action(case when listed then 'stock.show' else 'stock.hide' end);
  update public.pharmacy_stock set is_listed = listed
  where pharmacy_id = pharmacy and medicine_id = medicine and is_listed is distinct from listed;
  if found then
    insert into public.stock_history (pharmacy_id, medicine_id, action, actor_id)
    values (pharmacy, medicine, case when listed then 'show' else 'hide' end::public.stock_action, auth.uid());
  end if;
end;
$$;

-- ---------------------------------------------------------------- PH-01 overview

create function public.portal_overview(org uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_gov text;
  v_fh integer := public.setting_int('fresh_hours');
  v_eh integer := public.setting_int('expire_hours');
  v_today date := (now() at time zone 'utc')::date;
  v_counts jsonb;
  v_views_this integer;
  v_views_last integer;
  v_by_day jsonb;
  v_unmet jsonb;
  v_activity jsonb;
  v_new integer;
begin
  perform public.require_perm(org, 'member');
  select governorate into v_gov from public.organizations where id = org;

  select jsonb_build_object(
    'listed', count(*),
    'fresh', count(*) filter (where public.freshness_of(reported_at, now(), v_fh, v_eh) = 'fresh'),
    'stale', count(*) filter (where public.freshness_of(reported_at, now(), v_fh, v_eh) = 'stale'),
    'expired', count(*) filter (where public.freshness_of(reported_at, now(), v_fh, v_eh) = 'expired'))
  into v_counts
  from public.pharmacy_stock where pharmacy_id = org and is_listed;

  select coalesce(sum(count) filter (where day > v_today - 7 and day <= v_today), 0),
         coalesce(sum(count) filter (where day > v_today - 14 and day <= v_today - 7), 0)
  into v_views_this, v_views_last
  from public.page_views where pharmacy_id = org;

  -- Searches in this governorate for medicines this pharmacy lists, oldest day first.
  select jsonb_agg(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'count', coalesce(x.n, 0)) order by d)
  into v_by_day
  from generate_series(v_today - 6, v_today, interval '1 day') as g(d)
  left join (
    select (l.created_at at time zone 'utc')::date as day, count(*)::integer as n
    from public.search_logs l
    where l.governorate = v_gov and l.created_at >= now() - interval '7 days'
      and l.medicine_id in (select medicine_id from public.pharmacy_stock where pharmacy_id = org and is_listed)
    group by 1
  ) x on x.day = g.d::date;

  -- «مطلوب عندك وغير متوفر»: searched with no result nearby, and not fresh-available here.
  select coalesce(jsonb_agg(jsonb_build_object('medicineId', medicine_id, 'count', n) order by n desc, medicine_id), '[]'::jsonb)
  into v_unmet
  from (
    select l.medicine_id, count(*)::integer as n
    from public.search_logs l
    where l.governorate = v_gov and l.created_at >= now() - interval '7 days'
      and l.medicine_id is not null and l.result_count = 0
      and l.medicine_id not in (
        select medicine_id from public.pharmacy_stock
        where pharmacy_id = org and is_listed and reported_status <> 'unavailable'
          and public.freshness_of(reported_at, now(), v_fh, v_eh) = 'fresh')
    group by l.medicine_id
    order by n desc, l.medicine_id
    limit 5
  ) u;

  select coalesce(jsonb_agg(h order by h.created_at desc), '[]'::jsonb) into v_activity
  from (select * from public.stock_history where pharmacy_id = org order by created_at desc, id desc limit 8) h;

  select count(*) into v_new from public.inquiries where org_id = org and status = 'new';

  return v_counts || jsonb_build_object(
    'newInquiries', v_new,
    'viewsThisWeek', v_views_this,
    'viewsLastWeek', v_views_last,
    'searchesByDay', coalesce(v_by_day, '[]'::jsonb),
    'unmetNearby', v_unmet,
    'activity', v_activity);
end;
$$;

-- ---------------------------------------------------------------- catalog requests (PH-04)

create function public.medicine_slug(p_name text) returns text
language plpgsql stable set search_path = ''
as $$
declare
  base text := coalesce(nullif(btrim(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'), '-'), ''), 'medicine');
  v_id text := base;
  i integer := 2;
begin
  while exists (select 1 from public.medicines where id = v_id) loop
    v_id := base || '-' || i;
    i := i + 1;
  end loop;
  return v_id;
end;
$$;

create function public.medicine_row(p jsonb, p_status public.medicine_status, p_org uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_id text := public.medicine_slug(p ->> 'nameEn');
begin
  insert into public.medicines (id, name_ar, name_en, generic_name, strength, dosage_form, pack_size, manufacturer, barcode, aliases, category_id, status, requested_by_org, is_demo)
  values (
    v_id, btrim(p ->> 'nameAr'), btrim(p ->> 'nameEn'), btrim(coalesce(p ->> 'genericName', '')), btrim(coalesce(p ->> 'strength', '')),
    p ->> 'dosageForm', btrim(coalesce(p ->> 'packSize', '')), nullif(btrim(p ->> 'manufacturer'), ''), nullif(btrim(p ->> 'barcode'), ''),
    coalesce(array(select btrim(x) from jsonb_array_elements_text(coalesce(p -> 'aliases', '[]'::jsonb)) x where btrim(x) <> ''), '{}'),
    p ->> 'categoryId', p_status, p_org,
    coalesce((select (value #>> '{}')::boolean from public.settings where key = 'demo_mode'), false));
  return v_id;
end;
$$;

create function public.request_medicine(org uuid, input jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_perm(org, 'medicines');
  perform public.set_action('catalog.request');
  return public.medicine_row(input - 'aliases', 'pending', org);
end;
$$;

-- ---------------------------------------------------------------- inquiries (PH-06)

create function public.reply_inquiry(org uuid, inquiry uuid, body text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  q public.inquiries;
  o public.organizations;
begin
  perform public.require_perm(org, 'inquiries');
  select * into q from public.inquiries where id = inquiry and org_id = org;
  if q.id is null or coalesce(btrim(body), '') = '' then
    perform public.forbid();
  end if;
  select * into o from public.organizations where id = org;
  insert into public.inquiry_messages (inquiry_id, sender_id, sender_side, body) values (inquiry, auth.uid(), 'org', left(btrim(body), 2000));
  update public.inquiries set status = 'replied', updated_at = now() where id = inquiry;
  insert into public.notifications (user_id, kind, data, link)
  values (q.patient_id, 'inquiry_reply',
    jsonb_build_object('orgId', org, 'orgNameAr', o.name_ar, 'orgNameEn', o.name_en, 'subject', q.subject),
    '/pharmacy/' || org);
end;
$$;

create function public.set_inquiry_status(org uuid, inquiry uuid, status public.inquiry_status) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_perm(org, 'inquiries');
  update public.inquiries i set status = set_inquiry_status.status where i.id = inquiry and i.org_id = org;
end;
$$;

-- ---------------------------------------------------------------- profile (PH-07)

-- Changing the name or licence of an approved organization sends it back to review.
create function public.update_org_profile(org uuid, patch jsonb) returns boolean
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
    exact_lng = case when patch ? 'exactLng' then (patch ->> 'exactLng')::double precision else exact_lng end
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

-- ---------------------------------------------------------------- team (PH-08)

create function public.org_team(org uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_perm(org, 'member');
  return coalesce((
    select jsonb_agg(t order by t.sort, t.email) from (
      select 0 as sort, m.user_id::text as key, u.email::text as email, p.full_name as "displayName",
        m.member_role as role, m.perms, 'active' as status
      from public.org_members m
      join public.profiles p on p.id = m.user_id
      join auth.users u on u.id = m.user_id
      where m.org_id = org
      union all
      select 1, i.email, i.email, null, i.member_role, i.perms, 'invited'
      from public.org_invitations i where i.org_id = org
    ) t), '[]'::jsonb);
end;
$$;

create function public.invite_member(org uuid, email text, role public.member_role) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  e text := lower(btrim(email));
begin
  perform public.require_owner(org);
  if role = 'owner' or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform public.forbid();
  end if;
  if exists (select 1 from public.org_members m join auth.users u on u.id = m.user_id where m.org_id = org and lower(u.email) = e) then
    return;
  end if;
  perform public.set_action('team.invite');
  insert into public.org_invitations (org_id, email, member_role, perms) values (org, e, role, public.default_perms(role))
  on conflict do nothing;
end;
$$;

-- key = a member's user id, or an invitation's email. The owner cannot be changed here.
create function public.update_member(org uuid, key text, role public.member_role default null, perms jsonb default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.member_role;
begin
  perform public.require_owner(org);
  if role = 'owner' then
    perform public.forbid();
  end if;
  perform public.set_action('team.update');
  if key ~ '^[0-9a-f-]{36}$' then
    select member_role into v_role from public.org_members where org_id = org and user_id = key::uuid;
    if v_role is null or v_role = 'owner' then
      perform public.forbid();
    end if;
    update public.org_members m set
      member_role = coalesce(update_member.role, m.member_role),
      perms = coalesce(update_member.perms, case when update_member.role is not null then public.default_perms(update_member.role) else m.perms end)
    where m.org_id = org and m.user_id = key::uuid;
  else
    update public.org_invitations i set
      member_role = coalesce(update_member.role, i.member_role),
      perms = coalesce(update_member.perms, case when update_member.role is not null then public.default_perms(update_member.role) else i.perms end)
    where i.org_id = org and i.email = lower(key);
    if not found then
      perform public.forbid();
    end if;
  end if;
end;
$$;

create function public.remove_member(org uuid, key text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_owner(org);
  perform public.set_action('team.remove');
  if key ~ '^[0-9a-f-]{36}$' then
    if key::uuid = auth.uid() then
      perform public.forbid();
    end if;
    delete from public.org_members where org_id = org and user_id = key::uuid;
  else
    delete from public.org_invitations where org_id = org and email = lower(key);
  end if;
end;
$$;

-- ---------------------------------------------------------------- registration (A-05, A-06)

create function public.insert_documents(p_org uuid, p_docs jsonb) returns jsonb
language sql security definer set search_path = ''
as $$
  with ins as (
    insert into public.org_documents (org_id, doc_type, file_name, size_bytes, mime, storage_path)
    select p_org, d ->> 'docType', left(d ->> 'fileName', 200), coalesce((d ->> 'size')::integer, 0), coalesce(d ->> 'mime', ''),
      case when coalesce((d ->> 'upload')::boolean, false)
        then p_org || '/' || gen_random_uuid() || '-' || regexp_replace(d ->> 'fileName', '[^A-Za-z0-9._-]+', '_', 'g') end
    from jsonb_array_elements(coalesce(p_docs, '[]'::jsonb)) d
    returning file_name, storage_path
  )
  select coalesce(jsonb_agg(jsonb_build_object('fileName', file_name, 'path', storage_path)) filter (where storage_path is not null), '[]'::jsonb) from ins;
$$;

-- The caller has just signed up or signed in; they become the owner of a pending organization.
-- Returns the organization id and the storage paths to upload each document to.
create function public.register_org(draft jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  a jsonb := draft -> 'account';
  o jsonb := draft -> 'org';
  v_id uuid;
  v_paths jsonb;
begin
  if (select count(*) from public.org_members where user_id = v_uid and member_role = 'owner') >= 5 then
    raise exception 'too_many_orgs' using errcode = 'P0001';
  end if;
  perform public.set_action('verification.submitted');
  insert into public.organizations (type, name_ar, name_en, governorate, area, address_text, landmark, location_precision, phone, whatsapp, hours, verification_status, is_demo)
  values (
    (o ->> 'type')::public.org_type, btrim(o ->> 'nameAr'), btrim(coalesce(o ->> 'nameEn', '')), o ->> 'governorate', coalesce(o ->> 'area', ''),
    btrim(coalesce(o ->> 'addressText', '')), nullif(btrim(o ->> 'landmark'), ''), (o ->> 'locationPrecision')::public.location_precision,
    btrim(coalesce(o ->> 'phone', '')), nullif(btrim(o ->> 'whatsapp'), ''), coalesce(o -> 'hours', '{}'::jsonb), 'pending',
    coalesce((select (value #>> '{}')::boolean from public.settings where key = 'demo_mode'), false))
  returning id into v_id;
  insert into public.organization_private (org_id, license_no, exact_lat, exact_lng, contact_person)
  values (v_id, btrim(coalesce(o ->> 'licenseNo', '')), (o ->> 'lat')::double precision, (o ->> 'lng')::double precision,
    btrim(coalesce(a ->> 'contactName', '')) || ' · ' || btrim(coalesce(a ->> 'contactRole', '')));
  insert into public.org_members (org_id, user_id, member_role, perms) values (v_id, v_uid, 'owner', public.default_perms('owner'));
  insert into public.verification_events (org_id, action, actor_id) values (v_id, 'submitted', v_uid);
  v_paths := public.insert_documents(v_id, draft -> 'documents');
  return jsonb_build_object('orgId', v_id, 'uploads', v_paths);
end;
$$;

-- «استكمال الطلب»: a needs_info application goes back to review with the applicant's note.
create function public.resubmit_org(org uuid, note text, documents jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_paths jsonb;
begin
  perform public.require_owner(org);
  if (select verification_status from public.organizations where id = org) <> 'needs_info' then
    perform public.forbid();
  end if;
  perform public.set_action('verification.resubmitted');
  update public.organizations set verification_status = 'pending' where id = org;
  insert into public.verification_events (org_id, action, note, actor_id) values (org, 'resubmitted', nullif(btrim(note), ''), auth.uid());
  v_paths := public.insert_documents(org, documents);
  return jsonb_build_object('uploads', v_paths);
end;
$$;
