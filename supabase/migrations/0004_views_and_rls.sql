-- MADAD 0004 · public views, RLS on every table, table privileges (SPEC §13).

-- ---------------------------------------------------------------- views

-- The public availability view: matches displayOf() in src/lib/freshness.ts. No quantity, no reporter.
-- governorate is added so searches can filter by area without reading organizations separately.
create view public.public_availability with (security_invoker = true) as
select s.pharmacy_id, s.medicine_id, o.governorate, s.reported_status, s.reported_at,
  case
    when now() - s.reported_at > make_interval(hours => cfg.expire_h) then 'unconfirmed'
    when s.reported_status = 'unavailable' then 'unavailable'
    when now() - s.reported_at > make_interval(hours => cfg.fresh_h) then 'needs_update'
    else s.reported_status::text
  end as display_status,
  case when now() - s.reported_at <= make_interval(hours => cfg.expire_h)
        and now() - s.price_updated_at <= make_interval(days => cfg.price_d)
       then s.price_ils end as price_ils,
  s.price_updated_at
from public.pharmacy_stock s
join public.organizations o on o.id = s.pharmacy_id and o.verification_status = 'approved'
cross join lateral (
  select
    (select (value #>> '{}')::int from public.settings where key = 'fresh_hours') as fresh_h,
    (select (value #>> '{}')::int from public.settings where key = 'expire_hours') as expire_h,
    (select (value #>> '{}')::int from public.settings where key = 'price_max_days') as price_d
) cfg
where s.is_listed and not s.hidden_by_admin;

-- "آخر تحديث للتوفر" per public pharmacy (P-04, P-06).
create view public.public_pharmacy_updates with (security_invoker = true) as
select pharmacy_id, max(reported_at) as last_stock_update_at
from public.public_availability
group by pharmacy_id;

-- ---------------------------------------------------------------- privileges
-- Supabase grants everything to anon and authenticated by default; RLS then filters rows.
-- Writes are closed here and reopened only where a policy below allows them. Everything else
-- goes through SECURITY DEFINER functions that check has_org_perm() / is_platform().

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on public.search_logs, public.page_views, public.audit_log from anon;
revoke all on public.search_logs, public.page_views from authenticated;
revoke all on public.stock_private, public.organization_private from anon;

grant update (full_name, phone, locale, default_gov) on public.profiles to authenticated;
grant insert, delete on public.favorites to authenticated;
grant insert on public.availability_alerts to authenticated;
grant update (active) on public.availability_alerts to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert (entity_type, entity_id, reason, details, governorate) on public.reports to anon, authenticated;
grant update (status, admin_note, resolution) on public.reports to authenticated;
grant insert, update (quantity, low_threshold) on public.stock_private to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_private enable row level security;
alter table public.org_members enable row level security;
alter table public.org_invitations enable row level security;
alter table public.org_documents enable row level security;
alter table public.verification_events enable row level security;
alter table public.categories enable row level security;
alter table public.medicines enable row level security;
alter table public.pharmacy_stock enable row level security;
alter table public.stock_private enable row level security;
alter table public.stock_history enable row level security;
alter table public.services enable row level security;
alter table public.announcements enable row level security;
alter table public.inquiries enable row level security;
alter table public.inquiry_messages enable row level security;
alter table public.favorites enable row level security;
alter table public.availability_alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.search_logs enable row level security;
alter table public.page_views enable row level security;
alter table public.reports enable row level security;
alter table public.audit_log enable row level security;
alter table public.settings enable row level security;

-- profiles: your own row; reviewers read all (names in AD-02, AD-10).
create policy profiles_own_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_reviewer_read on public.profiles for select to authenticated using (public.is_platform('reviewer'));
create policy profiles_own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- organizations: approved ones are public; members see their own in any state; reviewers see all.
create policy organizations_public_read on public.organizations for select to anon, authenticated using (verification_status = 'approved');
create policy organizations_member_read on public.organizations for select to authenticated using (public.has_org_perm(id, 'member'));
create policy organizations_reviewer_read on public.organizations for select to authenticated using (public.is_platform('reviewer'));

-- organization_private: members and reviewers only. No public policy at all.
create policy organization_private_member_read on public.organization_private for select to authenticated using (public.has_org_perm(org_id, 'member'));
create policy organization_private_reviewer_read on public.organization_private for select to authenticated using (public.is_platform('reviewer'));

create policy org_members_own_read on public.org_members for select to authenticated using (user_id = auth.uid());
create policy org_members_team_read on public.org_members for select to authenticated using (public.has_org_perm(org_id, 'member'));
create policy org_members_reviewer_read on public.org_members for select to authenticated using (public.is_platform('reviewer'));

create policy org_invitations_member_read on public.org_invitations for select to authenticated using (public.has_org_perm(org_id, 'member'));

create policy org_documents_member_read on public.org_documents for select to authenticated using (public.has_org_perm(org_id, 'member'));
create policy org_documents_reviewer_read on public.org_documents for select to authenticated using (public.is_platform('reviewer'));

create policy verification_events_member_read on public.verification_events for select to authenticated using (public.has_org_perm(org_id, 'member'));
create policy verification_events_reviewer_read on public.verification_events for select to authenticated using (public.is_platform('reviewer'));

create policy categories_public_read on public.categories for select to anon, authenticated using (true);

-- medicines: the approved catalog is public; a pharmacy sees its own requests; reviewers see all.
create policy medicines_public_read on public.medicines for select to anon, authenticated using (status = 'approved');
create policy medicines_requester_read on public.medicines for select to authenticated
  using (requested_by_org is not null and public.has_org_perm(requested_by_org, 'member'));
create policy medicines_reviewer_read on public.medicines for select to authenticated using (public.is_platform('reviewer'));

-- pharmacy_stock: the public sees published rows of approved pharmacies only (the view relies on this).
create policy pharmacy_stock_public_read on public.pharmacy_stock for select to anon, authenticated
  using (is_listed and not hidden_by_admin
    and exists (select 1 from public.organizations o where o.id = pharmacy_id and o.verification_status = 'approved'));
create policy pharmacy_stock_member_read on public.pharmacy_stock for select to authenticated using (public.has_org_perm(pharmacy_id, 'member'));
create policy pharmacy_stock_reviewer_read on public.pharmacy_stock for select to authenticated using (public.is_platform('reviewer'));

-- stock_private: members with the medicines permission only (docs/DECISIONS.md, phases 2–3 #1).
create policy stock_private_member_read on public.stock_private for select to authenticated using (public.has_org_perm(pharmacy_id, 'medicines'));
create policy stock_private_member_insert on public.stock_private for insert to authenticated with check (public.has_org_perm(pharmacy_id, 'medicines'));
create policy stock_private_member_update on public.stock_private for update to authenticated
  using (public.has_org_perm(pharmacy_id, 'medicines')) with check (public.has_org_perm(pharmacy_id, 'medicines'));

create policy stock_history_member_read on public.stock_history for select to authenticated using (public.has_org_perm(pharmacy_id, 'member'));
create policy stock_history_reviewer_read on public.stock_history for select to authenticated using (public.is_platform('reviewer'));

create policy services_public_read on public.services for select to anon, authenticated
  using (review_status = 'approved'
    and exists (select 1 from public.organizations o where o.id = org_id and o.verification_status = 'approved'));
create policy services_member_read on public.services for select to authenticated using (public.has_org_perm(org_id, 'member'));
create policy services_reviewer_read on public.services for select to authenticated using (public.is_platform('reviewer'));

create policy announcements_public_read on public.announcements for select to anon, authenticated
  using (review_status = 'approved' and starts_at <= now() and (ends_at is null or ends_at > now())
    and (org_id is null or exists (select 1 from public.organizations o where o.id = org_id and o.verification_status = 'approved')));
create policy announcements_member_read on public.announcements for select to authenticated using (org_id is not null and public.has_org_perm(org_id, 'member'));
create policy announcements_reviewer_read on public.announcements for select to authenticated using (public.is_platform('reviewer'));

-- inquiries: the patient who sent it, and the organization it was sent to.
create policy inquiries_patient_read on public.inquiries for select to authenticated using (patient_id = auth.uid());
create policy inquiries_org_read on public.inquiries for select to authenticated using (public.has_org_perm(org_id, 'member'));
create policy inquiry_messages_read on public.inquiry_messages for select to authenticated
  using (exists (select 1 from public.inquiries q where q.id = inquiry_id and (q.patient_id = auth.uid() or public.has_org_perm(q.org_id, 'member'))));

create policy favorites_own on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_own_insert on public.favorites for insert to authenticated with check (user_id = auth.uid());
create policy favorites_own_delete on public.favorites for delete to authenticated using (user_id = auth.uid());

create policy alerts_own on public.availability_alerts for select to authenticated using (user_id = auth.uid());
create policy alerts_own_insert on public.availability_alerts for insert to authenticated
  with check (user_id = auth.uid() and active and notified_at is null);
create policy alerts_own_update on public.availability_alerts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- search_logs and page_views: no policy for anyone. Written by log_search() / view_pharmacy(),
-- read only in aggregate through unmet_demand(), admin_overview() and portal_overview().

-- reports: anyone may send one (P-13); reviewers handle them (AD-07).
create policy reports_insert on public.reports for insert to anon, authenticated with check (status = 'new');
create policy reports_reviewer_read on public.reports for select to authenticated using (public.is_platform('reviewer'));
create policy reports_reviewer_update on public.reports for update to authenticated
  using (public.is_platform('reviewer')) with check (public.is_platform('reviewer'));

-- audit_log: the system admin reads; nobody inserts, updates or deletes from the client.
create policy audit_log_admin_read on public.audit_log for select to authenticated using (public.is_platform('super_admin'));

create policy settings_public_read on public.settings for select to anon, authenticated using (is_public);
create policy settings_reviewer_read on public.settings for select to authenticated using (public.is_platform('reviewer'));
