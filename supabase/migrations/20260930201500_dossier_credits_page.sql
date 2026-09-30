alter table public.dossier_page
  add column if not exists credits_sections jsonb not null default '[]'::jsonb;
