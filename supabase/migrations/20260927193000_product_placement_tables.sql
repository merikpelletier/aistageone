create table if not exists public.product_placement_package (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  currency text not null default 'CAD',
  duration_days integer not null check (duration_days > 0),
  includes_featured boolean not null default false,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_placement_request (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid references auth.users(id) on delete set null,
  submitter_email text not null,
  company_name text,
  contact_name text,
  product_name text not null,
  product_description text,
  product_url text,
  featured_image text,
  preview_images jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  category_id text references public.asset_category(id) on delete set null,
  subcategory_id text references public.asset_subcategory(id) on delete set null,
  package_id uuid references public.product_placement_package(id) on delete set null,
  package_name text,
  duration_days integer,
  includes_featured boolean not null default false,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  currency text not null default 'CAD',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  payment_status text not null default 'pending',
  review_status text not null default 'pending_payment',
  placement_status text not null default 'pending',
  rights_confirmed boolean not null default false,
  terms_accepted boolean not null default false,
  admin_notes text,
  starts_at timestamptz,
  expires_at timestamptz,
  linked_asset_id text references public.catalog_asset(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.catalog_asset
  add column if not exists is_product_placement boolean not null default false,
  add column if not exists placement_request_id uuid references public.product_placement_request(id) on delete set null,
  add column if not exists placement_expires_at timestamptz,
  add column if not exists placement_product_url text,
  add column if not exists placement_source_name text;

alter table public.product_placement_package enable row level security;
alter table public.product_placement_request enable row level security;

drop policy if exists "placement_packages_public_read" on public.product_placement_package;
create policy "placement_packages_public_read"
on public.product_placement_package for select
using (is_active = true or public.is_admin());

drop policy if exists "placement_packages_admin_all" on public.product_placement_package;
create policy "placement_packages_admin_all"
on public.product_placement_package for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "placement_requests_owner_read" on public.product_placement_request;
create policy "placement_requests_owner_read"
on public.product_placement_request for select
using (submitter_id = auth.uid() or public.is_admin());

drop policy if exists "placement_requests_admin_update" on public.product_placement_request;
create policy "placement_requests_admin_update"
on public.product_placement_request for update
using (public.is_admin())
with check (public.is_admin());