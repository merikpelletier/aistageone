# Catalogue vocal commun — production candidate

Demande de Merik : élargir les voix dans tous les outils, pas seulement Story Blocks.

Référence avant modification : le site public sert index-ChwNCEP7.js, correspondant à la dernière compilation Vault/Download validée visuellement par Merik. Les entrées des fonctions Supabase ont été comparées aux versions distantes : generateSpeech v9, generatePitchSpeech v2, regenerateNarration v7, generateBlockVideos v8, generate-speech v6.

Le catalogue du modèle elevenlabs/v3 approuvé dans ai_model_catalog expose 26 voix. Une seule liste, dans supabase/functions/_shared/voiceCatalog.js, est utilisée par le frontend et les validations serveur. Aucune identité, nationalité ni étiquette d'accent n'est inventée. Le catalogue complet ElevenLabs direct n'est pas connecté : la portée est celle du modèle Replicate approuvé, pas toute la bibliothèque du fournisseur.

Surfaces : Author, Story Blocks participatif, Text to Speech, timeline de production, lecteur Pitch Deck, Production Assistant, barre IA persistante et choix vocal administratif. Les générateurs/lecteurs proposent les 74 langues du catalogue existant de Text to Speech ; la configuration administrative reste un choix de voix. Les aperçus restent ceux du cache anglais existant. Changer la langue ne traduit pas le texte et ne garantit pas un accent régional.

La langue du segment Author reste dans son JSON de projet. La langue des sessions participatives utilise une colonne narrator_language séparée de story_memory : aucune responsabilité du moteur de simulation n'est modifiée. Le lecteur Pitch distingue les caches par voix et langue ; les réponses d'une lecture précédente sont ignorées après changement.

Les entrées serveur retournent les deux noms d'adresse audio attendus par les outils existants. La reprise de narration accepte désormais le même catalogue. La route historique generate-speech garde sa clé de routage approuvée mais transmet les champs voix/texte/langue nécessaires au modèle ElevenLabs choisi par Merik. Aucun modèle, tarif, droit d'accès ou garde de facturation n'a été changé. Le runtime de contrôle local existant est conservé, notamment sa capture anticipée du corps de requête et sa correction du transfert fetch ; ne pas le remplacer par les anciens exemplaires embarqués dans certaines fonctions.

Contrôles : dix tests automatisés, avec services simulés et assemblage des cinq fonctions serveur, compilation Vite et contrats homepage/studio. Pas de génération réelle, pas de débit, pas de publication exécutés par Codex. Validation connectée et qualité vocale restent à effectuer après publication par Merik.

Déploiement : le script dédié vérifie les empreintes, exécute les tests et compile dans un dossier temporaire. Il demande si nécessaire une connexion Supabase dans PowerShell, applique uniquement l'ajout idempotent de langue, publie les cinq fonctions (authentification JWT conservée) puis le frontend Vercel. Il n'applique pas les anciennes migrations en bloc. Un échec interrompt la suite et précise si une partie serveur a déjà été publiée.

Sources : https://replicate.com/elevenlabs/v3/api/schema ; catalogue approuvé du projet Supabase dhpubzhobcccfbcmbvua ; https://supabase.com/docs/guides/functions/deploy.
