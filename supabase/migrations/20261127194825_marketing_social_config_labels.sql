insert into public.translation_dictionary(namespace,source_key,translations) values
('ui','Social Accounts','{"en":"Social Accounts","fr":"Comptes sociaux"}'),
('ui','Save configuration','{"en":"Save configuration","fr":"Enregistrer la configuration"}'),
('ui','Unable to save configuration','{"en":"Unable to save configuration","fr":"Impossible d’enregistrer la configuration"}'),
('ui','Unable to load configuration','{"en":"Unable to load configuration","fr":"Impossible de charger la configuration"}'),
('ui','Configuration saved — authorization pending','{"en":"Configuration saved — authorization pending","fr":"Configuration enregistrée — autorisation en attente"}'),
('ui','Not configured','{"en":"Not configured","fr":"Non configuré"}'),
('ui','OAuth authorization is not available until the provider integration is installed.','{"en":"OAuth authorization is not available until the provider integration is installed.","fr":"L’autorisation OAuth sera disponible après installation de l’intégration fournisseur."}'),
('ui','Open developer console','{"en":"Open developer console","fr":"Ouvrir la console développeur"}') on conflict(namespace,source_key) do nothing;