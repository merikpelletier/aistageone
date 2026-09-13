# Admin Pages & Tools — première version

Date : 13 septembre 2026  
État : production candidate; validation connectée et validation de Merik requises

## Source préservée

La source a été récupérée directement depuis le déploiement Vercel de production
`dpl_55Zs4eRMiJah6vKEaj4T4phWXzGn`, créé le 11 septembre 2026. Les fichiers ont
été contrôlés par leur empreinte Vercel avant modification. Le marqueur de dossier
vide `src/components/i18n` n'est pas un fichier téléchargeable et n'affecte pas la
source.

## Décision

L'administration reçoit une entrée `Pages & Tools` fondée sur les pages et outils
réellement présents dans l'application. Chaque élément possède les sections Code,
Look et Configuration.

Les réglages sont conservés dans Supabase. Les réglages de présentation simples
peuvent prendre effet sans nouvelle compilation : couleur de fond, couleur d'accent,
largeur, espacement, navigation existante et visibilité/activation des outils du
Studio. Aucun nouveau comportement produit n'est inventé.

La barre Agent est inscrite comme outil global, inactive et invisible par défaut.
Son administration couvre visibilité, pages, position, libellé, texte de saisie,
modèle déclaré, comportement, permissions, actions et état. Le comportement,
les permissions et les actions sont relus côté serveur; ils ne dépendent pas d'un
texte fourni librement par le navigateur.

## Codeur de base

Le codeur accepte une demande ciblée pour la page ou l'outil sélectionné et offre
initialement `anthropic/claude-sonnet-5` et `meta/codellama-70b-instruct` via la
connexion Replicate existante. Il reçoit uniquement le contexte connu de la surface,
ses réglages courants et ses fichiers sources déclarés. Il conserve une proposition
révisable dans Supabase.

Un correctif de réglages peut être appliqué à Supabase après révision. Un correctif
de code peut être approuvé, mais ne réécrit pas le dépôt depuis le navigateur : il
reste soumis au parcours normal de revue, compilation et publication Vercel. Cette
limite est affichée dans l'interface afin de ne pas présenter une approbation comme
un déploiement.

Cette version n'ajoute ni agent autonome, ni boucle d'essais, ni nouveau fournisseur,
ni copie locale parallèle permanente.
