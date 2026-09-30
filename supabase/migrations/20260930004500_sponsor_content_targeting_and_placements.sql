alter table public.profile_sponsor
  add column if not exists target_content_id text,
  add column if not exists target_content_title text,
  add column if not exists target_content_type text default 'dossier',
  add column if not exists logo_url text,
  add column if not exists promo_title text,
  add column if not exists promo_text text,
  add column if not exists cta_label text,
  add column if not exists placement_logo boolean not null default true,
  add column if not exists placement_link boolean not null default true,
  add column if not exists placement_promo boolean not null default false,
  add column if not exists placement_mention boolean not null default false;

create index if not exists profile_sponsor_target_content_idx
  on public.profile_sponsor(target_content_id)
  where target_content_id is not null;
