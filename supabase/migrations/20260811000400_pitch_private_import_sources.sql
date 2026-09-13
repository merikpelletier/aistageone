-- Conservation privée des lignes OLO d'origine pendant la migration du Pitch Builder.
-- Cette table n'est jamais exposée au navigateur; elle permet de reprendre un champ
-- historique sans réactiver les anciens mots de passe ou liens de partage.

create table if not exists public.pitch_legacy_source (
  entity_type text not null,
  entity_id text not null,
  source_payload jsonb not null,
  imported_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

alter table public.pitch_legacy_source enable row level security;
revoke all on public.pitch_legacy_source from anon, authenticated;

comment on table public.pitch_legacy_source is
  'Archive serveur privée des données Pitch OLO importées; aucun accès client.';
