// Shared landing-page French defaults. Admin overrides are stored separately in fr_content.
export const FR_TEXT = {
  "AI STAGE ONE": "LE PLATEAU IA",
  "Private Preview": "Aperçu privé",
  "PRIVATE PREVIEW": "APERÇU PRIVÉ",
  "Login": "Connexion",
  "THE STAGE IS ALMOST YOURS.": "LA SCÈNE EST BIENTÔT À VOUS.",
  "Create. Perform. Publish.": "Créez. Interprétez. Publiez.",
  "PEOPLE × STORIES × AI × A GLOBAL STAGE": "DES TALENTS × DES HISTOIRES × L’IA × UNE SCÈNE MONDIALE",
  "A new platform where stories, characters, images, voices and creators come together.": "Une nouvelle plateforme où se rencontrent histoires, personnages, images, voix et talents créatifs.",
  "PRE-REGISTER": "PRÉINSCRIPTION",
  "JOIN THE TEAM": "REJOINDRE L’ÉQUIPE",
  "Full platform access is currently limited to Admins and invited Guests.": "L’accès complet à la plateforme est actuellement réservé aux administrateurs et aux invités.",
  "VISION": "VISION",
  "INSIDE THE STUDIO": "DÉCOUVREZ LE STUDIO",
  "One place where everything happens.": "Un seul espace pour donner vie à toutes vos idées.",
  "A CREATIVE PLATFORM FOR A NEW GENERATION": "UNE PLATEFORME CRÉATIVE POUR UNE NOUVELLE GÉNÉRATION",
  "A unified creative studio for storytellers, performers and innovators — from concept and character to voice, music, scene and final publication.": "Un studio de création intégré pour les auteurs, les interprètes et les innovateurs : du concept aux personnages, de la voix et de la musique à la mise en scène et à la publication.",
  "Play preview": "Voir l’aperçu",
  "NOT JUST WATCH. JOIN THE CAST.": "NE FAITES PAS QUE REGARDER. ENTREZ EN SCÈNE.",
  "Real people. Bigger stories.": "De vrais talents. Des histoires sans limites.",
  "A NEW KIND OF ENTERTAINMENT": "UNE NOUVELLE FORME DE DIVERTISSEMENT",
  "Creators, performers, designers, writers, developers and partners can all have a place on the stage.": "Créateurs, interprètes, designers, auteurs, développeurs et partenaires : chacun peut trouver sa place sur scène.",
  "PRE-LAUNCH FORMS": "FORMULAIRES DE PRÉLANCEMENT",
  "PRE-REGISTER FOR LAUNCH ACCESS": "PRÉINSCRIVEZ-VOUS POUR LE LANCEMENT",
  "SENDING…": "ENVOI EN COURS…",
  "BE PART OF WHAT'S NEXT": "PARTICIPEZ À LA SUITE",
  "Get early updates, behind-the-scenes content and be among the first to know when we open the stage to more creators.": "Recevez les premières nouvelles et des contenus en coulisses. Soyez parmi les premiers informés de l’ouverture de la plateforme à davantage de créateurs.",
  "PRE-REGISTER →": "SE PRÉINSCRIRE →",
  "You are already on the pre-launch list.": "Vous êtes déjà sur la liste de prélancement.",
  "Your name": "Votre nom",
  "Email": "Courriel",
  "CREATIVE PEOPLE. REAL IMPACT.": "DES TALENTS CRÉATIFS. UN IMPACT RÉEL.",
  "We're looking for exceptional creatives, technologists and partners to help shape the future of AI-powered entertainment.": "Nous recherchons des talents créatifs, des spécialistes en technologie et des partenaires d’exception pour façonner l’avenir du divertissement propulsé par l’IA.",
  "SEND APPLICATION →": "ENVOYER MA CANDIDATURE →",
  "Unable to send your application right now.": "Impossible d’envoyer votre candidature pour le moment.",
  "Role / specialty": "Rôle / spécialité",
  "Portfolio / website": "Portfolio / site Web",
  "Tell us what you would like to bring to AI STAGE ONE": "Dites-nous ce que vous aimeriez apporter au PLATEAU IA",
  "A global stage for a new creative generation.": "Une scène mondiale pour une nouvelle génération de talents créatifs.",
  "Vision": "Vision",
  "Studio": "Studio",
  "Pre-register": "Préinscription",
  "Shape your story, frame by frame.": "Donnez forme à votre histoire, image par image.",
  "Creators": "Créateurs",
  "& Performers": "et interprètes",
  "AI is not the END of CREATIVITY": "L’IA N’EST PAS LA FIN DE LA CRÉATIVITÉ",
  "Evolution of Content": "L’ÉVOLUTION DU CONTENU",
  "Original AI TOOLS": "OUTILS IA ORIGINAUX",
  "Build and edit your story.": "Créez et façonnez votre histoire.",
  "Writers": "Auteurs",
  "& Designers": "et designers",
  "Creator / Performer": "Créateur / Interprète",
  "Writer / Designer": "Auteur / Designer",
  "Developer / Tech": "Développeur / Technologie",
  "Brand / Partner": "Marque / Partenaire",
  "Viewer / Fan": "Spectateur / Fan",
  "Other": "Autre",
  "Assets Shop": "Boutique d’assets",
  "Build your world, one asset at a time.": "Construisez votre univers, un élément à la fois.",
  "No subscription fees!": "AUCUN FRAIS D’ABONNEMENT !",
  "Developers": "Développeurs",
  "& Tech Talent": "et talents technologiques",
  "The Dashboard": "Le tableau de bord",
  "Control your studio. Grow your audience.": "Gérez votre studio. Développez votre public.",
  "Partners": "Partenaires",
  "& Collaborators": "et collaborateurs",
  "More Than Watching": "BIEN PLUS QUE REGARDER",
  "You are on the list. We will keep you informed.": "Vous êtes sur la liste. Nous vous tiendrons au courant.",
  "Unable to register right now.": "Impossible de vous inscrire pour le moment.",
  "Thank you. Your application has been received.": "Merci. Nous avons reçu votre candidature."
};

export const translateLanding = (value, language) => language === 'fr' && typeof value === 'string' ? (FR_TEXT[value] ?? value) : value;

export const localizeLandingRecord = (record, language) => {
  if (language !== 'fr') return record;
  const overrides = record.fr_content && typeof record.fr_content === 'object' ? record.fr_content : {};
  const result = { ...record };
  for (const key of ['title','subtitle','eyebrow','body','button_1_label','button_2_label','link_label']) {
    if (typeof overrides[key] === 'string' && overrides[key].trim()) result[key] = overrides[key];
    else result[key] = translateLanding(record[key], language);
  }
  // URLs used as submission feedback messages are editable; navigation URLs remain unchanged.
  if (['pre_register','join_team'].includes(record.section_key)) {
    for (const key of ['button_1_url','button_2_url']) {
      if (typeof overrides[key] === 'string' && overrides[key].trim()) result[key] = overrides[key];
      else result[key] = translateLanding(record[key], language);
    }
  }
  if (typeof overrides.media_url === 'string' && overrides.media_url.trim()) {
    result.media_url = overrides.media_url;
    result.media_type = overrides.media_type || record.media_type;
    if (typeof overrides.poster_url === 'string' && overrides.poster_url.trim()) result.poster_url = overrides.poster_url;
  }
  return result;
};
