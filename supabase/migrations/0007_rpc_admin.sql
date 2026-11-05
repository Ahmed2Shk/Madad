-- MADAD 0007 · RPC for the MADAD team (SPEC §10, §13). Reviewers: is_platform('reviewer');
-- settings: super_admin. The admin can hide or suspend, but never create availability.

create function public.require_platform(r public.platform_role) returns void
language plpgsql stable set search_path = ''
as $$
begin
  perform public.require_user();
  if not public.is_platform(r) then
    perform public.forbid();
  end if;
end;
$$;

create function public.notify_members(p_org uuid, p_kind text, p_data jsonb, p_link text) returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, kind, data, link)
  select m.user_id, p_kind, p_data, p_link from public.org_members m where m.org_id = p_org;
$$;

-- ---------------------------------------------------------------- AD-01

create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_fh integer := public.setting_int('fresh_hours');
  v_eh integer := public.setting_int('expire_hours');
  v_today date := (now() at time zone 'utc')::date;
  r jsonb;
begin
  perform public.require_platform('reviewer');

  with ph as (
    select id, governorate from public.organizations where type = 'pharmacy' and verification_status = 'approved'
  ), st as (
    select s.pharmacy_id, ph.governorate, public.freshness_of(s.reported_at, now(), v_fh, v_eh) as f
    from public.pharmacy_stock s join ph on ph.id = s.pharmacy_id
    where s.is_listed and not s.hidden_by_admin
  ), logs as (
    select (created_at at time zone 'utc')::date as day, governorate, medicine_id, result_count
    from public.search_logs where created_at >= now() - interval '30 days'
  ), per_ph as (
    select pharmacy_id, governorate, count(*) filter (where f = 'fresh')::numeric / count(*) as ratio from st group by 1, 2
  )
  select jsonb_build_object(
    'verifiedPharmacies', (select count(*) from ph),
    'verifiedProviders', (select count(*) from public.organizations where type <> 'pharmacy' and verification_status = 'approved'),
    'pendingVerifications', (select count(*) from public.organizations where verification_status in ('pending', 'needs_info')),
    'catalogSize', (select count(*) from public.medicines where status = 'approved'),
    'freshRatio', coalesce((select count(*) filter (where f = 'fresh')::numeric / nullif(count(*), 0) from st), 0),
    'searchesToday', (select count(*) from logs where day = v_today),
    'failedToday', (select count(*) from logs where day = v_today and result_count = 0),
    'openReports', (select count(*) from public.reports where status in ('new', 'in_review')),
    'daily', (
      select jsonb_agg(jsonb_build_object('date', to_char(g.d, 'YYYY-MM-DD'),
        'searches', (select count(*) from logs where day = g.d::date),
        'failed', (select count(*) from logs where day = g.d::date and result_count = 0)) order by g.d)
      from generate_series(v_today - 29, v_today, interval '1 day') g(d)),
    'freshnessByGov', coalesce((
      select jsonb_agg(jsonb_build_object('governorate', g.governorate, 'fresh', g.fresh, 'stale', g.stale, 'expired', g.expired))
      from (
        select x.governorate,
          count(*) filter (where x.f = 'fresh') as fresh, count(*) filter (where x.f = 'stale') as stale, count(*) filter (where x.f = 'expired') as expired
        from (select ph.governorate, st.f from ph left join st on st.pharmacy_id = ph.id) x
        group by x.governorate
      ) g), '[]'::jsonb),
    'topUnmet', coalesce((
      select jsonb_agg(jsonb_build_object('medicineId', medicine_id, 'count', n) order by n desc, medicine_id)
      from (select medicine_id, count(*) as n from logs where result_count = 0 and medicine_id is not null
            group by medicine_id order by n desc, medicine_id limit 10) t), '[]'::jsonb),
    'byGov', coalesce((
      select jsonb_agg(jsonb_build_object('governorate', g.gov,
        'pharmacies', (select count(*) from ph where ph.governorate = g.gov),
        'stalePharmacies', (select count(*) from per_ph where per_ph.governorate = g.gov and ratio < 0.5),
        'failedSearches', (select count(*) from logs where logs.governorate = g.gov and result_count = 0)))
      from (select governorate as gov from ph union select governorate from logs where result_count = 0) g), '[]'::jsonb),
    'pending', jsonb_build_object(
      'pharmacies', (select count(*) from public.organizations where type = 'pharmacy' and verification_status in ('pending', 'needs_info')),
      'medicines', (select count(*) from public.medicines where status = 'pending'),
      'reports', (select count(*) from public.reports where status = 'new'),
      'announcements', (select count(*) from public.announcements where review_status = 'pending'))
  ) into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------- AD-02 / AD-03

