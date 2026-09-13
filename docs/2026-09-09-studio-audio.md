# Studio Music / Sound FX — livraison candidate

Demande de Merik : Music avec minimax/music-2.6, 1 crédit ; Sound FX avec
sepal/audiogen déjà enregistré dans le catalogue. Modèles et crédits restent
réglables dans l'administration existante. Merik a ensuite fixé Sound FX à
1 crédit également ; le script utilise cette valeur sans question supplémentaire.

Base de travail : aistage-layout-body-fix. Avant modification, les assets publics
index-CZHoq9dI.js et index-C6hOYgH4.css correspondaient à la livraison des voix.
Les changements voix, images, Voûte et téléchargement sont conservés.

Deux cartes dans Studio > Tools > Sound & Voice. Music : instrumental,
paroles fournies ou génération des paroles. Sound FX : description et durée
1–10 secondes. MP3/WAV, lecteur, téléchargement et sauvegarde via le sélecteur
de dossiers de la Voûte existant.

Les fonctions generateMusic et generateSoundFx utilisent le contrôle propriétaire
existant. La migration ajoute seulement les routes choisies, les tarifs initiaux
et la table studio_audio_job. Aucun catalogue ni choix Admin existant remplacé.
La table n'est pas accessible au navigateur. Les fonctions vérifient
l'authentification et la propriété des demandes. Les callbacks ont un secret
aléatoire par demande et relisent la prédiction depuis Replicate.

Chaque demande possède un UUID avant appel, une réservation de crédits, un
identifiant Replicate et un fichier durable dans le bucket media. Les callbacks
enregistrent le résultat même si l'utilisateur ferme le navigateur. Une réponse
réseau incertaine ne provoque jamais automatiquement un deuxième appel payant.
Une incertitude sans callback peut nécessiter une réconciliation administrative.
Les erreurs temporaires de sauvegarde sont reprises avec la même prédiction.
Historique : 30 derniers résultats par outil.

Tests locaux simulés : entrées des trois modes, limites Sound FX,
authentification, propriété, masquage des secrets, idempotence, génération,
stockage, remboursement, callback, refus fournisseur et reprise après erreur.
Les tests de voix existants sont aussi exécutés. Compilation et tests ne
constituent pas une validation du parcours réel connecté.

Déploiement exclusivement par Merik avec Deployer-Music-SoundFX.ps1.
Le script vérifie les empreintes, teste et compile dans un dossier temporaire,
applique uniquement cette migration, demande le prix Sound FX, publie les deux
fonctions puis Vercel production. VerificationSeulement ne publie rien.
Les nouvelles fonctions désactivent le contrôle JWT de la passerelle uniquement
pour permettre les callbacks ; leur authentification utilisateur reste explicite.

Restriction signalée : licence des poids AudioGen CC BY-NC 4.0, droits
commerciaux à vérifier par Merik. Aucun modèle de remplacement choisi.
Sources : https://replicate.com/minimax/music-2.6 ;
https://replicate.com/sepal/audiogen ;
https://github.com/facebookresearch/audiocraft/blob/main/LICENSE_weights

Statut : code candidat, pas de génération payante ni publication par Codex.
