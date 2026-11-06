-- 0011 · Fixes after phase 6 review.
-- 1) A suspended account loses its access in RLS too, not only in the RPCs (require_user):
--    is_platform, has_org_perm and is_org_owner now ignore suspended profiles.
-- 2) A reply from a hospital or medical point links the patient to /org/<id>, not /pharmacy/<id>.
-- 3) AD-01's «content to review» counts what AD-08 lists: pending services and organization announcements.

create or replace function public.is_platform(r public.platform_role) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.suspended_at is null
      and (p.platform_role = r or (r = 'reviewer' and p.platform_role = 'super_admin'))
  );
$$;

create or replace function public.has_org_perm(p_org uuid, p_perm text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
    join public.profiles p on p.id = m.user_id
    where m.org_id = p_org and m.user_id = auth.uid()
      and p.suspended_at is null
      and (p_perm = 'member' or coalesce((m.perms ->> p_perm)::boolean, false))
  );
$$;

create or replace function public.is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
    join public.profiles p on p.id = m.user_id
    where m.org_id = p_org and m.user_id = auth.uid() and m.member_role = 'owner'
      and p.suspended_at is null
  );
$$;

create or replace function public.reply_inquiry(org uuid, inquiry uuid, body text) returns void
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
    case when o.type = 'pharmacy' then '/pharmacy/' || org else '/org/' || org end);
end;
$$;

create or replace function public.admin_overview() returns jsonb
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
      'announcements', (select count(*) from public.announcements where review_status = 'pending' and org_id is not null)
        + (select count(*) from public.services where review_status = 'pending'))
  ) into r;
  return r;
end;
$$;
