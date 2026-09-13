import VoicePicker from '@/components/studio/VoicePicker.jsx';
import { VOICE_NAMES } from '@/lib/voiceCatalog.js';
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Globe, Film, ShieldAlert } from 'lucide-react';

const PRODUCTION_TYPES = [
  { value: "cover", label: "Cover" },
  { value: "actors", label: "Actors" },
  { value: "production_kits", label: "Production's Kits" },
  { value: "dramas", label: "Dramas" },
  { value: "comedy", label: "Comedy" },
  { value: "romance", label: "Romance" },
  { value: "musical", label: "Musical" },
  { value: "music", label: "Music" },
  { value: "fashion", label: "Fashion" },
  { value: "influencers", label: "Influencers" },
  { value: "documentary", label: "Documentary" },
  { value: "news", label: "News" },
  { value: "how_to", label: "How to" },
];

const TOOLS_DESCRIPTION = `

The platform will provide you at runtime with the actual production data: the kit's characters (names, descriptions), sets (names, descriptions), costumes, and the list of scene blocks (titles, descriptions, instructions). You MUST read and reference this injected data — do not invent or assume any names, scenes, or details that are not in the data provided to you.

You have access to a knowledge library via the searchKnowledge tool. When a member asks about a specific tool, technique, character type, or production concept — call searchKnowledge with their question as the query. Read the returned entries and use them to give an accurate, detailed answer. Do not guess or invent explanations for things you can look up.

The production room gives members these tools for each scene block:
- Compose Scene: AI generates a scene image — the member selects characters, sets, and costumes from the kit's data, then adds a mood or action description.
- Animate: Brings a still image to life as a short video using a motion prompt.
- Ref Motion: Animates an image by matching motion from a reference video the member uploads.
- Lip Sync: Syncs a video's mouth movement to a new audio track (member records or uploads audio).
- AI Video: Generates a video purely from a text prompt — no image needed.
- Upload: Member directly uploads their own image, video, or audio file for the block.

Each scene block has a title and optional notes. Members can have multiple episodes per production.`;

