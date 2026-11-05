-- MADAD 0001 · extensions, enum types, Arabic normalization (SPEC §12 «البحث بالعربية», §13).

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.org_type as enum ('pharmacy', 'hospital', 'medical_point', 'humanitarian');
create type public.verification_status as enum ('draft', 'pending', 'needs_info', 'approved', 'rejected', 'suspended');
create type public.location_precision as enum ('exact', 'area', 'hidden');
create type public.member_role as enum ('owner', 'manager', 'staff', 'viewer');
create type public.platform_role as enum ('reviewer', 'super_admin');
create type public.reported_status as enum ('available', 'limited', 'unavailable');
create type public.medicine_status as enum ('pending', 'approved', 'rejected', 'merged');
create type public.document_status as enum ('pending', 'accepted', 'rejected');
create type public.stock_action as enum ('update', 'confirm_all', 'hide', 'show', 'add', 'remove');
create type public.inquiry_status as enum ('new', 'in_progress', 'replied', 'closed');
create type public.report_status as enum ('new', 'in_review', 'resolved', 'rejected');
create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.service_kind as enum ('department', 'service', 'program');
create type public.program_status as enum ('info', 'active', 'paused', 'ended');

-- Same steps, in the same order, as normalizeArabic() in src/lib/normalizeArabic.ts:
-- diacritics and tatweel out, alef/taa/yaa forms unified, Eastern digits to Western, Latin lowercased,
-- letters split from digits, punctuation to spaces (except . % /), spaces collapsed.
-- supabase/tests/db.test.ts checks both give the same output.
create function public.normalize_ar(input text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(translate(
            regexp_replace(coalesce(input, ''), '[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]', '', 'g'),
            'أإآٱةىؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
            'ااااهيوي01234567890123456789')),
          '([^0-9[:space:].%/])([0-9])', '\1 \2', 'g'),
        '([0-9])([^0-9[:space:].%/])', '\1 \2', 'g'),
      '[\x21-\x24\x26-\x2d\x3a-\x40\x5b-\x60\x7b-\x7e\u00AB\u00BB\u060C\u061B\u061F\u066A-\u066C\u2010-\u2027]', ' ', 'g'),
    '\s+', ' ', 'g'));
$$;

-- Fallback key, used only when the normal search finds nothing (phoneticKey() in the app).
create function public.phonetic_ar(input text) returns text
language sql immutable parallel safe set search_path = ''
as $$ select translate(public.normalize_ar(input), 'صثطضذظ', 'سستدزز'); $$;

-- Everything a medicine can be found by (searchTextOf() in src/lib/search.ts).
create function public.medicine_search_text(
  name_ar text, name_en text, generic_name text, strength text, strength_en text, aliases text[], barcode text
) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select public.normalize_ar(concat_ws(' ', name_ar, name_en, generic_name, strength, strength_en,
    array_to_string(coalesce(aliases, '{}'::text[]), ' '), barcode));
$$;

-- Freshness of one report (freshnessOf() in src/lib/freshness.ts): 24:00 exactly is still fresh.
create function public.freshness_of(reported_at timestamptz, at timestamptz, fresh_h int, expire_h int) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select case
    when extract(epoch from at - reported_at) / 3600 <= fresh_h then 'fresh'
    when extract(epoch from at - reported_at) / 3600 <= expire_h then 'stale'
    else 'expired'
  end;
$$;
