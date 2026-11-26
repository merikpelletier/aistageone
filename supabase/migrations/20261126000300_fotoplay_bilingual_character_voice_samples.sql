insert into public.translation_dictionary (namespace, source_key, translations, synonyms)
values
('ui','fotoplay.voice.english_sample','{"en":"English voice sample","fr":"Échantillon vocal anglais"}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.french_sample','{"en":"French voice sample","fr":"Échantillon vocal français"}'::jsonb,'{}'::jsonb)
on conflict (namespace, source_key) do update
set translations = public.translation_dictionary.translations || excluded.translations,
    updated_at = now();