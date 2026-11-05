-- MADAD 0008 · Storage for verification documents, and who may call which function (SPEC §13).

-- ---------------------------------------------------------------- storage: org-docs (private)
-- Objects live at "<org_id>/<file>". The organization uploads to its own folder; reviewers read
-- through short-lived signed links. Nobody else can list or read them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-docs', 'org-docs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create function public.folder_org(object_name text) returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create policy org_docs_member_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'org-docs' and public.has_org_perm(public.folder_org(name), 'member'));
create policy org_docs_member_read on storage.objects for select to authenticated
  using (bucket_id = 'org-docs' and public.has_org_perm(public.folder_org(name), 'member'));
create policy org_docs_reviewer_read on storage.objects for select to authenticated
  using (bucket_id = 'org-docs' and public.is_platform('reviewer'));

-- ---------------------------------------------------------------- function privileges
-- Postgres lets PUBLIC execute new functions. Close all of them, then open the API one by one.

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- Used inside policies, views and generated columns, so the calling role needs them.
grant execute on function
  public.normalize_ar(text), public.phonetic_ar(text), public.freshness_of(timestamptz, timestamptz, integer, integer),
  public.medicine_search_text(text, text, text, text, text, text[], text),
  public.is_platform(public.platform_role), public.has_org_perm(uuid, text), public.folder_org(text)
to anon, authenticated;

-- Visitors and patients.
grant execute on function
  public.search_medicines(text, text, integer), public.log_search(text, text, text, integer),
  public.top_searched(text, integer), public.view_pharmacy(uuid), public.demo_reset()
to anon, authenticated;

grant execute on function
  public.send_inquiry(uuid, text, text, text), public.delete_my_account(),
  -- organization members (each checks has_org_perm)
  public.update_stock(uuid, jsonb), public.confirm_all(uuid, boolean),
  public.stock_add(uuid, text, public.reported_status), public.stock_remove(uuid, text), public.stock_set_listed(uuid, text, boolean),
  public.portal_overview(uuid), public.request_medicine(uuid, jsonb),
  public.reply_inquiry(uuid, uuid, text), public.set_inquiry_status(uuid, uuid, public.inquiry_status),
  public.update_org_profile(uuid, jsonb), public.org_team(uuid),
  public.invite_member(uuid, text, public.member_role), public.update_member(uuid, text, public.member_role, jsonb),
  public.remove_member(uuid, text), public.register_org(jsonb), public.resubmit_org(uuid, text, jsonb),
  -- the MADAD team (each checks is_platform)
  public.admin_overview(), public.review_org(uuid, text, text), public.set_document_status(uuid, text, public.document_status),
  public.suspend_org(uuid, text), public.reactivate_org(uuid), public.add_medicine(jsonb), public.set_aliases(text, text[]),
  public.import_catalog(jsonb), public.review_medicine(text, text, text), public.remind_pharmacy(uuid),
  public.hide_report(uuid, text, text), public.unmet_demand(timestamptz, timestamptz, text[], text), public.update_settings(jsonb)
to authenticated;
