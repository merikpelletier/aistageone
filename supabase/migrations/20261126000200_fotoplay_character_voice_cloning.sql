insert into public.translation_dictionary (namespace, source_key, translations, synonyms)
values
('ui','fotoplay.voice.character_voices','{"en":"Character voices","fr":"Voix des personnages"}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.character_voices_help','{"en":"Connect a saved Vault sample to a FotoPlay character. Dialogue generation will use Qwen voice cloning.","fr":"Associez un échantillon vocal de la Voûte à un personnage FotoPlay. La génération des dialogues utilisera le clonage vocal Qwen."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.pilot_voice_preserved','{"en":"Existing AI Pilot voice connection is preserved.","fr":"La connexion vocale AI Pilot existante est conservée."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.sample_selected','{"en":"Vault voice sample selected.","fr":"Échantillon vocal de la Voûte sélectionné."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.no_sample','{"en":"No voice sample assigned yet.","fr":"Aucun échantillon vocal associé."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.choose_vault_sample','{"en":"Choose audio sample from Vault","fr":"Choisir un échantillon audio dans la Voûte"}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.reference_text','{"en":"Exact reference text spoken in the sample","fr":"Texte exact prononcé dans l’échantillon"}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.reference_text_placeholder','{"en":"Enter the exact words spoken in this audio sample…","fr":"Saisissez les mots exacts prononcés dans cet échantillon…"}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.remove_sample','{"en":"Remove sample","fr":"Retirer l’échantillon"}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.no_characters','{"en":"Add characters to this FotoPlay project first.","fr":"Ajoutez d’abord des personnages à ce projet FotoPlay."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.sample_assigned','{"en":"Voice sample assigned to character.","fr":"Échantillon vocal associé au personnage."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.choose_character_first','{"en":"Choose a character first.","fr":"Choisissez d’abord un personnage."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.dialogue_required','{"en":"Add dialogue text first.","fr":"Ajoutez d’abord le texte du dialogue."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.sample_required','{"en":"Assign a voice sample to this character first.","fr":"Associez d’abord un échantillon vocal à ce personnage."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.reference_text_required','{"en":"Enter the exact text spoken in the voice sample first.","fr":"Saisissez d’abord le texte exact prononcé dans l’échantillon vocal."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.no_audio','{"en":"No dialogue audio was returned.","fr":"Aucun audio de dialogue n’a été retourné."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.dialogue_generated','{"en":"Character dialogue generated with Qwen.","fr":"Dialogue du personnage généré avec Qwen."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.dialogue_failed','{"en":"Dialogue voice generation failed.","fr":"La génération vocale du dialogue a échoué."}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.regenerate_dialogue','{"en":"Regenerate dialogue with character voice","fr":"Régénérer le dialogue avec la voix du personnage"}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.generate_dialogue','{"en":"Generate dialogue with character voice","fr":"Générer le dialogue avec la voix du personnage"}'::jsonb,'{}'::jsonb),
('ui','fotoplay.voice.custom_sample_linked','{"en":"Custom voice sample linked","fr":"Échantillon vocal personnalisé associé"}'::jsonb,'{}'::jsonb)
on conflict (namespace, source_key) do update
set translations = public.translation_dictionary.translations || excluded.translations,
    updated_at = now();