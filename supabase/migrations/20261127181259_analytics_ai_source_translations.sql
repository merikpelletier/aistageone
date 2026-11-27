insert into public.translation_dictionary(namespace,source_key,translations) values
('ui','Successful model calls','{"en":"Successful model calls","fr":"Appels réussis"}'::jsonb),
('ui','Failed model calls','{"en":"Failed model calls","fr":"Appels en erreur"}'::jsonb),
('ui','Unresolved model calls','{"en":"Unresolved model calls","fr":"Appels sans statut final"}'::jsonb),
('ui','Canceled model calls','{"en":"Canceled model calls","fr":"Appels annulés"}'::jsonb),
('ui','Only recorded provider costs; not total spending.','{"en":"Only recorded provider costs; not total spending.","fr":"Coûts fournisseurs enregistrés uniquement ; pas les dépenses totales."}'::jsonb),
('ui','Credits consumed','{"en":"Credits consumed","fr":"Crédits consommés"}'::jsonb),
('ui','Model call outcomes come from the current call journal. Missing costs are unavailable, not zero.','{"en":"Model call outcomes come from the current call journal. Missing costs are unavailable, not zero.","fr":"Les résultats proviennent du journal actuel des appels. Les coûts manquants sont indisponibles, et non nuls."}'::jsonb),
('ui','Credits charged to members are separate from provider costs. Administrative exemptions are unchanged.','{"en":"Credits charged to members are separate from provider costs. Administrative exemptions are unchanged.","fr":"Les crédits facturés aux membres sont distincts des coûts fournisseurs. Les exemptions administrateur restent inchangées."}'::jsonb),
('ui','Historical usage events','{"en":"Historical usage events","fr":"Événements historiques d’utilisation"}'::jsonb),
('ui','Provider cost records','{"en":"Provider cost records","fr":"Coûts fournisseurs enregistrés"}'::jsonb),
('ui','Provider statuses checked','{"en":"Provider statuses checked","fr":"Statuts fournisseurs vérifiés"}'::jsonb),
('ui','Unavailable provider predictions','{"en":"Unavailable provider predictions","fr":"Prédictions fournisseurs indisponibles"}'::jsonb),
('ui','Last historical usage event','{"en":"Last historical usage event","fr":"Dernier événement historique"}'::jsonb),
('ui','Last provider status check','{"en":"Last provider status check","fr":"Dernière vérification fournisseur"}'::jsonb),
('ui','Usage by model and tool','{"en":"Usage by model and tool","fr":"Utilisation par modèle et outil"}'::jsonb),
('ui','Model','{"en":"Model","fr":"Modèle"}'::jsonb)
on conflict(namespace,source_key) do nothing;
