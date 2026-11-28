insert into public.translation_dictionary(namespace,source_key,translations) values
('ui','Production uses platform credits. Keep this tab visible until rendering finishes.','{"en":"Production uses platform credits. Keep this tab visible until rendering finishes.","fr":"La production utilise les crédits de la plateforme. Gardez cet onglet visible jusqu’à la fin du rendu."}'::jsonb),
('ui','Producing campaign','{"en":"Producing campaign","fr":"Production de la campagne"}'::jsonb),
('ui','Produce campaign videos','{"en":"Produce campaign videos","fr":"Produire les vidéos de la campagne"}'::jsonb),
('ui','Planning production','{"en":"Planning production","fr":"Planification de la production"}'::jsonb),
('ui','Loading production media','{"en":"Loading production media","fr":"Chargement des médias"}'::jsonb),
('ui','Generating narration','{"en":"Generating narration","fr":"Génération de la narration"}'::jsonb),
('ui','Rendering video','{"en":"Rendering video","fr":"Rendu vidéo"}'::jsonb),
('ui','Saving production','{"en":"Saving production","fr":"Enregistrement de la production"}'::jsonb),
('ui','Production completed','{"en":"Production completed","fr":"Production terminée"}'::jsonb),
('ui','Production failed','{"en":"Production failed","fr":"Échec de la production"}'::jsonb),
('ui','Produce video','{"en":"Produce video","fr":"Produire la vidéo"}'::jsonb)
on conflict(namespace,source_key) do nothing;
