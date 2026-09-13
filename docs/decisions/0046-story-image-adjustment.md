# Ajustement individuel des images Story Blocks — 2026-09-09

État : code candidat compilé; validation connectée avec génération payante non exécutée. Merik effectue lui-même le déploiement avec le script PowerShell livré. Aucun déploiement par Codex.

## Source vérifiée avant modification

Production Vercel : dpl_F3iGZuL6QP5uACynNBFXhvrdZt6i, alias aistage-one.vercel.app, READY, créé le 8 septembre 2026 à 23:37 heure de Toronto (9 septembre UTC). Connexion au projet confirmée via l'intégration Vercel.

La copie aistage-layout-body-fix correspond dans src à aistage-language-removal-20260908. La compilation de cette dernière avec la configuration publique existante produit les mêmes noms de bundles que la production : index-NVutJgyw.js et index-R7WTusJv.css. Le journal de la tâche du 8 septembre confirme aistage-layout-body-fix comme source du dernier déploiement manuel. La copie aistage-oloshop-inventory n'est pas utilisée.

## Fonction

Dans l'atelier Auteur, Adjust image ou Adjust panel ouvre l'image existante et accepte une instruction libre. Une référence de détail facultative peut provenir des références sélectionnées ou des images du chapitre. Le premier fichier envoyé est toujours l'image à modifier; le second sert seulement au détail demandé.

Le service GenerateImage existant reçoit l'image réelle et l'instruction d'édition; aucune génération du segment entier ou d'une autre case n'est déclenchée. Le contrôle des modèles et la facturation compose_scene existants restent applicables. Aucun modèle ni tarif n'est changé.

Le résultat est un candidat à accepter ou rejeter, conservé dans la fenêtre jusqu'à sa fermeture. La fermeture avant acceptation ne remplace pas l'image; elle n'annule pas un appel fournisseur déjà lancé. Chaque candidat généré est facturé selon le service existant, même s'il est rejeté. L'original est épinglé dans le JSON privé du segment lors de la première acceptation; il reste disponible après rechargement et au-delà des vingt événements d'historique conservés. Aucune migration SQL n'est nécessaire.

L'acceptation d'une case réassemble une page existante à partir des images déjà produites et réapplique les bulles avec le rendu local. Les autres cases, l'audio, les autres segments et la référence maîtresse ne sont pas modifiés. Une image seule est éditée avant superposition des bulles. Le segment touché repasse en brouillon pour réapprobation. La sauvegarde de l'ajustement n'est pas optimiste : son échec garde le candidat disponible et ne remplace pas l'état local par une sauvegarde non confirmée. Une empreinte vérifie que les images, le format et les bulles n'ont pas changé pendant l'appel.

L'édition IA ne garantit pas une invariance pixel par pixel hors du détail demandé; la comparaison visuelle et l'acceptation restent nécessaires.

## Vérifications

- Compilation Vite avec configLoader native et contrôles de conservation : réussis.
- Tests du choix de l'image source, de la conservation permanente de l'original, de l'isolation des cases, des conflits de version et du prompt : réussis.
- Parcours connecté fournisseur → stockage → crédits → acceptation → rechargement → restauration : à vérifier; aucun appel IA payant effectué par Codex.

Le contrat des cinq sphères de simulation et les responsabilités différées restent inchangés : cette modification concerne seulement les médias de l'atelier Auteur.
