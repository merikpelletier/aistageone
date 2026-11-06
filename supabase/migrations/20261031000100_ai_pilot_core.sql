create table if not exists public.ai_pilots (
  id uuid primary key default gen_random_uuid(),
  pilot_key text not null unique check (pilot_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  category text not null default '',
  tags text[] not null default '{}',
  cover_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  distribution_mode text not null default 'private' check (distribution_mode in ('private', 'assets_shop')),
  catalog_asset_id text,
  current_published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.ai_pilot_versions (
  id uuid primary key default gen_random_uuid(),
  ai_pilot_id uuid not null references public.ai_pilots(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  schema_version text not null default 'aistage.ai-pilot/v1',
  changelog text not null default '',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (ai_pilot_id, version_number)
);

alter table public.ai_pilots
  drop constraint if exists ai_pilots_current_published_version_id_fkey;
alter table public.ai_pilots
  add constraint ai_pilots_current_published_version_id_fkey
  foreign key (current_published_version_id)
  references public.ai_pilot_versions(id)
  on delete set null;

create table if not exists public.ai_pilot_blocks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.ai_pilot_versions(id) on delete cascade,
  block_key text not null check (block_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'),
  block_type text not null check (block_type in (
    'theme_bible',
    'look_bible',
    'production_direction',
    'performance_direction',
    'voice_dialogue_direction',
    'music_direction',
    'sound_direction',
    'episode_structure',
    'tool_direction',
    'continuity_rules',
    'assets',
    'prompt_override',
    'custom'
  )),
  title text not null check (char_length(trim(title)) > 0),
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content) in ('object', 'array', 'string')),
  tool_targets text[] not null default '{}',
  priority integer not null default 100,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (version_id, block_key)
);

create index if not exists ai_pilots_status_idx
  on public.ai_pilots(status, distribution_mode, name);
create index if not exists ai_pilot_versions_pilot_idx
  on public.ai_pilot_versions(ai_pilot_id, version_number desc);
create index if not exists ai_pilot_blocks_version_idx
  on public.ai_pilot_blocks(version_id, is_active, sort_order, priority);
create index if not exists ai_pilot_blocks_tool_targets_idx
  on public.ai_pilot_blocks using gin(tool_targets);

create or replace function public.set_ai_pilot_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_ai_pilots_updated_at on public.ai_pilots;
create trigger set_ai_pilots_updated_at
before update on public.ai_pilots
for each row execute function public.set_ai_pilot_updated_at();

drop trigger if exists set_ai_pilot_blocks_updated_at on public.ai_pilot_blocks;
create trigger set_ai_pilot_blocks_updated_at
before update on public.ai_pilot_blocks
for each row execute function public.set_ai_pilot_updated_at();

alter table public.ai_pilots enable row level security;
alter table public.ai_pilot_versions enable row level security;
alter table public.ai_pilot_blocks enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilots' and policyname='admin_manage_ai_pilots') then
    create policy admin_manage_ai_pilots on public.ai_pilots for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilots' and policyname='read_published_ai_pilot_catalog') then
    create policy read_published_ai_pilot_catalog on public.ai_pilots for select to anon, authenticated
      using (status = 'published' and distribution_mode = 'assets_shop');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilot_versions' and policyname='admin_manage_ai_pilot_versions') then
    create policy admin_manage_ai_pilot_versions on public.ai_pilot_versions for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilot_versions' and policyname='read_published_ai_pilot_versions') then
    create policy read_published_ai_pilot_versions on public.ai_pilot_versions for select to anon, authenticated
      using (
        is_published = true
        and exists (
          select 1
          from public.ai_pilots p
          where p.id = ai_pilot_versions.ai_pilot_id
            and p.status = 'published'
            and p.distribution_mode = 'assets_shop'
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_pilot_blocks' and policyname='admin_manage_ai_pilot_blocks') then
    create policy admin_manage_ai_pilot_blocks on public.ai_pilot_blocks for all to authenticated
      using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
      with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  end if;
end $$;

grant select on public.ai_pilots to anon, authenticated;
grant select on public.ai_pilot_versions to anon, authenticated;
grant select, insert, update, delete on public.ai_pilots to authenticated;
grant select, insert, update, delete on public.ai_pilot_versions to authenticated;
grant select, insert, update, delete on public.ai_pilot_blocks to authenticated;
