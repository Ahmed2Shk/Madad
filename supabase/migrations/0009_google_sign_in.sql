-- MADAD 0009 · sign-in with Google (docs/DECISIONS.md, after phase 4).
-- Google accounts carry their name as full_name or name in the user metadata; email sign-ups as full_name.
-- Everything else is unchanged: the profile, and pending invitations for that email becoming memberships.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1)),
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
