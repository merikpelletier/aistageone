-- Mobile dossier publication metadata.
-- The dossier remains the single source of truth; mobile publication references it.
alter table public.dossier
  add column if not exists mobile_enabled boolean not null default false,
  add column if not exists mobile_public_id text;

create unique index if not exists dossier_mobile_public_id_unique
  on public.dossier (mobile_public_id)
  where mobile_public_id is not null;
