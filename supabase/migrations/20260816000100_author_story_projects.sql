-- Story Blocks Auteur: private member-owned production workspaces.
create table if not exists public.author_story_project (
  id text primary key default gen_random_uuid()::text,
  created_by_id text not null,
  created_by text,
  title text not null,
  genre text,
  story_description text not null default '',
  tone_rules text,
  story_rules text,
  cover_image text,
  characters jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  chapters jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'ready', 'submitted', 'published')),
  published_dossier_id text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.author_story_project enable row level security;
grant select, insert, update, delete on public.author_story_project to authenticated;

drop policy if exists author_story_project_owner_read on public.author_story_project;
create policy author_story_project_owner_read on public.author_story_project
for select to authenticated using (created_by_id = (select auth.uid())::text or public.is_admin());

drop policy if exists author_story_project_owner_insert on public.author_story_project;
create policy author_story_project_owner_insert on public.author_story_project
for insert to authenticated with check (created_by_id = (select auth.uid())::text or public.is_admin());

drop policy if exists author_story_project_owner_update on public.author_story_project;
create policy author_story_project_owner_update on public.author_story_project
for update to authenticated
using (created_by_id = (select auth.uid())::text or public.is_admin())
with check (created_by_id = (select auth.uid())::text or public.is_admin());

drop policy if exists author_story_project_owner_delete on public.author_story_project;
create policy author_story_project_owner_delete on public.author_story_project
for delete to authenticated using (created_by_id = (select auth.uid())::text or public.is_admin());

drop trigger if exists set_author_story_project_updated_date on public.author_story_project;
create trigger set_author_story_project_updated_date before update on public.author_story_project
for each row execute function public.set_updated_date();

comment on table public.author_story_project is
  'Private Story Blocks Auteur projects. Public publication is handled separately.';
