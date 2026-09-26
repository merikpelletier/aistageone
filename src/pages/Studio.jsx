import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useAppContext } from '@/lib/AppContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Layers, Camera, ChevronRight, ChevronLeft, Film, Plus, X, Mic, Upload, Music, Type, Sparkles, BookOpen, Home, Clapperboard, Theater, Wrench, PanelLeft, FolderOpen } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const HOME_ICON_MAP = { Home, Clapperboard, Theater, Wrench, Bookmark: undefined, BookOpen, Users, Layers, Film };
const DEFAULT_HOME_ITEMS = [
  { key: 'my_projects', label: 'My Projects', description: 'Dossiers in production', icon: 'Home', background_image: '', visible: true, order: 0 },
  { key: 'production_kits', label: 'Production Kits', description: 'Your actors & sets for AI tools', icon: 'Clapperboard', background_image: '', visible: false, order: 1 },
  { key: 'stages', label: 'Stages', description: 'Sketch generators', icon: 'Theater', background_image: '', visible: true, order: 2 },
  { key: 'tools', label: 'Tools', description: 'AI production tools', icon: 'Wrench', background_image: '', visible: true, order: 3 },
  { key: 'my_vault', label: 'My Vault', description: 'Saved assets & references', icon: 'Bookmark', background_image: '', visible: true, order: 4 },
  { key: 'fotoplay', label: 'FotoPlay', description: 'Interactive AI storytelling', icon: 'BookOpen', background_image: '', visible: true, order: 5 },
];
import CharacterSheetEditor from '@/components/CharacterSheetEditor';
import SetAssetEditor from '@/components/studio/SetAssetEditor';
import KitProductionRoom from '@/components/KitProductionRoom';
import VoiceRecorder from '@/components/studio/VoiceRecorder';
import AudioUploader from '@/components/studio/AudioUploader';
import DubbingStudio from '@/components/studio/DubbingStudio';
import TextToSpeech from '@/components/studio/TextToSpeech';
import VideoTools from '@/components/studio/VideoTools';
import LipSync from '@/components/studio/LipSync';
import AnimateImage from '@/components/studio/AnimateImage';
import ProductionContextInfo from '@/components/ProductionContextInfo';
import AvailableProjectsPortal from '@/components/studio/AvailableProjectsPortal';
import SketchStudio from '@/components/studio/SketchStudio';
import KitAssetViewer from '@/components/KitAssetViewer';
import LabWorkspace from '@/components/studio/LabWorkspace';
import StoryBlocks from '@/components/studio/StoryBlocks';
import VaultSection from '@/components/VaultSection';
import LayoutTool from '@/components/studio/LayoutTool';
import { Bookmark } from 'lucide-react';
HOME_ICON_MAP.Bookmark = Bookmark;

const STUDIO_SHELL_TOOLS = [
  { key: 'home', label: 'Home', icon: Home, action: 'view' },
  { key: 'stories', label: 'FotoPlay', icon: BookOpen, action: 'view' },
  { key: 'actor', label: 'Actor Creator', icon: Users, action: 'actor' },
  { key: 'set', label: 'Set Creator', icon: Layers, action: 'set' },
  { key: 'lab', label: 'Stages', icon: Theater, action: 'view' },
  { key: 'tools', label: 'AI Tools', icon: Wrench, action: 'view' },
  { key: 'vault', label: 'Vault', icon: Bookmark, action: 'view' },
];

function StudioShellButton({ tool, active, onClick, compact = false }) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={tool.label}
      aria-label={tool.label}
      className={`group flex flex-col items-center justify-center gap-1.5 transition-colors ${compact ? 'min-w-[64px] px-2 py-2' : 'w-full px-2 py-3'} ${
        active ? 'bg-yellow-400 text-black' : 'text-white/75 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon size={compact ? 20 : 22} strokeWidth={2} />
      <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold leading-tight text-center`}>{tool.label}</span>
    </button>
  );
}

