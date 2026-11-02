create table if not exists public.ai_pilot_media (
  id uuid primary key default gen_random_uuid(),
  ai_pilot_id uuid not null references public.ai_pilots(id) on delete cascade,
  version_id uuid not null references public.ai_pilot_versions(id) on delete cascade,
  media_type text not null check (media_type in ('image','audio','video')),
  title text not null default '',
  description text not null default '',
  usage_note text not null default '',
  url text not null,
  storage_path text,
  component_type text,
  component_key text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_pilot_media_pilot_idx on public.ai_pilot_media(ai_pilot_id);
create index if not exists ai_pilot_media_version_idx on public.ai_pilot_media(version_id);
create index if not exists ai_pilot_media_component_idx on public.ai_pilot_media(component_type, component_key);

alter table public.ai_pilot_media enable row level security;

drop policy if exists admin_manage_ai_pilot_media on public.ai_pilot_media;
create policy admin_manage_ai_pilot_media
on public.ai_pilot_media
for all
to authenticated
using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists members_read_owned_ai_pilot_media on public.ai_pilot_media;
create policy members_read_owned_ai_pilot_media
on public.ai_pilot_media
for select
to authenticated
using (
  exists (
    select 1 from public.member_ai_pilots m
    where m.ai_pilot_id = ai_pilot_media.ai_pilot_id
      and m.user_id = auth.uid()
  )
);

grant select, insert, update, delete on public.ai_pilot_media to authenticated;
