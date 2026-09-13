-- Catalogue d'actifs OLO.GRAPHICS intégré à AISTAGE.ONE.
-- Les fichiers lourds restent privés dans Cloudflare R2; cette migration ne
-- conserve que leurs clés d'objet et les droits d'accès.

create table if not exists public.asset_category (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  key text not null unique,
  label_en text not null,
  label_fr text not null,
  icon text,
  color text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  show_in_studio boolean not null default false,
  is_free_reference boolean not null default false,
  details_type text,
  has_personality_prompt boolean not null default false,
  has_credit_costs boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_subcategory (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  category_id text not null references public.asset_category(id) on delete cascade,
  key text not null,
  label_en text not null,
  label_fr text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, key)
);

create table if not exists public.catalog_asset (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  creator_name text,
  description text,
  original_language text not null default 'fr',
  category_id text references public.asset_category(id) on delete set null,
  subcategory_id text references public.asset_subcategory(id) on delete set null,
  tags jsonb not null default '[]'::jsonb,
  preview_images jsonb not null default '[]'::jsonb,
  featured_image text,
  download_price numeric(12,2),
  credit_cost integer,
  credit_cost_influencer integer,
  credit_cost_production integer,
  credit_cost_brands integer,
  required_tier text,
  personality_prompt text,
  character_details jsonb,
  actor_details jsonb,
  clothes_details jsonb,
  accessories_details jsonb,
  props_details jsonb,
  showroom_content jsonb,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived', 'rejected')),
  license_code text,
  admin_comments text,
  download_count integer not null default 0,
  is_featured boolean not null default false,
  rights_confirmed boolean not null default false,
  rights_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_asset_file (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.catalog_asset(id) on delete cascade,
  r2_object_key text not null,
  file_name text not null,
  content_type text,
  byte_size bigint,
  checksum_sha256 text,
  source_asset_file_uri text,
  source_download_url text,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, r2_object_key)
);

create table if not exists public.asset_translation (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null references public.catalog_asset(id) on delete cascade,
  language_code text not null,
  title text not null,
  description text,
  translation_status text not null default 'draft' check (translation_status in ('draft', 'automatic', 'reviewed', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, language_code)
);

create table if not exists public.asset_license (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  asset_id text not null references public.catalog_asset(id) on delete restrict,
  buyer_id uuid references auth.users(id) on delete set null,
  buyer_email text,
  creator_email text,
  license_code text not null unique,
  license_type text not null,
  credits_spent integer not null default 0,
  status text not null default 'active' check (status in ('pending', 'active', 'expired', 'revoked', 'refunded')),
  purchase_date timestamptz not null default now(),
  expiration_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_download (
  id text primary key default gen_random_uuid()::text,
  source_id text unique,
  asset_id text not null references public.catalog_asset(id) on delete restrict,
  license_id text references public.asset_license(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  credits_spent integer not null default 0,
  link_expires_at timestamptz,
  downloaded_at timestamptz not null default now(),
  request_ip inet,
  created_at timestamptz not null default now()
);

create index if not exists catalog_asset_status_category_idx on public.catalog_asset(status, category_id);
create index if not exists catalog_asset_owner_idx on public.catalog_asset(owner_id);
create index if not exists asset_license_buyer_idx on public.asset_license(buyer_id);
create index if not exists asset_download_user_idx on public.asset_download(user_id);

alter table public.asset_category enable row level security;
alter table public.asset_subcategory enable row level security;
alter table public.catalog_asset enable row level security;
alter table public.catalog_asset_file enable row level security;
alter table public.asset_translation enable row level security;
alter table public.asset_license enable row level security;
alter table public.asset_download enable row level security;

grant select on public.asset_category, public.asset_subcategory to anon, authenticated;
grant select on public.catalog_asset, public.asset_translation to anon, authenticated;
grant insert, update, delete on public.catalog_asset, public.asset_translation to authenticated;
grant select on public.asset_license, public.asset_download to authenticated;

create policy "public_read_active_asset_categories" on public.asset_category
for select to anon, authenticated using (is_active);
create policy "public_read_active_asset_subcategories" on public.asset_subcategory
for select to anon, authenticated using (is_active);
create policy "public_read_published_catalog_assets" on public.catalog_asset
for select to anon, authenticated using (status = 'published' and rights_confirmed);
create policy "owners_read_catalog_assets" on public.catalog_asset
for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy "owners_create_catalog_assets" on public.catalog_asset
for insert to authenticated with check (owner_id = (select auth.uid()) or public.is_admin());
create policy "owners_update_catalog_assets" on public.catalog_asset
for update to authenticated using (owner_id = (select auth.uid()) or public.is_admin())
with check (owner_id = (select auth.uid()) or public.is_admin());
create policy "owners_delete_catalog_assets" on public.catalog_asset
for delete to authenticated using (owner_id = (select auth.uid()) or public.is_admin());

create policy "public_read_published_asset_translations" on public.asset_translation
for select to anon, authenticated using (
  exists (select 1 from public.catalog_asset a where a.id = asset_id and a.status = 'published' and a.rights_confirmed)
);
create policy "owners_manage_asset_translations" on public.asset_translation
for all to authenticated using (
  exists (select 1 from public.catalog_asset a where a.id = asset_id and (a.owner_id = (select auth.uid()) or public.is_admin()))
) with check (
  exists (select 1 from public.catalog_asset a where a.id = asset_id and (a.owner_id = (select auth.uid()) or public.is_admin()))
);

create policy "buyers_read_asset_licenses" on public.asset_license
for select to authenticated using (buyer_id = (select auth.uid()) or public.is_admin());
create policy "buyers_read_asset_downloads" on public.asset_download
for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- Les créations de licences, journaux de téléchargement et liens R2 restent
-- réservées aux fonctions serveur avec service_role. catalog_asset_file ne
-- reçoit volontairement aucun GRANT navigateur : les clés R2 et anciennes URL
-- ne sont donc jamais exposées par le catalogue public.
