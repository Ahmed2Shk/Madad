-- MADAD 0005 · RPC for visitors and patients (SPEC §13 «دوال RPC»).

-- search_medicines(q, gov): read-only. Same rules as matchCatalog() in src/lib/search.ts: every
-- query word must appear in search_text; a barcode matches exactly; the phonetic key is a fallback
-- used only when the normal pass finds nothing. Logging is separate (log_search, after «بحث» only).
create function public.search_medicines(q text, gov text default 'all', lim integer default 20)
returns table (medicine_id text, fresh_pharmacies integer)
language plpgsql stable set search_path = ''
as $$
declare
  nq text := public.normalize_ar(left(q, 200));
  v_tokens text[];
  v_ids text[];
begin
  if nq = '' then
    return;
  end if;
  lim := least(greatest(coalesce(lim, 20), 1), 50);

  if nq ~ '^[0-9]{8,14}$' then
    select array_agg(m.id order by m.sort_order) into v_ids
    from (select id, sort_order from public.medicines where status = 'approved' and barcode = nq order by sort_order limit lim) m;
  else
    v_tokens := string_to_array(nq, ' ');
    select array_agg(x.id order by x.score, x.sort_order) into v_ids
    from (
      select m.id, m.sort_order,
        (case when public.normalize_ar(m.name_ar || ' ' || m.name_en) like replace(v_tokens[1], '%', '\%') || '%' then 0 else 1 end)
        + (case when position(v_tokens[1] in public.normalize_ar(m.name_ar || ' ' || m.name_en)) > 0 then 0 else 1 end) as score
      from public.medicines m
      where m.status = 'approved'
        and m.search_text like all (select '%' || replace(t, '%', '\%') || '%' from unnest(v_tokens) t)
      order by score, m.sort_order
      limit lim
    ) x;

    if v_ids is null then
      v_tokens := string_to_array(public.phonetic_ar(nq), ' ');
      select array_agg(x.id order by x.score, x.sort_order) into v_ids
      from (
        select m.id, m.sort_order,
          (case when public.phonetic_ar(m.name_ar || ' ' || m.name_en) like replace(v_tokens[1], '%', '\%') || '%' then 0 else 1 end)
          + (case when position(v_tokens[1] in public.phonetic_ar(m.name_ar || ' ' || m.name_en)) > 0 then 0 else 1 end) as score
        from public.medicines m
        where m.status = 'approved'
          and translate(m.search_text, 'صثطضذظ', 'سستدزز') like all (select '%' || replace(t, '%', '\%') || '%' from unnest(v_tokens) t)
        order by score, m.sort_order
        limit lim
      ) x;
    end if;
  end if;

  return query
  select i.id,
    (select count(distinct a.pharmacy_id)::integer from public.public_availability a
      where a.medicine_id = i.id and a.display_status in ('available', 'limited')
        and (gov is null or gov = 'all' or a.governorate = gov))
  from unnest(coalesce(v_ids, '{}'::text[])) with ordinality as i(id, n)
  order by i.n;
end;
$$;

-- log_search: called only after the user presses «بحث» or picks a suggestion. No identity stored.
create function public.log_search(q text, gov text, medicine text default null, result_count integer default 0)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(btrim(q), '') = '' then
    return;
  end if;
  insert into public.search_logs (query_norm, medicine_id, governorate, result_count)
  values (
    left(public.normalize_ar(q), 200),
    (select id from public.medicines where id = medicine and status = 'approved'),
    left(coalesce(gov, 'all'), 40),
    greatest(coalesce(result_count, 0), 0)
  );
end;
$$;

-- Most searched medicines over 30 days (P-01). Aggregated counts only.
create function public.top_searched(gov text default 'all', lim integer default 5)
returns table (medicine_id text, count integer)
language sql stable security definer set search_path = ''
as $$
  select l.medicine_id, count(*)::integer
  from public.search_logs l
  join public.medicines m on m.id = l.medicine_id and m.status = 'approved'
  where l.created_at >= now() - interval '30 days'
    and (gov is null or gov = 'all' or l.governorate = gov)
  group by l.medicine_id
  -- Ties: the most recently searched first, as in mock mode.
  order by count(*) desc, max(l.created_at) desc, l.medicine_id
  limit least(greatest(coalesce(lim, 5), 1), 50);
$$;

-- Anonymous daily counter for «مشاهدات صفحتك» (PH-01).
create function public.view_pharmacy(pharmacy uuid) returns void
language sql security definer set search_path = ''
as $$
  insert into public.page_views (pharmacy_id, day, count)
  select o.id, (now() at time zone 'utc')::date, 1
  from public.organizations o
  where o.id = pharmacy and o.type = 'pharmacy' and o.verification_status = 'approved'
  on conflict (pharmacy_id, day) do update set count = public.page_views.count + 1;
$$;

-- P-09: a signed-in patient asks an approved organization.
create function public.send_inquiry(org uuid, medicine text, subject text, body text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_id uuid;
begin
  if not exists (select 1 from public.organizations where id = org and verification_status = 'approved') then
    perform public.forbid();
  end if;
  insert into public.inquiries (org_id, patient_id, medicine_id, subject)
  values (org, v_uid, (select id from public.medicines where id = medicine), left(btrim(subject), 200))
  returning id into v_id;
  insert into public.inquiry_messages (inquiry_id, sender_id, sender_side, body)
  values (v_id, v_uid, 'patient', left(btrim(body), 2000));
  return v_id;
end;
$$;

-- P-12 «حذف الحساب». Demo accounts are shared, so only their data is cleared (as in mock mode);
-- any other account is deleted from Supabase Auth, which cascades to everything it owns.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
  if exists (
    select 1 from public.org_members m
    where m.user_id = v_uid and m.member_role = 'owner'
      and not exists (select 1 from public.org_members o where o.org_id = m.org_id and o.member_role = 'owner' and o.user_id <> v_uid)
  ) then
    raise exception 'owner_of_org' using errcode = 'P0001';
  end if;
  if (select is_demo from public.profiles where id = v_uid) then
    delete from public.favorites where user_id = v_uid;
    delete from public.availability_alerts where user_id = v_uid;
    delete from public.notifications where user_id = v_uid;
    delete from public.inquiries where patient_id = v_uid;
  else
    delete from auth.users where id = v_uid;
  end if;
end;
$$;

-- Internal: called by update_stock. People waiting for this medicine in this governorate are
-- notified once, and their alert stops (docs/DECISIONS.md, phase 1 #4).
create function public.notify_alerts(p_pharmacy uuid, p_medicine text, p_gov text) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  with met as (
    update public.availability_alerts a
    set active = false, notified_at = now()
    where a.active and a.medicine_id = p_medicine and (a.governorate = 'all' or a.governorate = p_gov)
    returning a.user_id
  )
  insert into public.notifications (user_id, kind, data, link)
  select met.user_id, 'alert_met',
    jsonb_build_object('pharmacyId', p_pharmacy, 'medicineId', p_medicine, 'governorate', p_gov),
    '/medicine/' || p_medicine || '?gov=' || p_gov
  from met;
  get diagnostics n = row_count;
  return n;
end;
$$;
