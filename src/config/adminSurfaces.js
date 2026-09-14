export const ADMIN_PAGE_SURFACES = [
  ['Index', 'Home', '/'], ['Magazine', 'Magazine', '/Magazine'], ['Salons', 'Chat Rooms', '/Salons'],
  ['Plus', 'Plus', '/Plus'], ['Catalog', 'OLO Shop', '/Catalog'], ['AssetDetail', 'Asset Detail', '/AssetDetail'],
  ['Boutique', 'Shop', '/Boutique'], ['ProductDetail', 'Product Detail', '/ProductDetail'], ['Cart', 'Cart', '/Cart'],
  ['Checkout', 'Checkout', '/Checkout'], ['Membership', 'Membership', '/Membership'], ['MemberDashboard', 'Member Dashboard', '/MemberDashboard'],
  ['MemberListing', 'Member Listing', '/MemberListing'], ['SponsorRequest', 'Sponsor Request', '/SponsorRequest'],
  ['CampaignSubscribe', 'Campaign Subscribe', '/CampaignSubscribe'], ['Studio', 'Studio', '/Studio'], ['MyProjects', 'My Projects', '/MyProjects'],
  ['PitchDecks', 'Pitch Decks', '/PitchDecks'], ['PitchDeckDetail', 'Pitch Deck Detail', '/PitchDeckDetail'],
  ['PitchDeckEditor', 'Pitch Deck Editor', '/PitchDeckEditor'], ['PitchDeckShare', 'Pitch Deck Share', '/PitchDeckShare'],
  ['Content', 'Content', '/Content'], ['Quiz', 'Quiz', '/Quiz'], ['Soumettre', 'Submit', '/Soumettre'], ['Admin', 'Admin', '/Admin'],
].map(([key, label, route]) => ({ type: 'page', key, label, route }));

export const ADMIN_TOOL_SURFACES = [
  ['agent_bar', 'Agent Bar', 'global'], ['bottom_navigation', 'Bottom Navigation', 'global'], ['install_prompt', 'Install Prompt', 'global'],
  ['story_blocks', 'Story Blocks', 'studio'], ['actor_designer', 'Actor Studio', 'studio'], ['voice', 'Record Voice', 'studio'],
  ['dubbing', 'Dubbing Studio', 'studio'], ['tts', 'Text to Speech', 'studio'], ['lip_sync', 'Lip Sync', 'studio'],
  ['music', 'Music', 'studio'], ['sound_fx', 'Sound FX', 'studio'], ['animate', 'Animate Image', 'studio'],
  ['ai_video', 'AI Video', 'studio'], ['video_tools', 'Video Reference', 'studio'], ['free_timeline', 'Timeline Generator', 'studio'],
  ['compose', 'Compose Scene', 'studio'], ['layout', 'Layout', 'studio'], ['pitch_deck', 'Pitch Deck Builder', 'studio'],
  ['olo_shop', 'OLO Shop', 'studio'], ['new_set', 'New Set', 'studio'], ['vault', 'Vault', 'studio'],
].map(([key, label, scope]) => ({ type: 'tool', key, label, scope }));

const TOOL_SOURCE_FILES = {
  agent_bar: ['src/Layout.jsx', 'src/components/PersistentAIBar.jsx', 'supabase/functions/agent-conversations/index.ts'],
  bottom_navigation: ['src/components/ConfigurableBottomNav.jsx', 'src/Layout.jsx'], install_prompt: ['src/components/InstallPrompt.jsx', 'src/Layout.jsx'],
  story_blocks: ['src/components/studio/StoryBlocks.jsx', 'src/components/studio/AuthorStoryBlocks.jsx'], actor_designer: ['src/components/studio/LabWorkspace.jsx', 'src/components/studio/InlineHeadshot.jsx'],
  voice: ['src/components/studio/VoiceRecorder.jsx'], dubbing: ['src/components/studio/DubbingStudio.jsx'], tts: ['src/components/studio/TextToSpeech.jsx'],
  lip_sync: ['src/components/studio/LipSync.jsx'], music: ['src/components/studio/StudioAudioTool.jsx'], sound_fx: ['src/components/studio/StudioAudioTool.jsx'],
  animate: ['src/components/studio/AnimateImage.jsx'], ai_video: ['src/components/studio/VideoTools.jsx'], video_tools: ['src/components/studio/VideoTools.jsx'],
  free_timeline: ['src/pages/Studio.jsx', 'src/components/production/TimelineBlock.jsx'], compose: ['src/components/studio/LabWorkspace.jsx'],
  layout: ['src/components/studio/LayoutTool.jsx'], pitch_deck: ['src/pages/PitchDeckEditor.jsx'], olo_shop: ['src/pages/Catalog.jsx'],
  new_set: ['src/components/studio/SetAssetEditor.jsx'], vault: ['src/components/VaultSection.jsx'],
};

