alter table public.author_story_project
  add column if not exists author_name text,
  add column if not exists contributors jsonb not null default '[]'::jsonb;

alter table public.timeline_story
  add column if not exists contributors jsonb not null default '[]'::jsonb;