-- review_org(org, decision, note): the note is required for needs_info and reject.
create function public.review_org(org uuid, decision text, note text default '') returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.verification_status;
  o public.organizations;
begin
  perform public.require_platform('reviewer');
  if decision not in ('approve', 'needs_info', 'reject') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;
  if decision <> 'approve' and coalesce(btrim(note), '') = '' then
    raise exception 'note_required' using errcode = 'P0001';
  end if;
  v_status := case decision when 'approve' then 'approved' when 'needs_info' then 'needs_info' else 'rejected' end;
  perform public.set_action('verification.' || decision, nullif(btrim(note), ''));
  update public.organizations set verification_status = v_status, suspended_reason = null where id = org returning * into o;
  if o.id is null then
    perform public.forbid();
  end if;
  update public.organization_private set reviewer_notes = nullif(btrim(note), '') where org_id = org;
  insert into public.verification_events (org_id, action, note, actor_id)
  values (org, case v_status when 'approved' then 'approved' when 'needs_info' then 'needs_info' else 'rejected' end, nullif(btrim(note), ''), auth.uid());
  if decision = 'approve' then
    perform public.set_action('verification.document');
    update public.org_documents set status = 'accepted' where org_id = org and status = 'pending';
  end if;
  perform public.notify_members(org, 'verification',
    jsonb_build_object('status', v_status, 'orgNameAr', o.name_ar, 'orgNameEn', o.name_en), '/register/status');
end;
$$;

create function public.set_document_status(org uuid, file_name text, status public.document_status) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_platform('reviewer');
  perform public.set_action('verification.document');
  update public.org_documents d set status = set_document_status.status
  where d.org_id = org and d.file_name = set_document_status.file_name;
end;
$$;

