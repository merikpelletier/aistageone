import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, User, Video, Camera, Upload, CheckCircle2, Film, Lock, FlaskConical } from 'lucide-react';
import BlockVersionUploader from '@/components/production/BlockVersionUploader';
import ProxiedImage from '@/components/ProxiedImage';
import StageModeSelector from '@/components/StageModeSelector';
import ProductionAssistantChat from '@/components/production/ProductionAssistantChat';

const METHOD_LABELS = {
  likeness_reference: { label: 'Likeness (Reference)', icon: Camera },
  likeness_performance: { label: 'Likeness (Performance)', icon: Video },
  reference_performance: { label: 'Reference Performance', icon: Video },
  body_and_voice: { label: 'Body & Voice', icon: Video },
  faceswitch: { label: 'FaceSwitch', icon: Camera },
};

const METHOD_DESCRIPTIONS = {
  likeness_reference: {
    label: 'Use my likeness, keep the reference voice and motion',
    description: 'Your face replaces the character\'s, while the voice, body movement, and performance stay from the reference video.',
    icon: Camera,
  },
  likeness_performance: {
    label: 'Use my likeness, voice, and motion',
    description: 'You replace the character with your own likeness and provide your own video reference, including your voice and body movement.',
    icon: Video,
  },
  reference_performance: {
    label: 'Use my voice and motion, keep the reference look',
    description: 'The original character appearance is preserved, but you provide your own voice and body movement through a video reference.',
    icon: Video,
  },
  body_and_voice: {
    label: 'Use my likeness, voice, and motion',
    description: 'You replace the character with your own likeness and provide your own video reference, including your voice and body movement.',
    icon: Video,
  },
  faceswitch: {
    label: 'Use my likeness, keep the reference voice and motion',
    description: 'Your face replaces the character\'s, while the voice, body movement, and performance stay from the reference video.',
    icon: Camera,
  },
};

const ALL_METHODS = Object.keys(METHOD_LABELS);

const BLOCK_TYPE_LABELS = {
  character: 'Character',
  establishing_shot: 'Establishing Shot',
  action_element: 'Action / Element',
  transition: 'Transition',
  closing_shot: 'Closing Shot',
};

const BLOCK_TYPE_COLORS = {
  character: 'text-red-400 bg-red-600/10 border-red-600/20',
  establishing_shot: 'text-blue-400 bg-blue-600/10 border-blue-600/20',
  action_element: 'text-orange-400 bg-orange-600/10 border-orange-600/20',
  transition: 'text-purple-400 bg-purple-600/10 border-purple-600/20',
  closing_shot: 'text-green-400 bg-green-600/10 border-green-600/20',
};

