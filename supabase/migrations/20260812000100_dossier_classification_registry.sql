-- Classification, accès, langues et registre permanent des dossiers AISTAGE.ONE.
-- Les lignes historiques restent non classifiées jusqu'à correction explicite.

alter table public.dossier
  add column if not exists content_rating text,
  add column if not exists rating_reasons text[] not null default '{}',
  add column if not exists public_promo_confirmed boolean not null default false,
  add column if not exists public_promo_confirmed_at timestamptz,
  add column if not exists public_promo_confirmed_by uuid references auth.users(id),
  add column if not exists adult_age_gate_required boolean not null default false,
  add column if not exists adult_warning_page_required boolean not null default false,
  add column if not exists access_model text,
  add column if not exists commercial_access_required boolean not null default false,
  add column if not exists original_language text,
  add column if not exists audio_languages text[] not null default '{}',
  add column if not exists subtitle_languages text[] not null default '{}',
  add column if not exists default_language text,
  add column if not exists aistage_publication_date timestamptz,
  add column if not exists first_publication_date date,
  add column if not exists archive_fingerprint text,
  add column if not exists archive_reference text,
  add column if not exists official_registration_reference text;
alter table public.dossier
  drop constraint if exists dossier_content_rating_check,
  add constraint dossier_content_rating_check
    check (content_rating is null or content_rating in ('all', '13+', '18+')),
  drop constraint if exists dossier_rating_reasons_check,
  add constraint dossier_rating_reasons_check
    check (rating_reasons <@ array['violence','language','sexuality','nudity','substances','fear','sensitive_content']::text[]),
  drop constraint if exists dossier_access_model_check,
  add constraint dossier_access_model_check
    check (access_model is null or access_model in ('free', 'paid')),
  drop constraint if exists dossier_published_controls_check,
  add constraint dossier_published_controls_check check (
    status <> 'published' or (
      content_rating is not null
      and access_model is not null
      and public_promo_confirmed
      and nullif(btrim(original_language), '') is not null
      and nullif(btrim(default_language), '') is not null
      and (default_language = original_language or default_language = any(audio_languages))
      and (content_rating <> '18+' or (adult_age_gate_required and adult_warning_page_required))
      and (access_model <> 'paid' or commercial_access_required)
    )
  ) not valid;
create table if not exists public.dossier_legal_identity (
  dossier_id text primary key references public.dossier(id) on delete cascade,
  legal_name text not null,
  identity_accuracy_confirmed boolean not null default false,
  identity_confirmed_at timestamptz,
  identity_confirmed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dossier_legal_identity enable row level security;
revoke all on public.dossier_legal_identity from anon, authenticated;
grant select, insert, update on public.dossier_legal_identity to authenticated;
drop policy if exists "admins_manage_dossier_legal_identity" on public.dossier_legal_identity;
create policy "admins_manage_dossier_legal_identity"
on public.dossier_legal_identity for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create table if not exists public.dossier_registry_event (
  id uuid primary key default gen_random_uuid(),
  dossier_id text not null references public.dossier(id) on delete restrict,
  event_type text not null default 'metadata_recorded',
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  title text not null,
  public_author_name text,
  aistage_publication_date timestamptz,
  first_publication_date date,
  archive_fingerprint text,
  archive_reference text,
  official_registration_reference text,
  content_rating text,
  rating_reasons text[] not null default '{}',
  access_model text,
  original_language text,
  audio_languages text[] not null default '{}',
  subtitle_languages text[] not null default '{}',
  default_language text
);
alter table public.dossier_registry_event enable row level security;
revoke all on public.dossier_registry_event from anon, authenticated;
grant select, insert on public.dossier_registry_event to authenticated;
drop policy if exists "admins_read_dossier_registry" on public.dossier_registry_event;
create policy "admins_read_dossier_registry"
on public.dossier_registry_event for select to authenticated using (public.is_admin());
drop policy if exists "admins_append_dossier_registry" on public.dossier_registry_event;
create policy "admins_append_dossier_registry"
on public.dossier_registry_event for insert to authenticated
with check (public.is_admin() and recorded_by = (select auth.uid()));
create or replace function public.prevent_dossier_registry_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Le registre des dossiers est append-only';
end;
$$;
drop trigger if exists prevent_dossier_registry_update on public.dossier_registry_event;
create trigger prevent_dossier_registry_update
before update or delete on public.dossier_registry_event
for each row execute function public.prevent_dossier_registry_mutation();
create or replace function public.set_dossier_controls()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.rating_reasons := coalesce(new.rating_reasons, '{}');
  new.audio_languages := coalesce(new.audio_languages, '{}');
  new.subtitle_languages := coalesce(new.subtitle_languages, '{}');
  new.adult_age_gate_required := new.content_rating = '18+';
  new.adult_warning_page_required := new.content_rating = '18+';
  new.commercial_access_required := new.access_model = 'paid';

  if new.public_promo_confirmed and tg_op = 'INSERT' then
    new.public_promo_confirmed_at := now();
    new.public_promo_confirmed_by := auth.uid();
  elsif new.public_promo_confirmed and not coalesce(old.public_promo_confirmed, false) then
    new.public_promo_confirmed_at := now();
    new.public_promo_confirmed_by := auth.uid();
  elsif not new.public_promo_confirmed then
    new.public_promo_confirmed_at := null;
    new.public_promo_confirmed_by := null;
  end if;
  return new;
end;
$$;
drop trigger if exists set_dossier_controls on public.dossier;
create trigger set_dossier_controls
before insert or update on public.dossier
for each row execute function public.set_dossier_controls();
comment on table public.dossier_legal_identity is 'Identité légale privée du registre; jamais exposée avec le dossier public.';
comment on table public.dossier_registry_event is 'Historique interne append-only du registre des titres.';
comment on column public.dossier.requires_payment is 'Frais de soumission historiques des marques; ne pas utiliser pour l’accès commercial au contenu.';
comment on column public.dossier.payment_confirmed is 'Confirmation des frais de soumission historiques des marques; ne pas utiliser pour l’accès commercial au contenu.';