ADMIN_PAGE_SURFACES.forEach((surface) => { surface.source_files = [`src/pages/${surface.key}.jsx`]; });
const STUDIO_PAGE_SURFACE = ADMIN_PAGE_SURFACES.find((surface) => surface.key === 'Studio');
if (STUDIO_PAGE_SURFACE) { STUDIO_PAGE_SURFACE.source_files = ['src/pages/Studio.jsx', 'src/components/studio/LabWorkspace.jsx']; }
ADMIN_TOOL_SURFACES.forEach((surface) => { surface.source_files = TOOL_SOURCE_FILES[surface.key] || ['src/pages/Studio.jsx']; });

export const ADMIN_SURFACES = [...ADMIN_PAGE_SURFACES, ...ADMIN_TOOL_SURFACES];

export const CODER_MODELS = [
  { value: 'anthropic/claude-sonnet-5', label: 'Claude Sonnet 5' },
  { value: 'meta/codellama-70b-instruct', label: 'CodeLlama 70B Instruct' },
];

export const defaultSurfaceSettings = (surface) => ({
  surface_type: surface.type,
  surface_key: surface.key,
  label: surface.label,
  route: surface.route || null,
  visible: surface.key === 'agent_bar' ? false : true,
  active: surface.key === 'agent_bar' ? false : true,
  look: {
    background_color: '',
    accent_color: '#facc15',
    content_width: 'full',
    spacing: 'default',
  },
  configuration: surface.key === 'agent_bar' ? {
    order: ADMIN_SURFACES.findIndex((item) => item.type === surface.type && item.key === surface.key),
    pages: ['Studio'],
    position: 'top',
    label: 'Production Assistant',
    placeholder: 'Ask the AI...',
    model: '',
    prompt: '',
    permissions: [],
    actions: [],
    agent_name: 'production_assistant',
  } : {
    scope: surface.scope || 'page',
    order: ADMIN_SURFACES.findIndex((item) => item.type === surface.type && item.key === surface.key),
    show_navigation: surface.type === 'page' ? surface.key !== 'Admin' : undefined,
    ...(surface.type === 'page' && surface.key === 'Studio' ? {
      home_items: [
        { key: 'my_projects', label: 'My Projects', description: 'Dossiers in production', icon: 'Home', background_image: '', visible: true, order: 0 },
        { key: 'production_kits', label: 'Production Kits', description: 'Your actors & sets for AI tools', icon: 'Clapperboard', background_image: '', visible: false, order: 1 },
        { key: 'stages', label: 'Stages', description: 'Sketch generators', icon: 'Theater', background_image: '', visible: true, order: 2 },
        { key: 'tools', label: 'Tools', description: 'AI production tools', icon: 'Wrench', background_image: '', visible: true, order: 3 },
        { key: 'my_vault', label: 'My Vault', description: 'Saved assets & references', icon: 'Bookmark', background_image: '', visible: true, order: 4 },
        { key: 'fotoplay', label: 'FotoPlay', description: 'Interactive AI storytelling', icon: 'BookOpen', background_image: '', visible: true, order: 5 },
      ],
      studio_views: [
        { key: 'home', label: 'Home', icon: 'Home', background_image: '', visible: true, order: 0 },
        { key: 'library', label: 'Production Kits', icon: 'Clapperboard', background_image: '', visible: true, order: 1 },
        { key: 'lab', label: 'Fun / Stages', icon: 'Theater', background_image: '', visible: true, order: 2 },
        { key: 'tools', label: 'Tools', icon: 'Wrench', background_image: '', visible: true, order: 3 },
        { key: 'stories', label: 'FotoPlay', icon: 'BookOpen', background_image: '', visible: true, order: 4 },
      ],
      fotoplay_views: [
        { key: 'gateway', label: 'Gateway', description: 'Choose your experience entry screen', background_image: '', visible: true, order: 0 },
        { key: 'author', label: 'Author', description: 'Private author workspace', background_image: '', visible: true, order: 1 },
        { key: 'browse', label: 'Browse', description: 'Browse available Story Packs', background_image: '', visible: true, order: 2 },
        { key: 'packDetails', label: 'Pack Details', description: 'Story Pack characters & existing sessions' },
        { key: 'topicSelection', label: 'Topic Selection', description: 'Choose the starting point for a hero' },
        { key: 'arcDefinition', label: 'Arc Definition', description: 'Design the AI-proposed story arc' },
        { key: 'characterEditor', label: 'Character Editor', description: 'Create your own hero character' },
        { key: 'session', label: 'Session', description: 'Story player and chapter production' },
      ],
    } : {}),
  },
});
