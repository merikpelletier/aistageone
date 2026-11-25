alter table public.dossier add column if not exists mobile_app_name text, add column if not exists mobile_icon_192 text, add column if not exists mobile_icon_512 text;
insert into public.translation_dictionary (namespace,source_key,translations) values
('ui','Mobile application name','{"fr":"Nom de l’application mobile","en":"Mobile application name"}'),
('ui','Application icon','{"fr":"Icône de l’application","en":"Application icon"}'),
('ui','Upload application icon','{"fr":"Importer une icône","en":"Upload application icon"}'),
('ui','Square icon recommended','{"fr":"Image carrée de 512 × 512 pixels recommandée.","en":"Square 512 × 512 pixel image recommended."}'),
('ui','Install application','{"fr":"Installer l’application","en":"Install application"}'),
('ui','Install application instructions','{"fr":"Dans le menu de votre navigateur, choisissez Ajouter à l’écran d’accueil ou Installer l’application.","en":"In your browser menu, choose Add to Home Screen or Install app."}'),
('ui','Unable to upload application icon','{"fr":"Impossible d’importer l’icône.","en":"Unable to upload application icon."}')
on conflict(namespace,source_key) do update set translations=coalesce(public.translation_dictionary.translations,'{}'::jsonb)||excluded.translations,updated_at=now();
