-- Données sources privées nécessaires à la migration des médias OLO vers R2.
-- Aucun droit navigateur n'est accordé à cette table.

create table if not exists public.catalog_asset_legacy_source (
  asset_id text primary key references public.catalog_asset(id) on delete cascade,
  asset_file_uri text,
  download_url text,
  source_payload jsonb not null default '{}'::jsonb,
  migrated_to_r2_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.catalog_asset_legacy_source enable row level security;
revoke all on public.catalog_asset_legacy_source from anon, authenticated;

comment on table public.catalog_asset_legacy_source is
  'Transition privée OLO vers Cloudflare R2; inaccessible au navigateur.';
