create table public.marketing_spokespersons (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 200),
 brand text not null check(brand in ('aistage','leplateau','both')), description text not null default '',
 appearance text not null default '', wardrobe text not null default '', setting text not null default '',
 archived boolean not null default false, created_at timestamptz not null default now()
);
create table public.marketing_media (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 200),
 brand text not null check(brand in ('aistage','leplateau','both')),
 language text not null check(language in ('en','fr','both')),
 media_type text not null check(media_type in ('image','video','audio')),
 purpose text not null check(purpose in ('portrait','voice','opening','closing','voiceover','music','logo','demo','other')),
 spokesperson_id uuid references public.marketing_spokespersons(id) on delete restrict,
 vault_asset_id text, storage_path text, description text not null default '',
 authorized boolean not null default false check(authorized), archived boolean not null default false,
 created_at timestamptz not null default now(),
 check ((vault_asset_id is not null)::int + (storage_path is not null)::int = 1),
 check (purpose not in ('opening','closing') or media_type='video'),
 check (purpose not in ('voice','voiceover','music') or media_type='audio'),
 check (purpose<>'portrait' or media_type='image')
);
create index marketing_media_spokesperson_idx on public.marketing_media(spokesperson_id);
alter table public.marketing_spokespersons enable row level security;
revoke all on public.marketing_spokespersons from public, anon, authenticated;
grant select, insert, update on public.marketing_spokespersons to authenticated;
create policy marketing_spokespersons_read on public.marketing_spokespersons for select to authenticated using ((select public.is_admin()));
create policy marketing_spokespersons_insert on public.marketing_spokespersons for insert to authenticated with check ((select public.is_admin()));
create policy marketing_spokespersons_update on public.marketing_spokespersons for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
alter table public.marketing_media enable row level security;
revoke all on public.marketing_media from public, anon, authenticated;
grant select, insert, update on public.marketing_media to authenticated;
create policy marketing_media_read on public.marketing_media for select to authenticated using ((select public.is_admin()));
create policy marketing_media_insert on public.marketing_media for insert to authenticated with check ((select public.is_admin()));
create policy marketing_media_update on public.marketing_media for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('marketing-private','marketing-private',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/ogg','audio/webm','audio/flac']);
create policy marketing_private_read on storage.objects for select to authenticated using (bucket_id='marketing-private' and (select public.is_admin()));
create policy marketing_private_insert on storage.objects for insert to authenticated with check (bucket_id='marketing-private' and (select public.is_admin()));
create policy marketing_private_delete on storage.objects for delete to authenticated using (bucket_id='marketing-private' and (select public.is_admin()));
insert into public.translation_dictionary(namespace,source_key,translations) values
('ui','Spokespersons','{"en":"Spokespersons","fr":"Porte-parole"}'::jsonb),
('ui','Media Library','{"en":"Media Library","fr":"Médiathèque"}'::jsonb),
('ui','New spokesperson','{"en":"New spokesperson","fr":"Nouveau porte-parole"}'::jsonb),
('ui','New media','{"en":"New media","fr":"Nouveau média"}'::jsonb),
('ui','Name','{"en":"Name","fr":"Nom"}'::jsonb),
('ui','Description','{"en":"Description","fr":"Description"}'::jsonb),
('ui','Appearance','{"en":"Appearance","fr":"Apparence"}'::jsonb),
('ui','Wardrobe','{"en":"Wardrobe","fr":"Vêtements"}'::jsonb),
('ui','Setting','{"en":"Setting","fr":"Décor"}'::jsonb),
('ui','Portrait','{"en":"Portrait","fr":"Portrait"}'::jsonb),
('ui','French voice','{"en":"French voice","fr":"Voix française"}'::jsonb),
('ui','English voice','{"en":"English voice","fr":"Voix anglaise"}'::jsonb),
('ui','Opening clip','{"en":"Opening clip","fr":"Clip d’ouverture"}'::jsonb),
('ui','Closing clip','{"en":"Closing clip","fr":"Clip de fermeture"}'::jsonb),
('ui','Media type','{"en":"Media type","fr":"Type de média"}'::jsonb),
('ui','Image','{"en":"Image","fr":"Image"}'::jsonb),
('ui','Video','{"en":"Video","fr":"Vidéo"}'::jsonb),
('ui','Audio','{"en":"Audio","fr":"Audio"}'::jsonb),
('ui','Language','{"en":"Language","fr":"Langue"}'::jsonb),
('ui','French','{"en":"French","fr":"Français"}'::jsonb),
('ui','English','{"en":"English","fr":"Anglais"}'::jsonb),
('ui','Both','{"en":"Both","fr":"Les deux"}'::jsonb),
('ui','Purpose','{"en":"Purpose","fr":"Utilisation"}'::jsonb),
('ui','Voice-over','{"en":"Voice-over","fr":"Voix hors champ"}'::jsonb),
('ui','Music','{"en":"Music","fr":"Musique"}'::jsonb),
('ui','Logo','{"en":"Logo","fr":"Logo"}'::jsonb),
('ui','Demonstration','{"en":"Demonstration","fr":"Démonstration"}'::jsonb),
('ui','Other','{"en":"Other","fr":"Autre"}'::jsonb),
('ui','Select from Vault','{"en":"Select from Vault","fr":"Sélectionner dans la Voûte"}'::jsonb),
('ui','Import file','{"en":"Import file","fr":"Importer un fichier"}'::jsonb),
('ui','Search Vault','{"en":"Search Vault","fr":"Rechercher dans la Voûte"}'::jsonb),
('ui','Save','{"en":"Save","fr":"Enregistrer"}'::jsonb),
('ui','No media','{"en":"No media","fr":"Aucun média"}'::jsonb),
('ui','No spokespersons','{"en":"No spokespersons","fr":"Aucun porte-parole"}'::jsonb),
('ui','Authorized for promotion','{"en":"Authorized for promotion","fr":"Autorisé pour la promotion"}'::jsonb),
('ui','Active','{"en":"Active","fr":"Actif"}'::jsonb),
('ui','None','{"en":"None","fr":"Aucun"}'::jsonb),
('ui','Preview','{"en":"Preview","fr":"Aperçu"}'::jsonb),
('ui','All','{"en":"All","fr":"Tous"}'::jsonb),
('ui','Select media','{"en":"Select media","fr":"Sélectionner un média"}'::jsonb),
('ui','Spokesperson','{"en":"Spokesperson","fr":"Porte-parole"}'::jsonb),
('ui','Reference','{"en":"Reference","fr":"Référence"}'::jsonb),
('ui','File required','{"en":"File required","fr":"Fichier requis"}'::jsonb),
('ui','Upload or select an authorized asset','{"en":"Upload or select an authorized asset","fr":"Importer ou sélectionner une ressource autorisée"}'::jsonb),
('ui','Media source','{"en":"Media source","fr":"Source du média"}'::jsonb),
('ui','Vault','{"en":"Vault","fr":"Voûte"}'::jsonb),
('ui','Archive','{"en":"Archive","fr":"Archiver"}'::jsonb),
('ui','Opening','{"en":"Opening","fr":"Ouverture"}'::jsonb),
('ui','Closing','{"en":"Closing","fr":"Fermeture"}'::jsonb),
('ui','All languages','{"en":"All languages","fr":"Toutes les langues"}'::jsonb),
('ui','All types','{"en":"All types","fr":"Tous les types"}'::jsonb),
('ui','Search','{"en":"Search","fr":"Rechercher"}'::jsonb),
('ui','No matching assets','{"en":"No matching assets","fr":"Aucune ressource correspondante"}'::jsonb),
('ui','Unassigned','{"en":"Unassigned","fr":"Non attribué"}'::jsonb),
('ui','No preview available','{"en":"No preview available","fr":"Aucun aperçu disponible"}'::jsonb)
on conflict(namespace,source_key) do nothing;