const TYPE_PRESETS = {
  cover: `You are an AI production assistant helping members create compelling cover content.${TOOLS_DESCRIPTION}

When the member starts, read the characters, sets, and costumes provided in the kit data — introduce them to what is available before guiding them. For each block, help them use "Compose Scene" by selecting the most visually striking character and set from the list provided. If they want motion, suggest "Animate" with a slow, cinematic prompt. Encourage bold, clean compositions.`,

  actors: `You are an AI production assistant guiding actors through their scene blocks.${TOOLS_DESCRIPTION}

When the member starts, read the characters and blocks provided by the platform — introduce the available characters and summarize each block's purpose before guiding them. For each block, suggest "Compose Scene" using the character and set from the kit data. If dialogue is in the block's instructions, suggest "Lip Sync" to replace audio with their own voice. Encourage consistency with the reference media provided per block.`,

  production_kits: `You are an AI production assistant helping members build their production using the kit's assets.${TOOLS_DESCRIPTION}

When the member starts, read the full kit data provided: list the available characters, sets, and costumes to the member so they know what they have to work with. Then walk them through each block one by one using the block's title and description from the platform data. For each block, guide them to use "Compose Scene" with the appropriate assets, or "Animate" / "AI Video" for dynamic content.`,

  dramas: `You are an AI production assistant helping members craft emotionally powerful dramatic scenes.${TOOLS_DESCRIPTION}

When the member starts, read the blocks and characters provided by the platform — summarize the dramatic arc and what each block requires before proceeding. Guide them block by block, referencing each block's title, description, and production instructions. Suggest "Ref Motion" for performance blocks or "Lip Sync" for dialogue. Help them write scene descriptions that convey the emotional stakes described in the block data.`,

  comedy: `You are an AI production assistant helping members create comedic content.${TOOLS_DESCRIPTION}

When the member starts, read the characters and blocks provided by the platform — describe what the kit contains in a fun, engaging way. For each block, reference its title and description and guide the member to execute it. Suggest "Animate" with playful motion prompts or "Lip Sync" for comedic delivery. Encourage punchy block descriptions that match the tone shown in the kit data.`,

  romance: `You are an AI production assistant helping members create romantic scenes.${TOOLS_DESCRIPTION}

When the member starts, read the characters, sets, and blocks provided by the platform — introduce each character and setting available in warm, evocative terms. For each block, reference its title and production instructions. Suggest "Compose Scene" for intimate visuals and "Animate" for gentle motion. Guide the member to use the specific characters and sets from the kit data to match the scene's tone.`,

  musical: `You are an AI production assistant guiding members through musical performance productions.${TOOLS_DESCRIPTION}

When the member starts, read the blocks provided by the platform — each block may contain a karaoke guide URL or instrumental track URL. Always tell the member when those are available and how to use them. The primary tool here is "Lip Sync" — guide the member to record or upload their vocal performance, then apply it. Use "Compose Scene" for establishing and transition blocks as described in the kit data.`,

  music: `You are an AI production assistant helping members produce music-related visual content.${TOOLS_DESCRIPTION}

When the member starts, read the blocks and any reference media provided by the platform. Describe the visual mood and structure of the production from the block data. Guide the member to use "Compose Scene" for atmospheric stills, "Animate" for motion, or "AI Video" for fully generated clips. Reference each block's description and production instructions to help the member match the right tool to the right moment.`,

  fashion: `You are an AI production assistant helping members create fashion content.${TOOLS_DESCRIPTION}

When the member starts, read the costumes, characters, and sets provided in the kit data — present them clearly so the member knows their palette. For each block, reference its title and description and suggest the best costume and set combination from the available kit assets. Guide them to write detailed "Compose Scene" prompts that mention the specific wardrobe and location from the kit data.`,

  influencers: `You are an AI production assistant helping influencers create engaging content.${TOOLS_DESCRIPTION}

When the member starts, read the blocks provided by the platform — each block may have a specific topic, message, or call to action described. Present the production structure to the member clearly. Suggest "Upload" for personal on-camera content or "Compose Scene" for branded visuals. Guide them to reference the block's description when writing their scene prompt or recording their voiceover via "Lip Sync".`,

  documentary: `You are an AI production assistant helping members produce documentary-style content.${TOOLS_DESCRIPTION}

When the member starts, read the blocks provided by the platform — each block represents a segment of the documentary narrative. Present the full structure to the member (intro, key segments, conclusion) using the block titles and descriptions from the platform data. Suggest "Compose Scene" or "AI Video" for b-roll and establishing shots, and "Upload" or "Lip Sync" for narration and interview blocks. Always reference the specific block context from the data.`,

  news: `You are an AI production assistant helping members create news-style content.${TOOLS_DESCRIPTION}

When the member starts, read the blocks provided by the platform — each block represents a segment of the broadcast (anchor shot, report, closing, etc.). Present the rundown to the member using the block titles and descriptions from the data. Guide them to use "Compose Scene" for on-set visuals, "Upload" for their own footage, or "Lip Sync" to dub their delivery. Reference the specific block instructions when advising on tone and framing.`,

  how_to: `You are an AI production assistant helping members create instructional content.${TOOLS_DESCRIPTION}

When the member starts, read the blocks provided by the platform — each block represents a step in the how-to. Present the full step list to the member using the block titles and descriptions from the data, so they know what to produce. Guide them step by step, referencing each block's title and production instructions. Suggest "Compose Scene" or "Upload" for the visual, and "Lip Sync" or audio upload for spoken explanation of each step.`,
};

const VOICE_MODELS = VOICE_NAMES.map(value => ({ value, label: value }));

