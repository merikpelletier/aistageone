alter table public.dossier_page add column if not exists index_thumbnail_url text;
insert into public.translation_dictionary(namespace,source_key,translations) values
('ui','Index thumbnail','{"en":"Index thumbnail","fr":"Vignette du sommaire"}'),
('ui','Index thumbnail description','{"en":"Image displayed in the table of contents, independently of the page media.","fr":"Image affichée dans le sommaire, indépendamment du contenu de la page."}'),
('ui','Upload thumbnail','{"en":"Upload thumbnail","fr":"Importer une vignette"}'),
('ui','Remove thumbnail','{"en":"Remove thumbnail","fr":"Retirer la vignette"}')
on conflict(namespace,source_key) do update set translations=coalesce(public.translation_dictionary.translations,'{}'::jsonb)||excluded.translations,updated_at=now();