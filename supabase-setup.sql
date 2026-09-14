-- Hope Found PCR Audit-Readiness System — Supabase setup
-- Run this once in your project's SQL editor (dashboard → SQL Editor → New query).
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

-- ---------------------------------------------------------------------------
-- Access: signed-in people only.
--
-- These policies grant nothing to `anon`. The anon key still has to be present
-- (PostgREST requires it to route the request) but on its own it opens nothing:
-- every read and write must also carry a valid access token from a real
-- Supabase account. Someone who finds the deployed URL and the anon key in the
-- page source gets 0 rows, not the caseload.
--
-- If you are migrating from the earlier anon-access setup, the drops below
-- remove those older policies.
-- ---------------------------------------------------------------------------
drop policy if exists "pcr_store anon read"   on public.pcr_store;
drop policy if exists "pcr_store anon insert" on public.pcr_store;
drop policy if exists "pcr_store anon update" on public.pcr_store;
drop policy if exists "pcr_store anon delete" on public.pcr_store;

drop policy if exists "pcr_store read"   on public.pcr_store;
drop policy if exists "pcr_store insert" on public.pcr_store;
drop policy if exists "pcr_store update" on public.pcr_store;
drop policy if exists "pcr_store delete" on public.pcr_store;

create policy "pcr_store read"   on public.pcr_store for select to authenticated using (true);
create policy "pcr_store insert" on public.pcr_store for insert to authenticated with check (true);
create policy "pcr_store update" on public.pcr_store for update to authenticated using (true) with check (true);
create policy "pcr_store delete" on public.pcr_store for delete to authenticated using (true);

-- Keep updated_at honest even if a client forgets to send it. The app polls
-- the newest value here to decide whether anything changed.
create or replace function public.pcr_store_touch() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists pcr_store_touch on public.pcr_store;
create trigger pcr_store_touch before insert or update on public.pcr_store
  for each row execute function public.pcr_store_touch();

-- ---------------------------------------------------------------------------
-- Adding people
--
-- Accounts are created in the dashboard, not in the app:
--   Authentication → Users → Add user (or Invite).
--   Set  full_name  in the new user's User Metadata, e.g. {"full_name": "Maria Alvarez"}
--   so their answers are stamped with a name rather than an email address.
--   Without it the app falls back to the part of the address before the @,
--   which an administrator can rename under Users & Activity.
--
-- Then turn OFF public sign-ups, or anyone holding the anon key can create
-- themselves an account and become "authenticated":
--   Authentication → Sign In / Providers → Email → disable "Allow new users to sign up".
-- This is the step that makes the policies above mean what they say.
--
-- Taking someone off the list inside the app stops them using it, but their
-- Supabase login still exists — delete it in the dashboard as well.
--
-- Remaining gaps, honestly:
--   * Any signed-in person can read and write every record. Per-person limits
--     would need a column on this table and policies that check auth.uid().
--   * These records hold client names plus medication and behaviour-plan
--     flags. For HIPAA coverage Supabase requires a paid plan and a signed BAA.
-- ---------------------------------------------------------------------------
