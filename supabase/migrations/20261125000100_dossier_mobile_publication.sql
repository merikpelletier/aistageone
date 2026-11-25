-- Mobile dossier publication metadata.
-- The dossier remains the single source of truth; mobile publication references it.
alter table public.dossier
  add column if not exists mobile_enabled boolean not null default false,
  add column if not exists mobile_public_id text;

create unique index if not exists dossier_mobile_public_id_unique
  on public.dossier (mobile_public_id)
  where mobile_public_id is not null;

insert into public.translation_dictionary (namespace, source_key, translations)
values
  ('ui', 'Créer une version mobile', '{"fr":"Créer une version mobile","en":"Create a mobile version"}'::jsonb),
  ('ui', 'Préparer ce dossier pour le player mobile externe AISTAGE.ONE. La version mobile reste liée à ce dossier et réutilise son contenu existant.', '{"fr":"Préparer ce dossier pour le player mobile externe AISTAGE.ONE. La version mobile reste liée à ce dossier et réutilise son contenu existant.","en":"Prepare this dossier for the external AISTAGE.ONE mobile player. The mobile version remains linked to this dossier and reuses its existing content."}'::jsonb),
  ('ui', 'Identifiant de publication mobile', '{"fr":"Identifiant de publication mobile","en":"Mobile publication ID"}'::jsonb)
on conflict (namespace, source_key) do update
set translations = coalesce(public.translation_dictionary.translations, '{}'::jsonb) || excluded.translations,
    updated_at = now();