create function public.suspend_org(org uuid, reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_platform('reviewer');
  if coalesce(btrim(reason), '') = '' then
    raise exception 'note_required' using errcode = 'P0001';
  end if;
  perform public.set_action('organization.suspend', btrim(reason));
  update public.organizations set verification_status = 'suspended', suspended_reason = btrim(reason) where id = org;
end;
$$;

create function public.reactivate_org(org uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_platform('reviewer');
  perform public.set_action('organization.reactivate');
  update public.organizations set verification_status = 'approved', suspended_reason = null where id = org and verification_status = 'suspended';
end;
$$;

-- ---------------------------------------------------------------- AD-04 catalog

create function public.add_medicine(input jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_platform('reviewer');
  perform public.set_action('catalog.add');
  return public.medicine_row(input, 'approved', null);
end;
$$;

create function public.set_aliases(medicine text, aliases text[]) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_platform('reviewer');
  perform public.set_action('catalog.aliases');
  update public.medicines m set aliases = coalesce(array(select btrim(a) from unnest(set_aliases.aliases) a where btrim(a) <> ''), '{}')
  where m.id = medicine;
end;
$$;

-- CSV import: rows that match an existing medicine (barcode, or English name + strength) are skipped.
create function public.import_catalog(rows jsonb) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r jsonb;
  added integer := 0;
begin
  perform public.require_platform('reviewer');
  if jsonb_typeof(rows) is distinct from 'array' or jsonb_array_length(rows) > 2000 then
    raise exception 'invalid_rows' using errcode = '22023';
  end if;
  perform set_config('madad.audit', 'off', true);
  for r in select value from jsonb_array_elements(rows) loop
    continue when exists (
      select 1 from public.medicines m
      where m.status = 'approved'
        and ((nullif(btrim(r ->> 'barcode'), '') is not null and m.barcode = btrim(r ->> 'barcode'))
          or (lower(m.name_en) = lower(btrim(r ->> 'nameEn')) and m.strength = btrim(coalesce(r ->> 'strength', '')))));
    perform public.medicine_row(r, 'approved', null);
    added := added + 1;
  end loop;
  perform set_config('madad.audit', '', true);
  perform public.write_audit('catalog.import', 'medicine', 'csv', null, jsonb_build_object('rows', jsonb_array_length(rows), 'added', added));
  return added;
end;
$$;

-- review_medicine(id, decision, merge_into): approve, merge into an existing medicine (its names
-- become search aliases of the target), or reject.
create function public.review_medicine(id text, decision text, merge_into text default null) returns void
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
end;
$$;

-- ---------------------------------------------------------------- AD-05 data quality

create function public.remind_pharmacy(pharmacy uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_platform('reviewer');
  perform public.notify_members(pharmacy, 'platform', '{"key":"remindUpdate"}'::jsonb, '/pharmacy-portal/update?filter=needs');
  perform public.write_audit('quality.remind', 'organization', pharmacy::text, null, null);
end;
$$;

-- Hides one report from the public, with a reason. There is deliberately no "confirm availability".
create function public.hide_report(pharmacy uuid, medicine text, reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_status public.reported_status;
begin
  perform public.require_platform('reviewer');
  if coalesce(btrim(reason), '') = '' then
    raise exception 'note_required' using errcode = 'P0001';
  end if;
  perform public.set_action('quality.hide_report', btrim(reason));
  update public.pharmacy_stock set hidden_by_admin = true
  where pharmacy_id = pharmacy and medicine_id = medicine and not hidden_by_admin
  returning reported_status into v_status;
  if found then
    insert into public.stock_history (pharmacy_id, medicine_id, action, old_status, actor_id) values (pharmacy, medicine, 'hide', v_status, auth.uid());
  end if;
end;
$$;

-- ---------------------------------------------------------------- AD-06 unmet demand

-- unmet_demand(from, to, governorates, category): failed searches per medicine × governorate,
-- suppressed here so the browser never receives a cell under 5 (docs/DECISIONS.md, pre-phase 0 #3):
-- a row or column total that contains a hidden cell is hidden too. Search texts that matched nothing
-- appear only from 5 searches up.
create function public.unmet_demand(from_at timestamptz, to_at timestamptz, governorates text[], category text default 'all')
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  min_cell constant integer := 5;
  v_ids text[];
  v_cells jsonb := '[]'::jsonb;
  v_row jsonb;
  v_row_totals jsonb := '[]'::jsonb;
  v_col_totals jsonb := '[]'::jsonb;
  v_counts integer[][];
  v_has_hidden boolean;
  v_sum integer;
  v_total integer := 0;
  v_n integer;
  i integer;
  j integer;
  n_gov integer := coalesce(array_length(governorates, 1), 0);
begin
  perform public.require_platform('reviewer');

  select array_agg(medicine_id order by n desc, medicine_id) into v_ids
  from (
    select f.medicine_id, count(*) as n
    from public.search_logs f join public.medicines m on m.id = f.medicine_id where f.result_count = 0 and f.created_at >= from_at and f.created_at <= to_at and f.governorate = any (governorates)
      and (category = 'all' or m.category_id = category)
    group by f.medicine_id
    order by n desc, f.medicine_id
    limit 15
  ) t;
  v_ids := coalesce(v_ids, '{}');

  -- counts[i][j]: medicine i, governorate j.
  if array_length(v_ids, 1) > 0 and n_gov > 0 then
    v_counts := array_fill(0, array[array_length(v_ids, 1), n_gov]);
    for i in 1 .. array_length(v_ids, 1) loop
      for j in 1 .. n_gov loop
        select count(*) into v_n from public.search_logs l where l.result_count = 0 and l.created_at >= from_at and l.created_at <= to_at
          and l.medicine_id = v_ids[i] and l.governorate = governorates[j];
        v_counts[i][j] := v_n;
      end loop;
    end loop;

    for i in 1 .. array_length(v_ids, 1) loop
      v_row := '[]'::jsonb;
      v_has_hidden := false;
      v_sum := 0;
      for j in 1 .. n_gov loop
        v_n := v_counts[i][j];
        v_sum := v_sum + v_n;
        if v_n > 0 and v_n < min_cell then
          v_row := v_row || 'null'::jsonb;
          v_has_hidden := true;
        else
          v_row := v_row || to_jsonb(v_n);
        end if;
      end loop;
      v_total := v_total + v_sum;
      v_cells := v_cells || jsonb_build_array(v_row);
      v_row_totals := v_row_totals || case when v_has_hidden then 'null'::jsonb else to_jsonb(v_sum) end;
    end loop;

    for j in 1 .. n_gov loop
      v_has_hidden := false;
      v_sum := 0;
      for i in 1 .. array_length(v_ids, 1) loop
        v_n := v_counts[i][j];
        v_sum := v_sum + v_n;
        v_has_hidden := v_has_hidden or (v_n > 0 and v_n < min_cell);
      end loop;
      v_col_totals := v_col_totals || case when v_has_hidden then 'null'::jsonb else to_jsonb(v_sum) end;
    end loop;
  elsif n_gov > 0 then
    select jsonb_agg(0) into v_col_totals from generate_series(1, n_gov);
  end if;

  return jsonb_build_object(
    'governorates', to_jsonb(coalesce(governorates, '{}')),
    'medicineIds', to_jsonb(v_ids),
    'matrix', jsonb_build_object('cells', v_cells, 'rowTotals', v_row_totals, 'colTotals', v_col_totals, 'total', v_total),
    'unmatched', coalesce((
      select jsonb_agg(jsonb_build_object('query', query_norm, 'count', n) order by n desc, query_norm)
      from (select l.query_norm, count(*)::integer as n from public.search_logs l where l.result_count = 0 and l.created_at >= from_at and l.created_at <= to_at and l.governorate = any (governorates) and l.medicine_id is null
            group by l.query_norm having count(*) >= min_cell) u), '[]'::jsonb),
    'failedTotal', (select count(*) from public.search_logs l where l.result_count = 0 and l.created_at >= from_at and l.created_at <= to_at and l.governorate = any (governorates)));
end;
$$;

-- ---------------------------------------------------------------- AD-11 settings

create function public.update_settings(patch jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_fh integer := coalesce((patch ->> 'freshHours')::integer, public.setting_int('fresh_hours'));
  v_eh integer := coalesce((patch ->> 'expireHours')::integer, public.setting_int('expire_hours'));
  v_pd integer := coalesce((patch ->> 'priceMaxDays')::integer, public.setting_int('price_max_days'));
  v_cd integer := coalesce((patch ->> 'programConfirmDays')::integer, public.setting_int('program_confirm_days'));
begin
  perform public.require_platform('super_admin');
  if least(v_fh, v_eh, v_pd, v_cd) < 1 or v_fh >= v_eh then
    raise exception 'invalid_settings' using errcode = '22023';
  end if;
  perform public.set_action('settings.update');
  update public.settings set value = to_jsonb(v_fh) where key = 'fresh_hours' and patch ? 'freshHours';
  update public.settings set value = to_jsonb(v_eh) where key = 'expire_hours' and patch ? 'expireHours';
  update public.settings set value = to_jsonb(v_pd) where key = 'price_max_days' and patch ? 'priceMaxDays';
  update public.settings set value = to_jsonb(v_cd) where key = 'program_confirm_days' and patch ? 'programConfirmDays';
  update public.settings set value = coalesce(patch -> 'disclaimerAr', 'null'::jsonb) where key = 'disclaimer_ar' and patch ? 'disclaimerAr';
  update public.settings set value = coalesce(patch -> 'disclaimerEn', 'null'::jsonb) where key = 'disclaimer_en' and patch ? 'disclaimerEn';
  update public.settings set value = patch -> 'requiredDocs' where key = 'required_docs' and jsonb_typeof(patch -> 'requiredDocs') = 'object';
  update public.settings set value = patch -> 'rejectionReasons' where key = 'rejection_reasons' and jsonb_typeof(patch -> 'rejectionReasons') = 'array';
end;
$$;

-- ---------------------------------------------------------------- demo

-- «إعادة ضبط بيانات العرض» (SPEC §4): restores the seeds on a demo project only (demo_mode = true).
-- public.demo_seed() is created by supabase/seed.sql.
create function public.demo_reset() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce((select (value #>> '{}')::boolean from public.settings where key = 'demo_mode'), false) then
    perform public.forbid();
  end if;
  execute 'select public.demo_seed()';
end;
$$;