function UnifiedStudioShell({ activeKey, onTool, title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#202328] text-white">
      <div className="sticky top-0 z-40 h-16 border-b border-white/10 bg-[#202328]/95 backdrop-blur flex items-center px-4 md:px-5 gap-3">
        <div className="w-9 h-9 bg-yellow-400 text-black flex items-center justify-center flex-shrink-0">
          <PanelLeft size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 font-semibold">AISTAGE.ONE</div>
          <div className="font-semibold text-sm truncate">{title || 'Studio'}</div>
        </div>
        {subtitle && <div className="hidden lg:block text-xs text-white/50 truncate max-w-[38vw]">{subtitle}</div>}
      </div>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="hidden md:flex sticky top-16 self-start h-[calc(100vh-4rem)] w-[88px] flex-shrink-0 bg-[#17191d] border-r border-white/10 flex-col overflow-y-auto">
          {STUDIO_SHELL_TOOLS.map((tool) => (
            <StudioShellButton key={tool.key} tool={tool} active={activeKey === tool.key} onClick={() => onTool(tool)} />
          ))}
        </aside>

        <main className="min-w-0 flex-1 bg-yellow-400 text-black pb-24 md:pb-8">
          {children}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[74px] bg-[#17191d] border-t border-white/10 overflow-x-auto">
        <div className="h-full flex items-stretch min-w-max">
          {STUDIO_SHELL_TOOLS.map((tool) => (
            <StudioShellButton key={tool.key} tool={tool} compact active={activeKey === tool.key} onClick={() => onTool(tool)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function StudioToolOverlay({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[45] bg-black/45 backdrop-blur-[1px] md:pl-[88px] md:pt-16">
      <motion.div
        initial={{ opacity: 0, x: 28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 28 }}
        className="h-full w-full bg-yellow-400 text-black shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-black/15 bg-yellow-400 flex-shrink-0">
          <div className="font-bold text-lg">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 bg-black text-yellow-400 flex items-center justify-center"
            aria-label={`Close ${title}`}
          >
            <X size={19} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-20 md:pb-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
}


// ── Sub-components ──────────────────────────────────────────────────────────

function StudioCard({ icon: Icon, iconImage, title, subtitle, color, onClick, badge, backgroundImage }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      className="w-full text-left bg-black rounded-3xl p-6 relative overflow-hidden flex items-center gap-5 active:opacity-90 transition-opacity"
    >
      {backgroundImage && <div className="absolute inset-0 bg-black/50" />}
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 relative overflow-hidden ${color}`}>
        {iconImage ? <img src={iconImage} alt="" className="w-full h-full object-cover" /> : <Icon size={28} className="text-black" />}
      </div>
      <div className="flex-1 min-w-0 relative">
        <p className="text-white font-semibold tracking-wide text-base">{title}</p>
        <p className="text-yellow-400 text-sm mt-1 font-medium">{subtitle}</p>
      </div>
      {badge > 0 && (
        <span className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <ChevronRight size={20} className="text-yellow-400 flex-shrink-0 relative" />
    </motion.button>
  );
}

function ActorPolaroid({ sheet, onEdit }) {
  const photos = (() => { try { return JSON.parse(sheet.character_photos?.[0] || '{}'); } catch { return {}; } })();
  const photo = photos.portrait || photos.front || Object.values(photos)[0];
  return (
    <motion.div whileTap={{ scale: 0.97 }} onClick={onEdit} className="bg-black rounded-3xl overflow-hidden cursor-pointer">
      <div className="aspect-[3/4] bg-white/5">
        {photo ? (
          <img src={photo} alt={sheet.character_name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Users size={40} className="text-white/20" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-white text-sm font-semibold truncate">{sheet.character_name || 'Unnamed'}</p>
        {sheet.character_traits?.length > 0 && (
          <p className="text-yellow-400 text-xs mt-1 truncate">{sheet.character_traits.slice(0, 2).join(' · ')}</p>
        )}
      </div>
    </motion.div>
  );
}

function SetCard({ asset, onEdit }) {
  const img = asset.images?.[0];
  return (
    <motion.div whileTap={{ scale: 0.97 }} onClick={onEdit} className="bg-black rounded-3xl overflow-hidden cursor-pointer">
      <div className="aspect-square bg-white/5">
        {img ? (
          <img src={img} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Layers size={36} className="text-white/20" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-white text-sm font-semibold truncate">{asset.name || 'Unnamed'}</p>
        {asset.tags?.length > 0 && (
          <p className="text-yellow-400 text-xs mt-1 truncate">{asset.tags.slice(0, 2).join(' · ')}</p>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, label, sub, onAction, actionLabel }) {
  return (
    <div className="bg-yellow-300/40 rounded-3xl p-10 text-center border-2 border-black/10 shadow-lg">
      <div className="w-20 h-20 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Icon size={40} className="text-black" />
      </div>
      <p className="text-black text-lg font-bold mb-2">{label}</p>
      <p className="text-black text-sm font-bold mb-6">{sub}</p>
      {onAction && (
        <button onClick={onAction} className="text-black text-sm font-bold underline underline-offset-4 hover:opacity-70 transition-opacity">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function Studio() {
  const { user } = useAuth();
  const { setAppContext } = useAppContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('home');
  const [activeToolPanel, setActiveToolPanel] = useState(null);
  const [libraryTab, setLibraryTab] = useState('kits');
  const [editingActor, setEditingActor] = useState(null);  // null=closed, false=new, obj=edit
  const [editingSet, setEditingSet] = useState(null);      // null=closed, false=new, obj=edit
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showAudioUploader, setShowAudioUploader] = useState(false);
  const [showDubbingStudio, setShowDubbingStudio] = useState(false);
  const [showTextToSpeech, setShowTextToSpeech] = useState(false);
  const [showVideoTools, setShowVideoTools] = useState(false);
  const [videoInitialMode, setVideoInitialMode] = useState(null);
  const [producedMedia, setProducedMedia] = useState(null); // { url, type }
  
  // Production mode from URL params
  const [productionMode, setProductionMode] = useState(null);
  const [targetDossier, setTargetDossier] = useState(null);
  const [targetKitPage, setTargetKitPage] = useState(null);
  const [targetBlock, setTargetBlock] = useState(null);
  const [targetEpisodeId, setTargetEpisodeId] = useState(null);
  const [referenceMedia, setReferenceMedia] = useState([]);
  const [recommendedTools, setRecommendedTools] = useState([]);
  const [hasAutoOpenedTool, setHasAutoOpenedTool] = useState(false);
  const [productionContext, setProductionContext] = useState(null);
  const [kitPage, setKitPage] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [productionMethod, setProductionMethod] = useState(null);
  const [blockDetails, setBlockDetails] = useState(null);
  const [isInProductionContext, setIsInProductionContext] = useState(false);
  const [activeKit, setActiveKit] = useState(null);
  const [showFreeTimeline, setShowFreeTimeline] = useState(false);
  const [showLipSync, setShowLipSync] = useState(false);
  const [showAnimateImage, setShowAnimateImage] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showLayout, setShowLayout] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState(null); // motion prompt preloaded from a script

  const { data: characterSheets = [] } = useQuery({
    queryKey: ['characterSheets', user?.email],
    queryFn: () => base44.entities.CharacterSheet.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: setAssets = [] } = useQuery({
    queryKey: ['setAssets', user?.email],
    queryFn: () => base44.entities.SetAsset.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: vaultAssets = [] } = useQuery({
    queryKey: ['vaultAssets', user?.email],
    queryFn: () => base44.entities.VaultAsset.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const { data: communityKits = [] } = useQuery({
    queryKey: ['productionKits'],
    queryFn: () => base44.entities.ProductionKit.filter({ status: 'published' }, 'order'),
  });

  const actorCount = characterSheets.length;
  const setCount = setAssets.length;
  const totalCount = actorCount + setCount;

  // Count projects in production (published dossiers)
  const { data: publishedDossiers = [] } = useQuery({
    queryKey: ['publishedDossiers'],
    queryFn: () => base44.entities.Dossier.filter({ status: 'published' }),
  });
  const projectsInProductionCount = publishedDossiers.length;

  const { data: studioRuntime } = useQuery({
    queryKey: ['admin-surface-runtime'],
    queryFn: async () => (await base44.functions.invoke('admin-pages-tools', { action: 'runtime' })).data,
    staleTime: 60_000,
    retry: false,
  });
  const studioSurfaceSetting = studioRuntime?.settings?.find((item) => item.surface_type === 'page' && item.surface_key === 'Studio');
  const vaultToolSetting = studioRuntime?.settings?.find((item) => item.surface_type === 'tool' && item.surface_key === 'vault');
  const homeItems = (studioSurfaceSetting?.configuration?.home_items?.length ? studioSurfaceSetting.configuration.home_items : DEFAULT_HOME_ITEMS)
    .map((item) => item.key === 'my_vault' ? {
      ...item,
      label: vaultToolSetting?.label || item.label,
      icon_image: vaultToolSetting?.configuration?.icon_image?.trim() ? vaultToolSetting.configuration.icon_image : item.icon_image,
    } : item)
    .filter((item) => item.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const homeItemActions = {
    my_projects: () => navigate('/MyProjects'),
    production_kits: () => setActiveTab('library'),
    stages: () => setActiveToolPanel('lab'),
    tools: () => setActiveToolPanel('tools'),
    my_vault: () => setActiveToolPanel('vault'),
    fotoplay: () => setActiveToolPanel('stories'),
  };
  const homeItemBadges = {
    my_projects: projectsInProductionCount,
    production_kits: communityKits.length,
    stages: 0,
    tools: 0,
    my_vault: vaultAssets.length,
    fotoplay: 0,
  };
  const homeItemColors = {
    my_projects: 'bg-yellow-400',
    production_kits: 'bg-yellow-300',
    stages: 'bg-yellow-200',
    tools: 'bg-yellow-100',
    my_vault: 'bg-yellow-300',
    fotoplay: 'bg-yellow-300',
  };

  // Handle production mode - show simple tool interface
  useEffect(() => {
    const mode = searchParams.get('mode');
    const dossierId = searchParams.get('dossier_id');
    const kitPageId = searchParams.get('kit_page_id');
    const blockId = searchParams.get('block_id');
    const episodeId = searchParams.get('episode_id');
    const productionMethod = searchParams.get('production_method');
    const refMediaParam = searchParams.get('reference_media');
    const toolsParam = searchParams.get('recommended_tools');
    
    if (mode === 'production' && dossierId) {
      setIsInProductionContext(true);
      setProductionMode({ blockId, episodeId, dossierId });
      
      const loadProductionData = async () => {
        try {
          const [page, dossier] = await Promise.all([
            kitPageId ? base44.entities.DossierPage.get(kitPageId).catch(() => null) : Promise.resolve(null),
            base44.entities.Dossier.get(dossierId).catch(() => null),
          ]);
          
          if (kitPageId && page) {
            setKitPage(page);
          }
          setDossier(dossier);
          
          // Load reference media from kit AND from the specific block's reference_media field
          let refMedia = page ? [
            ...(page.kit_characters?.flatMap(c => c.media || []) || []),
            ...(page.kit_sets?.flatMap(s => s.media || []) || []),
            ...(page.kit_costumes?.flatMap(c => c.media || []) || []),
          ].slice(0, 6) : [];
          
          // Fetch EpisodeProduction to get block-specific reference_media
          if (blockId) {
            console.log('🔍 Looking for block reference_media:', { blockId, dossierId, kitPageId });
            // Try both dossier_id and episode_page_id
            let epProds = await base44.entities.EpisodeProduction.filter({ dossier_id: dossierId }).catch(() => []);
            console.log('📦 EpisodeProduction by dossier_id:', epProds.length);
            if (epProds.length === 0 && kitPageId) {
              epProds = await base44.entities.EpisodeProduction.filter({ episode_page_id: kitPageId }).catch(() => []);
              console.log('📦 EpisodeProduction by episode_page_id:', epProds.length);
            }
            if (epProds.length > 0) {
              console.log('🎬 First EpisodeProduction timeline blocks:', epProds[0].timeline?.map(b => ({ id: b.id, title: b.title, ref_count: b.reference_media?.length || 0 })));
              const block = epProds[0].timeline?.find(b => b.id === blockId);
              console.log('🎯 Found block:', block?.id, 'reference_media:', block?.reference_media);
              if (block?.reference_media?.length > 0) {
                // Filter to only images (exclude videos) for reference thumbnails
                const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
                const imageMedia = block.reference_media.filter(url => {
                  const lower = url.toLowerCase();
                  return !lower.includes('video') && !lower.includes('mp4') && !lower.includes('webm') && !lower.includes('ogg') && !lower.includes('mov');
                });
                console.log('🖼️ Image reference media:', imageMedia.length, 'of', block.reference_media.length);
                refMedia = [...imageMedia, ...refMedia];
                refMedia = refMedia.filter((url, i, arr) => arr.indexOf(url) === i).slice(0, 10);
                console.log('✅ Loaded reference media:', refMedia.length, 'items');
              } else {
                console.log('⚠️ Block has no reference_media - YOU NEED TO UPLOAD IN ADMIN AND CLICK SAVE');
              }
            } else {
              console.log('⚠️ No EpisodeProduction found - YOU NEED TO SAVE PRODUCTION IN ADMIN FIRST');
            }
          }
          
          setReferenceMedia(refMedia);
          
          // Parse reference media param
          if (refMediaParam) {
            try { setReferenceMedia(JSON.parse(refMediaParam)); } catch {}
          }
          // Parse recommended tools
          if (toolsParam) {
            setRecommendedTools(toolsParam.split(',').filter(Boolean));
          }
          
          // Load production method and block details
          const prodMethod = searchParams.get('production_method');
          if (prodMethod) {
            setProductionMethod(prodMethod);
            // Load block details from session storage
            const stored = sessionStorage.getItem('studio_block_details');
            if (stored) {
              try {
                const parsed = JSON.parse(stored);
                setBlockDetails(parsed);
              } catch {}
            }
          }
        } catch (err) {
          console.error('Error loading production data:', err);
        }
      };
      
      loadProductionData();
    }
  }, [searchParams, hasAutoOpenedTool]);

  const closeProductionMode = () => {
    setProductionContext(null);
    setKitPage(null);
    setDossier(null);
    setIsInProductionContext(false);
    setProductionMethod(null);
    setBlockDetails(null);
    setProductionMode(null);
    navigate('/Studio', { replace: true });
  };

  // Broadcast Studio section context
  useEffect(() => {
    const sectionLabels = { home: 'Home overview', library: 'Production Kits library', lab: 'Stages (sketch generators)', tools: 'AI Tools workspace', stories: 'FotoPlay', vault: 'Vault' };
    const openTools = [];
    if (showVoiceRecorder) openTools.push('Voice Recorder');
    if (showAudioUploader) openTools.push('Audio Uploader');
    if (showDubbingStudio) openTools.push('Dubbing Studio');
    if (showTextToSpeech) openTools.push('Text to Speech');
    if (showVideoTools) openTools.push('Video Tools');
    if (showLipSync) openTools.push('Lip Sync');
    if (showAnimateImage) openTools.push('Animate Image');
    setAppContext({
      page: 'My Studio',
      section: activeToolPanel ? (sectionLabels[activeToolPanel] || activeToolPanel) : (sectionLabels[activeTab] || activeTab),
      detail: openTools.length > 0 ? `Tool open: ${openTools.join(', ')}` : (editingActor !== null ? 'Actor editor open' : editingSet !== null ? 'Set editor open' : null),
    });
  }, [activeTab, activeToolPanel, showVoiceRecorder, showAudioUploader, showDubbingStudio, showTextToSpeech, showVideoTools, showLipSync, showAnimateImage, editingActor, editingSet]);

  const DEFAULT_STUDIO_TABS = [
    { key: 'home', label: 'Home', icon: 'Home', visible: true, order: 0 },
    { key: 'library', label: 'Production Kits', icon: 'Clapperboard', visible: true, order: 1 },
    { key: 'lab', label: 'Stages', icon: 'Theater', visible: true, order: 2 },
    { key: 'tools', label: 'Tools', icon: 'Wrench', visible: true, order: 3 },
    { key: 'stories', label: 'Stories', icon: 'BookOpen', visible: true, order: 4 },
  ];
  const configuredStudioViews = studioSurfaceSetting?.configuration?.studio_views;
  const studioViewsSource = (configuredStudioViews?.length ? configuredStudioViews : DEFAULT_STUDIO_TABS);
  const tabs = DEFAULT_STUDIO_TABS.map((def) => {
    const cfg = studioViewsSource.find((item) => item.key === def.key);
    return cfg ? { ...def, ...cfg } : def;
  })
    .filter((tab) => tab.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((tab) => ({ ...tab, icon: HOME_ICON_MAP[tab.icon] || Home }));

  const activeViewConfig = studioViewsSource.find((item) => item.key === activeTab);
  const activeViewBg = activeViewConfig?.background_image?.trim() ? activeViewConfig.background_image : null;

  const handleJoinProject = (kit) => {
    setActiveKit(kit);
  };

  // Render production mode - open KitProductionRoom with timeline (from URL params OR handleJoinProject)
  if (productionMode && kitPage) {
    return (
      <KitProductionRoom
        kitPage={kitPage}
        dossier={dossier}
        onClose={closeProductionMode}
        initialBlockId={productionMode.blockId}
        initialBlockType={null}
        producedMedia={producedMedia}
        onMediaProduced={setProducedMedia}
        referenceMedia={referenceMedia}
        productionMethodFromUrl={productionMethod}
        blockDetailsFromStorage={blockDetails}
      />
    );
  }

  // Overlay KitAssetViewer when user clicks a production kit
  if (activeKit) {
    return (
      <KitAssetViewer
        kitPage={activeKit}
        dossier={null}
        onClose={() => setActiveKit(null)}
      />
    );
  }

  // Free timeline — blank KitProductionRoom with no project context
  if (showFreeTimeline) {
    const blankKit = { id: 'free_timeline', title: 'Free Timeline', kit_characters: [], kit_sets: [], kit_costumes: [] };
    return (
      <KitProductionRoom
        kitPage={blankKit}
        dossier={null}
        onClose={() => setShowFreeTimeline(false)}
        producedMedia={producedMedia}
        onMediaProduced={setProducedMedia}
        referenceMedia={[]}
      />
    );
  }

  // Layout view
  if (showLayout) {
    return <LayoutTool user={user} onClose={() => setShowLayout(false)} />;
  }

  const activeShellKey = editingActor !== null ? 'actor' : editingSet !== null ? 'set' : (activeToolPanel || activeTab);
  const activeShellTitle = editingActor !== null
    ? (editingActor?.character_name || 'Actor Creator')
    : editingSet !== null
      ? (editingSet?.name || 'Set Creator')
      : 'Studio';

  const handleShellTool = (tool) => {
    if (tool.key === 'home') {
      setEditingActor(null);
      setEditingSet(null);
      setActiveToolPanel(null);
      setActiveTab('home');
      return;
    }
    if (tool.action === 'actor') {
      setActiveToolPanel(null);
      setEditingSet(null);
      setEditingActor(false);
      return;
    }
    if (tool.action === 'set') {
      setActiveToolPanel(null);
      setEditingActor(null);
      setEditingSet(false);
      return;
    }
    setEditingActor(null);
    setEditingSet(null);
    setActiveToolPanel(tool.key);
  };

  return (
    <UnifiedStudioShell
      activeKey={activeShellKey}
      onTool={handleShellTool}
      title={activeShellTitle}
      subtitle="Open tools without leaving your current workspace"
    >
      <div className="min-h-[calc(100vh-4rem)] relative" style={activeViewBg ? { backgroundImage: `url(${activeViewBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' } : undefined}>
      {activeViewBg && <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />}
      <div className="relative z-10">
      {/* Voice Recorder Modal */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onRecordingComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'audio' });
            setShowVoiceRecorder(false);
          }}
          onClose={() => setShowVoiceRecorder(false)}
          productionMethod={isInProductionContext ? productionMethod : null}
          block={isInProductionContext ? blockDetails?.block : null}
          character={isInProductionContext ? blockDetails?.character : null}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Audio Uploader Modal */}
      {showAudioUploader && (
        <AudioUploader
          onUploadComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'audio' });
            setShowAudioUploader(false);
          }}
          onClose={() => setShowAudioUploader(false)}
          productionMethod={isInProductionContext ? productionMethod : null}
          block={isInProductionContext ? blockDetails?.block : null}
          character={isInProductionContext ? blockDetails?.character : null}
        />
      )}

      {/* Dubbing Studio Modal */}
      {showDubbingStudio && (
        <DubbingStudio
          onComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'video' });
            setShowDubbingStudio(false);
          }}
          onClose={() => setShowDubbingStudio(false)}
          block={isInProductionContext ? blockDetails?.block : null}
          productionMethod={isInProductionContext ? productionMethod : null}
          character={isInProductionContext ? blockDetails?.character : null}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Text to Speech Modal */}
      {showTextToSpeech && (
        <TextToSpeech
          onComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'audio' });
            setShowTextToSpeech(false);
          }}
          onClose={() => setShowTextToSpeech(false)}
          productionMethod={isInProductionContext ? productionMethod : null}
          block={isInProductionContext ? blockDetails?.block : null}
          character={isInProductionContext ? blockDetails?.character : null}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Animate Image Modal */}
      {showAnimateImage && (
        <AnimateImage
          initialPrompt={pendingPrompt}
          onComplete={(url, type) => {
            setProducedMedia({ url, type });
            setShowAnimateImage(false);
            setPendingPrompt(null);
          }}
          onClose={() => { setShowAnimateImage(false); setPendingPrompt(null); }}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Lip Sync Modal */}
      {showLipSync && (
        <LipSync
          onComplete={(url, type) => {
            setProducedMedia({ url, type });
            setShowLipSync(false);
          }}
          onClose={() => setShowLipSync(false)}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}

      {/* Video Tools Modal */}
      {showVideoTools && (
        <VideoTools
          onComplete={(file_url) => {
            setProducedMedia({ url: file_url, type: 'video' });
            setShowVideoTools(false);
          }}
          onClose={() => { setShowVideoTools(false); setVideoInitialMode(null); }}
          recommendedTools={recommendedTools}
          referenceMedia={referenceMedia}
          productionMethod={isInProductionContext ? productionMethod : null}
          block={isInProductionContext ? blockDetails?.block : null}
          character={isInProductionContext ? blockDetails?.character : null}
          initialMode={videoInitialMode}
          episodePageId={kitPage?.id}
          blockId={blockDetails?.block?.id}
          user={user}
        />
      )}



      {/* Workspace header */}
      <div className="px-5 md:px-7 pt-6 pb-5 relative">
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-4">
          <div>
            <p className="text-black/60 text-[10px] tracking-[0.22em] uppercase font-bold mb-1">
              {user?.full_name || 'CREATOR'}
            </p>
            <h1 className="text-black text-3xl md:text-4xl font-bold tracking-tight">Studio</h1>
          </div>
          <div className="hidden md:flex items-center gap-2 text-black/60 text-xs font-semibold">
            <FolderOpen size={15} />
            Creative workspace
          </div>
        </motion.div>
      </div>

      {/* ── HOME TAB ── */}
      {activeTab === 'home' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 space-y-3">
          {/* Stats */}
          <div className="bg-black rounded-3xl p-6 flex items-center justify-around shadow-xl">
            <div className="text-center">
              <p className="text-yellow-400 text-4xl font-bold">{actorCount}</p>
              <p className="text-white text-sm font-bold mt-1">Actors</p>
            </div>
            <div className="w-px h-12 bg-white/15" />
            <div className="text-center">
              <p className="text-yellow-400 text-4xl font-bold">{setCount}</p>
              <p className="text-white text-sm font-bold mt-1">Sets</p>
            </div>
            <div className="w-px h-12 bg-white/15" />
            <div className="text-center">
              <p className="text-yellow-400 text-4xl font-bold">{vaultAssets.length}</p>
              <p className="text-white text-sm font-bold mt-1">Assets</p>
            </div>
          </div>

          <p className="text-black text-sm font-bold tracking-widest uppercase pt-6">Navigation</p>

          {homeItems.map((item) => (
            <StudioCard
              key={item.key}
              icon={HOME_ICON_MAP[item.icon] || Home}
              iconImage={item.icon_image?.trim() ? item.icon_image : null}
              title={item.label}
              subtitle={item.description}
              color={homeItemColors[item.key] || 'bg-yellow-300'}
              badge={homeItemBadges[item.key] || 0}
              backgroundImage={item.background_image}
              onClick={homeItemActions[item.key] || (() => {})}
            />
          ))}
        </motion.div>
      )}

      {/* ── LIBRARY TAB ── */}
      {activeTab === 'library' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5">
          {/* Sub-tab */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setLibraryTab('kits')}
              className={`flex-1 py-4 rounded-2xl text-sm font-bold tracking-wide transition-all shadow-lg ${
                libraryTab === 'kits' ? 'bg-black text-yellow-400' : 'bg-yellow-300/50 text-black hover:bg-yellow-300'
              }`}
            >
              Kits ({communityKits.length})
            </button>
          </div>

          {/* Community Production Kits */}
          {libraryTab === 'kits' && (
            communityKits.length === 0 ? (
              <EmptyState
                icon={Film}
                label="No production kits yet"
                sub="Community production kits will appear here"
              />
            ) : (
              <div className="space-y-3">
                {communityKits.map(kit => (
                  <motion.div
                    key={kit.id}
                    whileTap={{ scale: 0.98 }}
                    className="bg-black rounded-3xl p-5 cursor-pointer"
                    onClick={() => handleJoinProject(kit)}
                  >
                    <div className="flex items-center gap-4">
                      {kit.cover_image ? (
                        <img src={kit.cover_image} alt={kit.title} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 bg-yellow-400/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <Layers size={24} className="text-yellow-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-yellow-400 font-bold text-base truncate">{kit.title}</p>
                        {kit.subtitle && <p className="text-yellow-400 text-sm truncate">{kit.subtitle}</p>}
                        <p className="text-yellow-400 text-xs mt-1 font-bold">Tap to open kit →</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          )}

        </motion.div>
      )}

      {/* ── STAGES TAB ── */}
      {false && activeTab === 'lab' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5">
          <SketchStudio user={user} />
        </motion.div>
      )}

      {/* ── TOOLS TAB ── */}
      {false && activeTab === 'tools' && (
        <LabWorkspace
          user={user}
          onOpenActor={() => setEditingActor(false)}
          onOpenSet={() => setEditingSet(false)}
          onOpenVoiceRecorder={() => setShowVoiceRecorder(true)}
          onOpenAudioUploader={() => setShowAudioUploader(true)}
          onOpenDubbing={() => setShowDubbingStudio(true)}
          onOpenTTS={() => setShowTextToSpeech(true)}
          onOpenVideo={(mode) => { setVideoInitialMode(mode || null); setShowVideoTools(true); }}
          onOpenLipSync={() => setShowLipSync(true)}
          onOpenAnimateImage={() => setShowAnimateImage(true)}
          onJoinProject={handleJoinProject}
          onOpenFreeTimeline={() => setShowFreeTimeline(true)}
          onOpenLayout={() => setShowLayout(true)}
          hideProjects={true}
        />
      )}

      {/* ── STORIES TAB ── */}
      {false && activeTab === 'stories' && (
        <StoryBlocks user={user} onBack={() => setActiveTab('home')} />
      )}

      {/* ── VAULT WORKSPACE ── */}
      {false && activeTab === 'vault' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 md:px-7">
          <VaultSection
            userEmail={user?.email}
            onUsePrompt={(text) => {
              setPendingPrompt(text);
              setShowAnimateImage(true);
            }}
          />
        </motion.div>
      )}

      <AnimatePresence>
        {activeToolPanel === 'stories' && (
          <StudioToolOverlay title="FotoPlay" onClose={() => setActiveToolPanel(null)}>
            <StoryBlocks user={user} onBack={() => setActiveToolPanel(null)} />
          </StudioToolOverlay>
        )}

        {activeToolPanel === 'lab' && (
          <StudioToolOverlay title="Stages" onClose={() => setActiveToolPanel(null)}>
            <div className="px-5 md:px-7 py-5">
              <SketchStudio user={user} />
            </div>
          </StudioToolOverlay>
        )}

        {activeToolPanel === 'tools' && (
          <StudioToolOverlay title="AI Tools" onClose={() => setActiveToolPanel(null)}>
            <LabWorkspace
              user={user}
              onOpenActor={() => { setActiveToolPanel(null); setEditingActor(false); }}
              onOpenSet={() => { setActiveToolPanel(null); setEditingSet(false); }}
              onOpenVoiceRecorder={() => setShowVoiceRecorder(true)}
              onOpenAudioUploader={() => setShowAudioUploader(true)}
              onOpenDubbing={() => setShowDubbingStudio(true)}
              onOpenTTS={() => setShowTextToSpeech(true)}
              onOpenVideo={(mode) => { setVideoInitialMode(mode || null); setShowVideoTools(true); }}
              onOpenLipSync={() => setShowLipSync(true)}
              onOpenAnimateImage={() => setShowAnimateImage(true)}
              onJoinProject={handleJoinProject}
              onOpenFreeTimeline={() => setShowFreeTimeline(true)}
              onOpenLayout={() => setShowLayout(true)}
              hideProjects={true}
            />
          </StudioToolOverlay>
        )}

        {activeToolPanel === 'vault' && (
          <StudioToolOverlay title="Vault" onClose={() => setActiveToolPanel(null)}>
            <div className="px-5 md:px-7 py-5">
              <VaultSection
                userEmail={user?.email}
                onUsePrompt={(text) => {
                  setPendingPrompt(text);
                  setShowAnimateImage(true);
                }}
              />
            </div>
          </StudioToolOverlay>
        )}
      </AnimatePresence>

      {/* ── Editors ── */}
      <AnimatePresence>
        {editingActor !== null && (
          <CharacterSheetEditor
            key="actor-editor"
            sheet={editingActor || null}
            userEmail={user?.email}
            onClose={() => setEditingActor(null)}
          />
        )}
        {editingSet !== null && (
          <SetAssetEditor
            key="set-editor"
            asset={editingSet || null}
            userEmail={user?.email}
            onClose={() => setEditingSet(null)}
          />
        )}
      </AnimatePresence>
      </div>
      </div>
    </UnifiedStudioShell>
  );
}