function TechniquesSection({ block, selectedMethod, activeMethodTab, setActiveMethodTab }) {
  const filteredMethods = (block.allowed_methods?.length ? block.allowed_methods : ALL_METHODS).filter(m => m !== 'voice_only');
  if (filteredMethods.length === 0) return null;
  const activeTab = activeMethodTab && filteredMethods.includes(activeMethodTab)
    ? activeMethodTab
    : (filteredMethods.includes(selectedMethod) ? selectedMethod : filteredMethods[0]);
  const activeMeta = METHOD_DESCRIPTIONS[activeTab] || { label: activeTab, description: '' };
  const ActiveIcon = activeMeta.icon || User;
  return (
    <div>
      <p className="text-white text-xs tracking-widest uppercase mb-3">Techniques</p>
      <div className="flex gap-2 flex-wrap mb-4">
        {filteredMethods.map(m => {
          const meta = METHOD_DESCRIPTIONS[m] || { label: m };
          return (
            <button key={m} onClick={() => setActiveMethodTab(m)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${activeTab === m ? 'bg-white text-black border-white font-medium' : 'bg-white/5 text-white border-white/10 hover:border-white/30'}`}>
              {meta.label}
            </button>
          );
        })}
      </div>
      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <ActiveIcon size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-white text-sm font-medium">{activeMeta.label}</p>
        </div>
        <p className="text-white text-xs font-light leading-relaxed">{activeMeta.description}</p>
      </div>
    </div>
  );
}

// ── Step views ──────────────────────────────────────────────────────
const STEP_INTRO = 'intro';
const STEP_CHOOSE_CHAR = 'choose_char';
const STEP_STAGE_MODE = 'stage_mode';
const STEP_TOOL = 'tool';
const STEP_TIMELINE = 'timeline';
const STEP_BLOCK_DETAIL = 'block_detail';

export default function ProductionRoom({ episodePage, dossier, onClose }) {
  const navigate = useNavigate();
  const isMusical = dossier?.category === 'Musical';
  const [production, setProduction] = useState(null);
  const [userTimeline, setUserTimeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(STEP_INTRO);
  const [selectedChar, setSelectedChar] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [toolBlock, setToolBlock] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeMethodTab, setActiveMethodTab] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [prods, me] = await Promise.all([
        base44.entities.EpisodeProduction.filter({ episode_page_id: episodePage.id }),
        base44.auth.me().catch(() => null),
      ]);
      const prod = prods[0] || null;
      setProduction(prod);
      setUser(me);

      if (prod && me) {
        const existing = await base44.entities.UserTimeline.filter({
          episode_page_id: episodePage.id,
          user_email: me.email,
        });
        if (existing.length > 0) {
          const ut = existing[0];
          setUserTimeline(ut);
          // Do NOT restore characterPhotoUrl here — handleSelectChar handles that per-character
          setStep(STEP_INTRO);
        } else {
          setStep(STEP_INTRO);
        }
      }
      setLoading(false);
    };
    load();
  }, [episodePage.id]);

  const sortedTimeline = production?.timeline
    ? [...production.timeline].sort((a, b) => a.order - b.order)
    : [];

  const goBack = () => {
    if (step === STEP_BLOCK_DETAIL) return setStep(STEP_TIMELINE);
    if (step === STEP_TIMELINE) return setStep(STEP_INTRO);
    if (step === STEP_TOOL) return setStep(STEP_STAGE_MODE);
    if (step === STEP_STAGE_MODE) return setStep(STEP_CHOOSE_CHAR);
    if (step === STEP_CHOOSE_CHAR) return setStep(STEP_INTRO);
    onClose();
  };

  const handleSelectChar = async (char) => {
    setSelectedChar(char);
    if (isMusical) {
      // Musical: auto-select voice_only and skip stage mode entirely
      setSelectedMethod('voice_only');
      setSaving(true);
      const data = {
        episode_page_id: episodePage.id,
        user_email: user.email,
        selected_character_id: char.id,
        selected_method: 'voice_only',
        block_overrides: userTimeline?.block_overrides || [],
      };
      if (userTimeline?.id) {
        const updated = await base44.entities.UserTimeline.update(userTimeline.id, data);
        setUserTimeline(updated);
      } else {
        const created = await base44.entities.UserTimeline.create(data);
        setUserTimeline(created);
      }
      setSaving(false);
      setStep(STEP_TIMELINE);
    } else {
      setStep(STEP_STAGE_MODE);
    }
  };

  const handleSelectMethod = async (method) => {
    setSelectedMethod(method);
    setSaving(true);
    const data = {
      episode_page_id: episodePage.id,
      user_email: user.email,
      selected_character_id: selectedChar.id,
      selected_method: method,
      block_overrides: userTimeline?.block_overrides || [],
    };
    if (userTimeline?.id) {
      const updated = await base44.entities.UserTimeline.update(userTimeline.id, data);
      setUserTimeline(updated);
    } else {
      const created = await base44.entities.UserTimeline.create(data);
      setUserTimeline(created);
    }
    setSaving(false);
    setStep(STEP_TIMELINE);
  };



  const getOverride = (blockId) =>
    userTimeline?.block_overrides?.find(o => o.block_id === blockId) || null;

  const uploadBlockOverride = async (block, fileOrObj) => {
    setUploading(true);
    let file_url;
    if (typeof fileOrObj === 'object' && fileOrObj.url) {
      // Already a URL from AI generation
      file_url = fileOrObj.url;
    } else {
      // Raw File object — upload it
      const result = await base44.integrations.Core.UploadFile({ file: fileOrObj });
      file_url = result.file_url;
    }
    const existingOverrides = userTimeline?.block_overrides || [];
    const idx = existingOverrides.findIndex(o => o.block_id === block.id);
    let newOverrides;
    if (idx >= 0) {
      newOverrides = existingOverrides.map((o, i) => i === idx ? { ...o, user_media_url: file_url, status: 'uploaded' } : o);
    } else {
      newOverrides = [...existingOverrides, { block_id: block.id, user_media_url: file_url, status: 'uploaded', notes: '' }];
    }
    const updated = await base44.entities.UserTimeline.update(userTimeline.id, { ...userTimeline, block_overrides: newOverrides });
    setUserTimeline(updated);
    if (selectedBlock?.id === block.id) setSelectedBlock(block);
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const headerTitle = step === STEP_BLOCK_DETAIL && selectedBlock
    ? `Block ${String(selectedBlock.order).padStart(2, '0')} — ${selectedBlock.title}`
    : step === STEP_TOOL && toolBlock
    ? `Block ${String(toolBlock.order).padStart(2, '0')} — Upload`
    : step === STEP_TIMELINE
    ? 'Your Timeline'
    : step === STEP_STAGE_MODE
    ? 'Stage Mode'
    : step === STEP_CHOOSE_CHAR
    ? 'Choose a Character'
    : 'Production Room';

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-10 pb-4 border-b border-white/10 flex-shrink-0">
        <button onClick={step === STEP_INTRO ? onClose : goBack} className="p-1 text-white hover:text-white">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs tracking-widest uppercase">Production Room</p>
          <h2 className="text-white text-sm font-light tracking-wide truncate">{episodePage.episode_title || episodePage.title}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* No production setup */}
        {!production && (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center">
            <p className="text-white text-sm">Production setup is not yet available for this episode.</p>
          </div>
        )}

        {production && (
          <AnimatePresence mode="wait">

            {/* INTRO — show characters immediately */}
            {step === STEP_INTRO && (
              <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col">
                <div className="px-5 pt-6 pb-4">
                  <p className="text-white text-xl font-extralight tracking-widest mb-1">Who do you want to play?</p>
                  <p className="text-white text-sm font-light">Select a character to join this episode.</p>
                </div>

                {user ? (
                  <div className="px-4 space-y-3 pb-10">
                    {(production.characters || []).map(char => (
                      <button key={char.id} onClick={() => handleSelectChar(char)}
                        className="w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 active:scale-[0.98] transition-transform text-left relative">
                        {char.photo_url ? (
                          <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
                            <img src={char.photo_url} alt={char.name} className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8">
                              <p className="text-white text-lg font-light tracking-wide leading-tight">{char.name}</p>
                              {char.description && <p className="text-white text-xs font-light leading-relaxed mt-1 line-clamp-2">{char.description}</p>}
                            </div>
                            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                              <ChevronLeft size={16} className="text-white rotate-180" />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4 p-4">
                            <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                              <User size={32} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-lg font-light tracking-wide">{char.name}</p>
                              {char.description && <p className="text-white text-xs mt-0.5 line-clamp-2">{char.description}</p>}
                            </div>
                            <ChevronLeft size={16} className="text-white rotate-180 flex-shrink-0" />
                          </div>
                        )}
                      </button>
                    ))}
                    {(!production.characters || production.characters.length === 0) && (
                      <p className="text-white text-sm px-1">No characters configured.</p>
                    )}
                  </div>
                ) : (
                  <div className="px-5">
                    <button
                      onClick={() => base44.auth.redirectToLogin(window.location.href)}
                      className="w-full py-3 bg-white/10 text-white text-sm font-light tracking-widest rounded-xl"
                    >
                      Log in to participate
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* CHOOSE CHARACTER */}
            {step === STEP_CHOOSE_CHAR && (
              <motion.div key="choose_char" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex flex-col">
                {/* Instruction header */}
                <div className="px-5 pt-6 pb-4">
                  <p className="text-white text-xl font-extralight tracking-widest mb-1">Who do you want to play?</p>
                  <p className="text-white text-sm font-light">Select a character to continue.</p>
                </div>

                {/* Character cards — full bleed */}
                <div className="px-4 space-y-3 pb-10">
                  {(production.characters || []).map(char => (
                    <button key={char.id} onClick={() => handleSelectChar(char)}
                      className="w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 active:scale-[0.98] transition-transform text-left relative">
                      {/* Large photo */}
                      {char.photo_url ? (
                        <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
                          <img src={char.photo_url} alt={char.name}
                            className="absolute inset-0 w-full h-full object-cover" />
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                          {/* Info over photo */}
                          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8">
                            <p className="text-white text-lg font-light tracking-wide leading-tight">{char.name}</p>
                            {char.description && (
                              <p className="text-white text-xs font-light leading-relaxed mt-1 line-clamp-2">{char.description}</p>
                            )}

                          </div>
                          {/* Arrow */}
                          <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                            <ChevronLeft size={16} className="text-white rotate-180" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 p-4">
                          <div className="w-20 h-20 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                            <User size={32} className="text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-lg font-light tracking-wide">{char.name}</p>
                            {char.description && <p className="text-white text-xs mt-0.5 line-clamp-2">{char.description}</p>}
                          </div>
                          <ChevronLeft size={16} className="text-white rotate-180 flex-shrink-0" />
                        </div>
                      )}
                    </button>
                  ))}
                  {(!production.characters || production.characters.length === 0) && (
                    <p className="text-white text-sm px-1">No characters configured.</p>
                  )}
                </div>
              </motion.div>
            )}

            {/* STAGE MODE */}
            {step === STEP_STAGE_MODE && selectedChar && (
              <motion.div key="stage_mode" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="px-5 py-6">
                {/* Character summary */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                  {selectedChar.photo_url
                    ? <img src={selectedChar.photo_url} alt={selectedChar.name} className="w-10 h-10 rounded-full object-cover" />
                    : <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><User size={16} className="text-white" /></div>
                  }
                  <p className="text-white text-sm font-medium">{selectedChar.name}</p>
                </div>
                <h2 className="text-white text-xl font-extralight tracking-widest mb-3">Choose Your Stage Mode</h2>
                <p className="text-white text-sm font-light leading-relaxed mb-6">
                  Before choosing a role, select how you want to take part in this production. Your choice determines which tools will be available next.
                </p>

                {/* Character reference sheet */}
                <div className="border border-white/10 rounded-xl p-4 bg-white/5 mb-6">
                  <p className="text-white text-xs uppercase tracking-widest mb-3">Actor Reference Sheet</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(selectedChar.reference_images || []).map((ref, i) => {
                      const url = typeof ref === 'string' ? ref : ref.url;
                      return <img key={i} src={url} alt={`Reference ${i + 1}`} className="w-full aspect-square object-cover rounded-lg" />;
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'actor_replacement', number: '1', title: 'Replace the Actor', subtitle: 'Step into the role with your full appearance.', description: 'The original actor is replaced as a whole, not only the face. This allows the result to respect skin tone, body type, height, proportions, and overall likeness.', media: ['front portrait photo', 'full-body reference photo', 'optional additional references'], button: 'Continue with Actor Replacement', requiresRef: true },
                    { id: 'performance', number: '2', title: 'Perform the Scene', subtitle: 'Use your own movement, voice, and acting.', description: 'The scene structure remains, but your uploaded video drives the performance.', media: ['performance video', 'voice/audio from the video', 'optional likeness references'], button: 'Continue with My Performance', requiresRef: true },
                    { id: 'voice_only', number: '3', title: 'Voice the Character', subtitle: 'Keep the original actor visually, but replace the voice.', description: null, media: ['voice recording or uploaded audio'], button: 'Continue with Voice Only', requiresRef: false },
                  ].map((mode) => {
                    const handleContinue = async () => {
                      // Save the production method to UserTimeline
                      setSaving(true);
                      const timelineData = {
                        episode_page_id: episodePage.id,
                        user_email: user.email,
                        selected_character_id: selectedChar.id,
                        selected_method: mode.id,
                        block_overrides: userTimeline?.block_overrides || [],
                      };
                      let updatedTimeline;
                      if (userTimeline?.id) {
                        updatedTimeline = await base44.entities.UserTimeline.update(userTimeline.id, timelineData);
                      } else {
                        updatedTimeline = await base44.entities.UserTimeline.create(timelineData);
                      }
                      setUserTimeline(updatedTimeline);
                      setSelectedMethod(mode.id);
                      setSaving(false);
                      // Navigate to timeline
                      setStep(STEP_TIMELINE);
                    };
                    return (
                    <div key={mode.id} className="border border-white/10 rounded-xl p-5 bg-white/5 flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <span className="text-red-500 text-lg font-light leading-none mt-0.5">{mode.number}.</span>
                        <div>
                          <p className="text-white font-medium tracking-wide leading-tight">{mode.title}</p>
                          <p className="text-white text-xs mt-1 font-light">{mode.subtitle}</p>
                        </div>
                      </div>
                      {mode.description && <p className="text-white text-xs leading-relaxed">{mode.description}</p>}
                      <div>
                        <p className="text-white text-xs uppercase tracking-widest mb-2">Required media</p>
                        <ul className="space-y-1">
                          {mode.media.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-white text-xs">
                              <span className="text-white/20 mt-0.5">—</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <button
                        onClick={() => setStep(STEP_TIMELINE)}
                        className="w-full py-3 mt-1 bg-red-600 hover:bg-red-700 text-white text-xs font-light tracking-widest rounded-lg transition-colors"
                      >
                        Continue to Timeline →
                      </button>
                    </div>
                    );
                  })}
                </div>
              </motion.div>
            )}



            {/* TOOL - Upload media for the first available block */}
            {step === STEP_TOOL && toolBlock && selectedMethod && (
              <motion.div key="tool" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="px-5 py-6 space-y-6">
                {/* Block header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-xs font-mono">{String(toolBlock.order).padStart(2, '0')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded border ${BLOCK_TYPE_COLORS[toolBlock.block_type] || ''}`}>
                    {BLOCK_TYPE_LABELS[toolBlock.block_type]}
                  </span>
                  <h3 className="text-white text-base font-light">{toolBlock.title}</h3>
                </div>

                {toolBlock.description && (
                  <p className="text-white text-sm font-light">{toolBlock.description}</p>
                )}

                {/* Dialogue */}
                {toolBlock.dialogue && (
                  <div>
                    <p className="text-white text-xs tracking-widest uppercase mb-2">Dialogue</p>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="text-white/80 text-sm font-light leading-relaxed italic">"{toolBlock.dialogue}"</p>
                    </div>
                  </div>
                )}

                {/* Reference media */}
                {(toolBlock.reference_media || []).length > 0 && (
                  <div>
                    <p className="text-white text-xs tracking-widest uppercase mb-2">Reference Media</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {toolBlock.reference_media.map((url, i) => (
                        url.match(/\.(mp4|webm|ogg|mov)$/i)
                          ? <video key={i} src={url} controls className="w-full rounded-lg flex-shrink-0" />
                          : <ProxiedImage key={i} src={url} className="w-32 h-32 rounded-lg flex-shrink-0" style={{ objectFit: 'cover' }} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Uploader */}
                <div>
                  <p className="text-white text-xs tracking-widest uppercase mb-3">Upload Your Version</p>
                  <BlockVersionUploader
                    method={selectedMethod}
                    block={{
                      ...toolBlock,
                      dossier_id: dossier?.id,
                      kit_page_id: episodePage.id,
                    }}
                    override={null}

                    onDone={(file_url) => {
                      uploadBlockOverride(toolBlock, { url: file_url });
                      setStep(STEP_TIMELINE);
                    }}
                  />
                </div>

                {/* Navigate to timeline */}
                <button
                  onClick={() => setStep(STEP_TIMELINE)}
                  className="w-full py-2 text-white text-xs hover:text-white underline"
                >
                  View all blocks →
                </button>
              </motion.div>
            )}



            {/* TIMELINE VIEW */}
            {step === STEP_TIMELINE && (
              <motion.div key="timeline" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="px-5 py-6">
                {/* Context pills */}
                {selectedChar && (
                  <div className="flex items-center gap-2 mb-5 flex-wrap">
                    {selectedChar.photo_url && <img src={selectedChar.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />}
                    <span className="px-2 py-1 bg-white/10 rounded text-white text-xs">{selectedChar.name}</span>
                    {selectedMethod && <span className="px-2 py-1 bg-red-600/20 rounded text-red-300 text-xs">{METHOD_LABELS[selectedMethod]?.label}</span>}
                    <button type="button" onClick={() => setStep(STEP_CHOOSE_CHAR)} className="text-white text-xs hover:text-white underline">change</button>
                  </div>
                )}
                <p className="text-white text-xs tracking-widest uppercase mb-4">Your Timeline</p>
                <div className="space-y-2">
                  {sortedTimeline.filter(block =>
                    !selectedChar || !block.assigned_character_id || block.assigned_character_id === selectedChar.id
                  ).map(block => {
                    const override = getOverride(block.id);
                    const isAllowed = true;
                    return (
                      <div
                        key={block.id}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors
                          ${isAllowed ? 'border-white/20 bg-white/5 hover:bg-white/10' : 'border-white/5 bg-white/[0.02] opacity-70'}
                        `}
                      >
                        <span className="text-white text-xs font-mono w-6 flex-shrink-0">{String(block.order).padStart(2, '0')}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${BLOCK_TYPE_COLORS[block.block_type] || ''}`}>
                          {BLOCK_TYPE_LABELS[block.block_type]}
                        </span>
                        <span className="text-white text-xs flex-1 truncate">{block.title}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* View/Preview button (film icon) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBlock(block);
                              setStep(STEP_BLOCK_DETAIL);
                            }}
                            className="w-8 h-8 rounded-full bg-white/5 border border-white/20 flex items-center justify-center hover:bg-white/10 transition-colors"
                            title="View block details"
                          >
                            <Film size={14} className="text-white" />
                          </button>
                          {/* Produce in Studio button (flask icon) */}
                          {isAllowed && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const blockConfig = {
                                  character: ['compose_scene', 'animate_image', 'lip_sync'],
                                  establishing_shot: ['compose_scene', 'text_to_video', 'image_to_video'],
                                  action_element: ['animate_with_reference', 'text_to_video', 'compose_scene'],
                                  transition: ['text_to_video', 'image_to_video', 'compose_scene'],
                                  closing_shot: ['compose_scene', 'animate_image', 'text_to_video'],
                                };
                                const recommendedTools = blockConfig[block.block_type] || [];
                                const params = new URLSearchParams({
                                  mode: 'production',
                                  dossier_id: dossier?.id || '',
                                  kit_page_id: episodePage.id || '',
                                  block_id: block.id,
                                  block_type: block.block_type,
                                  reference_media: block.reference_media ? JSON.stringify(block.reference_media) : '',
                                  recommended_tools: recommendedTools.join(','),
                                  // Pass the selected production method
                                  production_method: selectedMethod || userTimeline?.selected_method || '',
                                });
                                navigate(`/Studio?${params.toString()}`);
                              }}
                              className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/30 flex items-center justify-center hover:bg-red-600/30 transition-colors"
                              title="Produce in Studio"
                            >
                              <FlaskConical size={14} className="text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-white/20 text-xs mt-6 text-center">
                  Click <Film size={11} className="inline mb-0.5" /> to view block details. Click <FlaskConical size={11} className="inline mb-0.5 text-red-400" /> to produce in Studio.
                </p>
              </motion.div>
            )}

            {/* BLOCK DETAIL */}
            {step === STEP_BLOCK_DETAIL && selectedBlock && (() => {
              const block = sortedTimeline.find(b => b.id === selectedBlock.id) || selectedBlock;
              const override = getOverride(block.id);
              const isAllowed = true;
              const assignedChar = production.characters?.find(c => c.id === block.assigned_character_id);

              return (
                <motion.div key="block_detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="px-5 py-6 space-y-6">
                  {/* Block header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-xs font-mono">{String(block.order).padStart(2, '0')}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${BLOCK_TYPE_COLORS[block.block_type] || ''}`}>
                      {BLOCK_TYPE_LABELS[block.block_type]}
                    </span>
                    <h3 className="text-white text-base font-light">{block.title}</h3>
                  </div>

                  {block.description && (
                    <p className="text-white text-sm font-light">{block.description}</p>
                  )}

                  {/* Assigned character */}
                  {assignedChar && (
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                      {assignedChar.photo_url
                        ? <img src={assignedChar.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                        : <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"><User size={16} className="text-white" /></div>
                      }
                      <div>
                        <p className="text-white text-sm font-medium">{assignedChar.name}</p>
                        {assignedChar.description && <p className="text-white text-xs">{assignedChar.description}</p>}
                      </div>
                    </div>
                  )}

                  {/* Dialogue */}
                  {block.dialogue && (
                    <div>
                      <p className="text-white text-xs tracking-widest uppercase mb-2">Dialogue</p>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-white/80 text-sm font-light leading-relaxed italic">"{block.dialogue}"</p>
                      </div>
                    </div>
                  )}

                  {/* Reference media */}
                  {(block.reference_media || []).length > 0 && (
                    <div>
                      <p className="text-white text-xs tracking-widest uppercase mb-2">Reference Media</p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {block.reference_media.map((url, i) => (
                          url.match(/\.(mp4|webm|ogg|mov)$/i)
                            ? <video key={i} src={url} controls className="w-full rounded-lg flex-shrink-0" />
                            : <ProxiedImage key={i} src={url} className="w-32 h-32 rounded-lg flex-shrink-0" style={{ objectFit: 'cover' }} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Production instructions */}
                  {block.production_instructions && (
                    <div>
                      <p className="text-white text-xs tracking-widest uppercase mb-2">Instructions</p>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-white/80 text-sm font-light leading-relaxed whitespace-pre-wrap">{block.production_instructions}</p>
                      </div>
                    </div>
                  )}

                  {/* Karaoke guide — Musical only */}
                  {isMusical && block.karaoke_guide_url && (
                    <div>
                      <p className="text-white text-xs tracking-widest uppercase mb-2">🎤 Karaoke Guide</p>
                      <video src={block.karaoke_guide_url} controls playsInline className="w-full rounded-xl" />
                    </div>
                  )}

                  {/* Allowed methods — tabbed technique guide */}
                  {selectedMethod === 'voice_only' ? (
                    <div>
                      <p className="text-white text-xs tracking-widest uppercase mb-3">Technique</p>
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                        <p className="text-white text-sm font-medium">Voice the Character</p>
                        <p className="text-white text-xs font-light leading-relaxed">Upload a voice recording or audio file. The original actor's visual appearance and movement will be preserved — only your voice replaces theirs.</p>
                      </div>
                    </div>
                  ) : <TechniquesSection block={block} selectedMethod={selectedMethod} activeMethodTab={activeMethodTab} setActiveMethodTab={setActiveMethodTab} />}

                  {/* Master / User version */}
                  <div>
                    <p className="text-white text-xs tracking-widest uppercase mb-3">Your Version</p>
                    {!isAllowed ? (
                      <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                        <Lock size={16} className="text-white/20" />
                        <p className="text-white text-sm">This block is not assigned to your character / method. It will use the master version.</p>
                      </div>
                    ) : (
                      <BlockVersionUploader
                        method={selectedMethod}
                        block={{
                          ...block,
                          dossier_id: dossier?.id,
                          kit_page_id: episodePage.id,
                        }}
                        override={override}
    
                        onDone={(file_url) => uploadBlockOverride(block, { url: file_url })}
                      />
                    )}
                  </div>
                </motion.div>
              );
            })()}

          </AnimatePresence>
        )}
      </div>

      {/* Floating AI Assistant */}
      {production && (
        <ProductionAssistantChat
          episodeTitle={episodePage.episode_title || episodePage.title}
          dossierTitle={dossier?.title}
          dossierCategory={dossier?.category}
        />
      )}
    </div>
  );
}