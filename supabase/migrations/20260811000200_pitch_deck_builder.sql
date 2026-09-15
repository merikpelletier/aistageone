-- Pitch Deck Builder récupéré depuis OLO.GRAPHICS.
-- Tous les projets et enfants sont privés par défaut. Le partage public doit
-- passer par une fonction serveur dédiée et ne donne aucun accès général aux tables.

create table if not exists public.pitch_project (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  working_title text,
  final_title text,
  tagline text,
  project_type text,
  genre text,
  subgenre text,
  format text,
  original_language text not null default 'fr',
  creator_name text,
  creator_email text,
  creator_phone text,
  company_name text,
  previous_titles jsonb not null default '[]'::jsonb,
  project_status text not null default 'draft',
  intended_recipient text,
  pitch_goal text,
  selected_template_id text,
  custom_background_r2_key text,
  source_custom_background_url text,
  current_wizard_step integer not null default 1,
  completion_percentage integer not null default 0 check (completion_percentage between 0 and 100),
  hook_headline text,
  logline_short text,
  logline_full text,
  share_slug text unique,
  share_access_type text not null default 'private' check (share_access_type in ('private', 'link', 'password')),
  share_password_hash text,
  allow_downloads boolean not null default false,
  allow_sharing boolean not null default false,
  is_published boolean not null default false,
  views bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pitch_password_required check (share_access_type <> 'password' or share_password_hash is not null)
);

create table if not exists public.pitch_source_document (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  pitch_project_id text not null references public.pitch_project(id) on delete cascade,
  file_name text,
  file_type text,
  r2_object_key text,
  source_file_url text,
  extracted_text text,
  processing_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pitch_extracted_content (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  pitch_project_id text not null references public.pitch_project(id) on delete cascade,
  source_document_id text references public.pitch_source_document(id) on delete set null,
  content_type text,
  title text,
  content text,
  structured_data jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pitch_editorial_issue (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  pitch_project_id text not null references public.pitch_project(id) on delete cascade,
  issue_type text,
  severity text,
  title text,
  description text,
  suggestion text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pitch_title_option (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  pitch_project_id text not null references public.pitch_project(id) on delete cascade,
  title text not null,
  rationale text,
  score numeric(6,3),
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.pitch_section (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  pitch_project_id text not null references public.pitch_project(id) on delete cascade,
  section_type text not null,
  title text,
  subtitle text,
  body text,
  original_language text not null default 'fr',
  media_r2_key text,
  media_cover_r2_key text,
  source_media_url text,
  source_media_cover_url text,
  gallery_media jsonb not null default '[]'::jsonb,
  show_text boolean not null default true,
  order_index integer not null default 0,
  layout_type text,
  transition_type text,
  is_visible boolean not null default true,
  is_custom boolean not null default false,
  narration_audio_url text,
  narration_voice text,
  narration_language text,
  narration_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pitch_section add column if not exists narration_audio_url text;
alter table public.pitch_section add column if not exists narration_voice text;
alter table public.pitch_section add column if not exists narration_language text;
alter table public.pitch_section add column if not exists narration_generated_at timestamptz;

create table if not exists public.pitch_section_translation (
  id uuid primary key default gen_random_uuid(),
  pitch_section_id text not null references public.pitch_section(id) on delete cascade,
  language_code text not null,
  title text,
  subtitle text,
  body text,
  translation_status text not null default 'draft' check (translation_status in ('draft', 'automatic', 'reviewed', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pitch_section_id, language_code)
);

create table if not exists public.pitch_media (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  pitch_project_id text not null references public.pitch_project(id) on delete cascade,
  title text,
  media_type text,
  r2_object_key text,
  thumbnail_r2_key text,
  source_media_url text,
  source_thumbnail_url text,
  metadata jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pitch_character (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  pitch_project_id text not null references public.pitch_project(id) on delete cascade,
  name text not null,
  role text,
  description text,
  image_r2_key text,
  source_image_url text,
  metadata jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pitch_episode (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  pitch_project_id text not null references public.pitch_project(id) on delete cascade,
  episode_number integer,
  title text,
  synopsis text,
  metadata jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pitch_share (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  pitch_project_id text not null references public.pitch_project(id) on delete cascade,
  share_token_hash text not null unique,
  recipient_email text,
  permissions jsonb not null default '{"view":true,"download":false}'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists pitch_project_owner_idx on public.pitch_project(owner_id, archived);
create index if not exists pitch_section_project_order_idx on public.pitch_section(pitch_project_id, order_index);
create index if not exists pitch_media_project_idx on public.pitch_media(pitch_project_id);

create or replace function public.can_manage_pitch(target_project_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pitch_project p
    where p.id = target_project_id
      and (p.owner_id = (select auth.uid()) or public.is_admin())
  );
$$;
revoke all on function public.can_manage_pitch(text) from public;
grant execute on function public.can_manage_pitch(text) to authenticated;

alter table public.pitch_project enable row level security;
alter table public.pitch_source_document enable row level security;
alter table public.pitch_extracted_content enable row level security;
alter table public.pitch_editorial_issue enable row level security;
alter table public.pitch_title_option enable row level security;
alter table public.pitch_section enable row level security;
alter table public.pitch_section_translation enable row level security;
alter table public.pitch_media enable row level security;
alter table public.pitch_character enable row level security;
alter table public.pitch_episode enable row level security;
alter table public.pitch_share enable row level security;

grant select, insert, update, delete on public.pitch_project to authenticated;
grant select, insert, update, delete on public.pitch_source_document, public.pitch_extracted_content,
  public.pitch_editorial_issue, public.pitch_title_option, public.pitch_section,
  public.pitch_section_translation, public.pitch_media, public.pitch_character,
  public.pitch_episode, public.pitch_share to authenticated;

create policy "owners_manage_pitch_projects" on public.pitch_project
for all to authenticated using (owner_id = (select auth.uid()) or public.is_admin())
with check (owner_id = (select auth.uid()) or public.is_admin());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'pitch_source_document','pitch_extracted_content','pitch_editorial_issue',
    'pitch_title_option','pitch_section','pitch_media','pitch_character',
    'pitch_episode','pitch_share'
  ] loop
    execute format(
      'create policy "owners_manage_%1$s" on public.%1$I for all to authenticated using (public.can_manage_pitch(pitch_project_id)) with check (public.can_manage_pitch(pitch_project_id))',
      table_name
    );
  end loop;
end;
$$;

create policy "owners_manage_pitch_section_translations" on public.pitch_section_translation
for all to authenticated using (
  exists (select 1 from public.pitch_section s where s.id = pitch_section_id and public.can_manage_pitch(s.pitch_project_id))
) with check (
  exists (select 1 from public.pitch_section s where s.id = pitch_section_id and public.can_manage_pitch(s.pitch_project_id))
);

-- Aucun droit anon n'est accordé. La consultation d'un pitch partagé doit
-- vérifier le jeton, le mot de passe éventuel et l'expiration côté serveur.
