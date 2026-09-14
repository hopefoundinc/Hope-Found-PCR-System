-- Hope Found PCR Audit-Readiness System — Supabase setup
-- Run this once in your project's SQL editor (Supabase dashboard → SQL Editor → New query).
-- Then paste the project URL and the "anon public" key into the app under
-- Settings → Shared records (Supabase).

-- The app stores each of its datasets as one JSON document under a key
-- ("pcr:clients", "pcr:rec:<person id>", and so on), so a single key/value
-- table is the whole schema. Keeping it this shape means the app's storage
-- layer is unchanged and a future migration is a data move, not a rewrite.
create table if not exists public.pcr_store (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.pcr_store enable row level security;

-- READ THIS BEFORE YOU RUN IT.
--
-- This policy lets anyone holding the project URL and the anon key read and
-- write every record. The anon key is a client-side credential: it ships to
-- each browser, so it is a shared password, not a secret. That is a reasonable
-- trade while the tool is used by a small QA team on machines you control, and
-- it is why the app keeps the key in each browser rather than in the repository.
--
-- It is NOT sufficient if the deployed URL is ever public, and these records
-- hold client names, medication and behaviour-plan flags. To go further:
--   * turn on Supabase Auth and replace `to anon` with `to authenticated`, so
--     each person signs in and access can be revoked individually; then set
--     requirePassword back to true in PROVIDER_CONFIG.meta;
--   * for HIPAA coverage, Supabase requires a paid plan and a signed BAA.
create policy "pcr_store anon read"   on public.pcr_store for select to anon using (true);
create policy "pcr_store anon insert" on public.pcr_store for insert to anon with check (true);
create policy "pcr_store anon update" on public.pcr_store for update to anon using (true) with check (true);
create policy "pcr_store anon delete" on public.pcr_store for delete to anon using (true);

-- Keep updated_at honest even if a client forgets to send it.
create or replace function public.pcr_store_touch() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists pcr_store_touch on public.pcr_store;
create trigger pcr_store_touch before insert or update on public.pcr_store
  for each row execute function public.pcr_store_touch();
