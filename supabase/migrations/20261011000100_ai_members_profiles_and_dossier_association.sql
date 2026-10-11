create table if not exists public.ai_member (
  id text primary key default (gen_random_uuid())::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by_id text,
  display_name text not null,
  handle text not null unique,
  avatar_url text,
  member_type text not null default 'creator',
  headline text,
  title text,
  bio text,
  images jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  custom_banner_url text,
  custom_banner_link text,
  language text default 'en',
  location_label text,
  persona text,
  voice_style text,
  visual_style text,
  interests jsonb not null default '[]'::jsonb,
  content_types jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '{}'::jsonb,
  automation_enabled boolean not null default false,
  activity_frequency text not null default 'manual',
  quiet_hours text,
  is_active boolean not null default true,
  is_ai_disclosed boolean not null default true,
  notes text,
  constraint ai_member_type_check check (member_type in ('creator','talent','media','sponsor','merchant','producer','social')),
  constraint ai_member_frequency_check check (activity_frequency in ('manual','low','normal','high'))
);

create table if not exists public.ai_member_activity (
  id text primary key default (gen_random_uuid())::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by_id text,
  ai_member_id text not null references public.ai_member(id) on delete cascade,
  activity_type text not null,
  target_type text,
  target_id text,
  target_label text,
  content text,
  status text not null default 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint ai_member_activity_type_check check (activity_type in ('publish','comment','like','follow','sponsor','sell','collaborate','system')),
  constraint ai_member_activity_status_check check (status in ('draft','scheduled','published','cancelled'))
);

create table if not exists public.ai_member_relationship (
  id text primary key default (gen_random_uuid())::text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by_id text,
  source_member_id text not null references public.ai_member(id) on delete cascade,
  target_member_id text not null references public.ai_member(id) on delete cascade,
  relationship_type text not null,
  strength text not null default 'normal',
  notes text,
  is_active boolean not null default true,
  constraint ai_member_relationship_type_check check (relationship_type in ('follows','collaborator','client','sponsor','represented_by','media_interest','friend','rival')),
  constraint ai_member_relationship_strength_check check (strength in ('light','normal','strong')),
  constraint ai_member_relationship_not_self check (source_member_id <> target_member_id)
);

alter table public.dossier add column if not exists ai_member_id text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'dossier_ai_member_id_fkey') then
    alter table public.dossier
      add constraint dossier_ai_member_id_fkey foreign key (ai_member_id) references public.ai_member(id) on delete set null;
  end if;
end $$;

create index if not exists idx_dossier_ai_member_id on public.dossier(ai_member_id);
create index if not exists idx_ai_member_activity_member on public.ai_member_activity(ai_member_id);
create index if not exists idx_ai_member_activity_schedule on public.ai_member_activity(status, scheduled_for);
create index if not exists idx_ai_member_relationship_source on public.ai_member_relationship(source_member_id);
create index if not exists idx_ai_member_relationship_target on public.ai_member_relationship(target_member_id);

alter table public.ai_member enable row level security;
alter table public.ai_member_activity enable row level security;
alter table public.ai_member_relationship enable row level security;

drop policy if exists admin_manage_ai_member on public.ai_member;
create policy admin_manage_ai_member on public.ai_member for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists admin_manage_ai_member_activity on public.ai_member_activity;
create policy admin_manage_ai_member_activity on public.ai_member_activity for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists admin_manage_ai_member_relationship on public.ai_member_relationship;
create policy admin_manage_ai_member_relationship on public.ai_member_relationship for all to authenticated using (is_admin()) with check (is_admin());

create or replace view public.ai_member_public as
select id, display_name, handle, avatar_url, coalesce(title, headline) as title, bio, images, links,
       custom_banner_url, custom_banner_link, language, location_label, member_type, is_ai_disclosed
from public.ai_member
where is_active = true and is_ai_disclosed = true;

grant select on public.ai_member_public to anon, authenticated;
