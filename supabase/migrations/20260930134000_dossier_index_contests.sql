alter table public.dossier_page
  add column if not exists contest_category text,
  add column if not exists contest_deadline timestamptz,
  add column if not exists contest_reward text,
  add column if not exists contest_rules text,
  add column if not exists contest_submission_types jsonb not null default '["text","link","media"]'::jsonb,
  add column if not exists contest_status text not null default 'open',
  add column if not exists contest_cta_label text default 'Submit entry';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'dossier_page_contest_status_check'
      and conrelid = 'public.dossier_page'::regclass
  ) then
    alter table public.dossier_page
      add constraint dossier_page_contest_status_check
      check (contest_status in ('draft','open','closed'));
  end if;
end $$;

create table if not exists public.contest_submission (
  id text primary key default gen_random_uuid()::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by text,
  created_by_id text,
  dossier_id text not null references public.dossier(id) on delete cascade,
  contest_page_id text not null references public.dossier_page(id) on delete cascade,
  applicant_name text,
  applicant_email text,
  portfolio_url text,
  message text,
  media_urls jsonb not null default '[]'::jsonb,
  status text not null default 'submitted'
    check (status in ('submitted','shortlisted','winner','rejected')),
  is_sample boolean not null default false
);

create index if not exists contest_submission_page_idx
  on public.contest_submission (contest_page_id, created_date desc);

create index if not exists contest_submission_dossier_idx
  on public.contest_submission (dossier_id, created_date desc);

alter table public.contest_submission enable row level security;

grant select, insert, update, delete on table public.contest_submission to authenticated;
revoke all on table public.contest_submission from anon;

drop policy if exists contest_submission_insert_own on public.contest_submission;
create policy contest_submission_insert_own
  on public.contest_submission
  for insert
  to authenticated
  with check (created_by_id = (select auth.uid())::text or is_admin());

drop policy if exists contest_submission_read_own_or_admin on public.contest_submission;
create policy contest_submission_read_own_or_admin
  on public.contest_submission
  for select
  to authenticated
  using (created_by_id = (select auth.uid())::text or is_admin());

drop policy if exists contest_submission_admin_update on public.contest_submission;
create policy contest_submission_admin_update
  on public.contest_submission
  for update
  to authenticated
  using (is_admin())
  with check (is_admin());

drop policy if exists contest_submission_admin_delete on public.contest_submission;
create policy contest_submission_admin_delete
  on public.contest_submission
  for delete
  to authenticated
  using (is_admin());

comment on table public.contest_submission is 'Member submissions to contest pages inside dossiers.';
