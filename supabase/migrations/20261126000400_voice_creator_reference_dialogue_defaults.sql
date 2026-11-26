insert into public.translation_dictionary (namespace, source_key, translations, synonyms)
values
('ui','voice_creator.reference_sample.fr','{"en":"Hello. It is a pleasure to meet you. Today, I would like to share a little story with you. I hope you enjoy listening.","fr":"Bonjour. Je suis heureux de vous rencontrer. Aujourd’hui, j’aimerais vous raconter une petite histoire. J’espère que vous prendrez plaisir à l’écouter."}'::jsonb,'{}'::jsonb),
('ui','voice_creator.reference_sample.en','{"en":"Hello. It is a pleasure to meet you. Today, I would like to share a little story with you. I hope you enjoy listening.","fr":"Hello. It is a pleasure to meet you. Today, I would like to share a little story with you. I hope you enjoy listening."}'::jsonb,'{}'::jsonb),
('ui','voice_creator.insert_suggested_text','{"en":"Insert suggested text","fr":"Insérer le texte suggéré"}'::jsonb,'{}'::jsonb)
on conflict (namespace, source_key) do update
set translations = public.translation_dictionary.translations || excluded.translations,
    updated_at = now();