export default function AdminAgentConfig() {
  const [editingConfig, setEditingConfig] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => setIsAdmin(u?.role === 'admin')).catch(() => setIsAdmin(false));
  }, []);

  const { data: configs = [] } = useQuery({
    queryKey: ['agentConfigs'],
    queryFn: () => base44.entities.AgentConfig.list('config_name'),
  });

  const { data: dossiers = [] } = useQuery({
    queryKey: ['adminDossiersForAgent'],
    queryFn: () => base44.entities.Dossier.list('title'),
  });

  const createConfigMutation = useMutation({
    mutationFn: (data) => base44.entities.AgentConfig.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agentConfigs'] }); setEditingConfig(null); }
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AgentConfig.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agentConfigs'] }); setEditingConfig(null); }
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id) => base44.entities.AgentConfig.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agentConfigs'] })
  });

  if (isAdmin === null) return <div className="py-12 text-center text-white text-sm">Checking access...</div>;
  if (!isAdmin) return (
    <div className="py-16 flex flex-col items-center gap-3 text-center">
      <ShieldAlert size={32} className="text-red-500" />
      <p className="text-white text-sm">Admin access only</p>
    </div>
  );

  const handleSave = () => {
    if (editingConfig.id) {
      updateConfigMutation.mutate({ id: editingConfig.id, data: editingConfig });
    } else {
      createConfigMutation.mutate(editingConfig);
    }
  };

  const handleDossierSelect = (dossierId) => {
    const dossier = dossiers.find(d => d.id === dossierId);
    setEditingConfig({
      ...editingConfig,
      dossier_id: dossierId,
      dossier_title: dossier?.title || '',
    });
  };

  const openNew = () => setEditingConfig({
    config_name: '',
    scope: 'global_type',
    production_type: '',
    dossier_id: '',
    dossier_title: '',
    system_instructions: '',
    best_practices: '',
    voice_model: 'Rachel',
    is_active: true,
  });

  // Group configs: specific first, then global
  const specificConfigs = configs.filter(c => c.scope === 'specific_production');
  const globalConfigs = configs.filter(c => c.scope !== 'specific_production');

  const ConfigCard = ({ config }) => {
    const linkedDossier = dossiers.find(d => d.id === config.dossier_id);
    const typeLabel = PRODUCTION_TYPES.find(t => t.value === config.production_type)?.label;

    return (
      <div className="bg-neutral-950 border border-white/10 rounded-sm p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-white font-medium">{config.config_name || '(Unnamed)'}</h3>
              {config.is_active ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/50 text-green-400 flex items-center gap-1">
                  <CheckCircle2 size={9} /> Active
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-white flex items-center gap-1">
                  <XCircle size={9} /> Inactive
                </span>
              )}
            </div>

            {/* Scope indicator */}
            <div className="flex items-center gap-1.5 mb-2">
              {config.scope === 'specific_production' ? (
                <>
                  <Film size={12} className="text-red-400" />
                  <span className="text-red-300 text-xs font-medium">Specific Production</span>
                  <span className="text-white text-xs">→</span>
                  <span className="text-white text-xs truncate">
                    {config.dossier_title || linkedDossier?.title || config.dossier_id || '(none)'}
                  </span>
                </>
              ) : (
                <>
                  <Globe size={12} className="text-blue-400" />
                  <span className="text-blue-300 text-xs font-medium">Global Type</span>
                  {typeLabel && <><span className="text-white text-xs">→</span><span className="text-white text-xs">{typeLabel}</span></>}
                </>
              )}
            </div>

            <p className="text-white text-xs line-clamp-2">{config.system_instructions}</p>
            <p className="text-white text-xs mt-1">
              Voice: {VOICE_MODELS.find(v => v.value === config.voice_model)?.label || config.voice_model}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setEditingConfig(config)} className="text-white hover:text-white h-8 w-8">
              <Edit2 size={15} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteConfigMutation.mutate(config.id)} className="text-white hover:text-red-500 h-8 w-8">
              <Trash2 size={15} />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-lg font-light">Production Agent Configurations</h2>
          <p className="text-white text-sm mt-1">Set AI guidance per production type or per specific production</p>
        </div>
        <Button onClick={openNew} className="bg-white text-black hover:bg-white/90">
          <Plus size={16} className="mr-2" /> New Configuration
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-12 bg-neutral-950 border border-white/10 rounded-sm">
          <p className="text-white text-sm">No agent configurations yet</p>
          <p className="text-white text-xs mt-1">Create a global type rule or link one to a specific production</p>
        </div>
      ) : (
        <div className="space-y-6">
          {specificConfigs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Film size={14} className="text-red-400" />
                <p className="text-red-300 text-xs font-medium uppercase tracking-wider">Specific Productions</p>
              </div>
              <div className="space-y-2">
                {specificConfigs.map(c => <ConfigCard key={c.id} config={c} />)}
              </div>
            </div>
          )}
          {globalConfigs.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Globe size={14} className="text-blue-400" />
                <p className="text-blue-300 text-xs font-medium uppercase tracking-wider">Global Type Rules</p>
              </div>
              <div className="space-y-2">
                {globalConfigs.map(c => <ConfigCard key={c.id} config={c} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingConfig && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-white/10 rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white text-lg font-light">
                  {editingConfig.id ? 'Edit' : 'New'} Agent Configuration
                </h3>
                <button onClick={() => setEditingConfig(null)} className="text-white hover:text-white">
                  <XCircle size={20} />
                </button>
              </div>

              {/* Config Name */}
              <div>
                <label className="text-white text-sm block mb-2">Configuration Name <span className="text-red-400">*</span></label>
                <Input
                  value={editingConfig.config_name}
                  onChange={(e) => setEditingConfig({ ...editingConfig, config_name: e.target.value })}
                  placeholder="e.g. 'Summer MV 2025' or 'Default Music Video Guide'"
                  className="bg-neutral-900 border-white/10 text-white"
                />
              </div>

              {/* Scope toggle */}
              <div>
                <label className="text-white text-sm block mb-2">Scope</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditingConfig({ ...editingConfig, scope: 'global_type', dossier_id: '', dossier_title: '' })}
                    className={`flex items-center gap-2 px-4 py-3 rounded border text-sm transition-all ${editingConfig.scope !== 'specific_production' ? 'bg-blue-900/30 border-blue-500 text-blue-300' : 'border-white/10 text-white hover:border-white/30'}`}
                  >
                    <Globe size={16} />
                    <div className="text-left">
                      <p className="font-medium">Global Type</p>
                      <p className="text-xs opacity-70">Applies to all productions of a type</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setEditingConfig({ ...editingConfig, scope: 'specific_production' })}
                    className={`flex items-center gap-2 px-4 py-3 rounded border text-sm transition-all ${editingConfig.scope === 'specific_production' ? 'bg-red-900/30 border-red-500 text-red-300' : 'border-white/10 text-white hover:border-white/30'}`}
                  >
                    <Film size={16} />
                    <div className="text-left">
                      <p className="font-medium">Specific Production</p>
                      <p className="text-xs opacity-70">Links to one exact dossier</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Conditional: production type OR specific dossier */}
              {editingConfig.scope === 'specific_production' ? (
                <div>
                  <label className="text-white text-sm block mb-2">Linked Production (Dossier)</label>
                  <select
                    value={editingConfig.dossier_id || ''}
                    onChange={(e) => handleDossierSelect(e.target.value)}
                    className="w-full bg-neutral-900 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
                  >
                    <option value="">Select a production...</option>
                    {dossiers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.title}{d.category ? ` — ${d.category}` : ''}
                      </option>
                    ))}
                  </select>
                  {dossiers.length === 0 && (
                    <p className="text-white text-xs mt-1">Loading dossiers...</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-white text-sm block mb-2">Production Type</label>
                  <select
                    value={editingConfig.production_type || ''}
                    onChange={(e) => setEditingConfig({ ...editingConfig, production_type: e.target.value })}
                    className="w-full bg-neutral-900 border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
                  >
                    <option value="">Select a production type...</option>
                    {PRODUCTION_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* System Instructions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white text-sm">
                    System Instructions <span className="text-red-400">*</span>
                    <span className="text-white text-xs ml-2">How the agent should guide users</span>
                  </label>
                  {editingConfig.scope !== 'specific_production' && editingConfig.production_type && TYPE_PRESETS[editingConfig.production_type] && (
                    <button
                      type="button"
                      onClick={() => setEditingConfig({ ...editingConfig, system_instructions: TYPE_PRESETS[editingConfig.production_type] })}
                      className="text-xs px-2 py-1 rounded bg-blue-900/40 text-blue-300 border border-blue-500/30 hover:bg-blue-900/70 transition-colors"
                    >
                      Load Preset
                    </button>
                  )}
                </div>
                <Textarea
                  value={editingConfig.system_instructions}
                  onChange={(e) => setEditingConfig({ ...editingConfig, system_instructions: e.target.value })}
                  placeholder="You are an expert production assistant. Guide users through..."
                  className="bg-neutral-900 border-white/10 text-white min-h-[180px]"
                  rows={7}
                />
              </div>

              {/* Production Context */}
              <div>
                <label className="text-white text-sm block mb-2">
                  Production Context
                  <span className="text-white text-xs ml-2">Describe the production's sections, narrative, characters, and intent — this is injected into the agent so it knows what this production is about</span>
                </label>
                <Textarea
                  value={editingConfig.best_practices || ''}
                  onChange={(e) => setEditingConfig({ ...editingConfig, best_practices: e.target.value })}
                  placeholder={`Describe each section of this production:\n\nSection 1 — Opening: A dramatic rooftop scene where the lead character confronts their past...\nSection 2 — Chase: High-energy pursuit through narrow streets...\nSection 3 — Resolution: Quiet, emotional close-up of the character accepting their fate...\n\nAdd as much context as you want — tone, mood, character intent, visual style.`}
                  className="bg-neutral-900 border-white/10 text-white min-h-[160px]"
                  rows={7}
                />
              </div>

              {/* Voice Model */}
              <div>
                <label className="text-white text-sm block mb-2">Voice Model</label>
                <VoicePicker value={editingConfig.voice_model || 'Rachel'} onChange={value => setEditingConfig({ ...editingConfig, voice_model: value })} />
              </div>

              {/* Active */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-active"
                  checked={editingConfig.is_active}
                  onChange={(e) => setEditingConfig({ ...editingConfig, is_active: e.target.checked })}
                  className="w-4 h-4 accent-white"
                />
                <label htmlFor="is-active" className="text-white text-sm">Active</label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={() => setEditingConfig(null)} className="flex-1 bg-neutral-700 border border-white/20 text-white hover:bg-neutral-600">
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!editingConfig.config_name || !editingConfig.system_instructions}
                  className="flex-1 bg-white text-black hover:bg-white/90 disabled:opacity-40"
                >
                  Save Configuration
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
