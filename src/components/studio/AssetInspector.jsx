import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, Star, Tag, Palette, User, Crop, Folder, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['character', 'set', 'costume', 'reference', 'script'];
const RATIOS = ['9:16', '16:9', '4:3', '1:1', '3:4'];

function ChipsInput({ label, icon: Icon, values, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const parts = draft.split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const merged = Array.from(new Set([...(values || []), ...parts]));
    onChange(merged);
    setDraft('');
  };
  const remove = (v) => onChange((values || []).filter(x => x !== v));
  return (
    <div>
      <label className="text-white/60 text-xs uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
        {Icon && <Icon size={12} />} {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {(values || []).map(v => (
          <span key={v} className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-full pl-3 pr-1.5 py-1 text-white text-xs">
            {v}
            <button onClick={() => remove(v)} className="w-4 h-4 rounded-full hover:bg-white/20 flex items-center justify-center">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={placeholder}
        className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400"
      />
    </div>
  );
}

export default function AssetInspector({ asset, userEmail, folders = [], onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!asset) return;
    setForm({
      name: asset.name || '',
      actor_name: asset.actor_name || '',
      asset_category: asset.asset_category || '',
      aspect_ratio: asset.aspect_ratio || '',
      tags: asset.tags || [],
      style_tags: asset.style_tags || [],
      color_palette: asset.color_palette || [],
      is_magazine_ready: asset.is_magazine_ready || false,
      folder_id: asset.folder_id || '',
    });
  }, [asset]);

  if (!asset || !form) return null;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.VaultAsset.update(asset.id, {
        name: form.name.trim() || null,
        actor_name: form.actor_name.trim() || null,
        asset_category: form.asset_category || null,
        aspect_ratio: form.aspect_ratio || null,
        tags: form.tags,
        style_tags: form.style_tags,
        color_palette: form.color_palette,
        is_magazine_ready: form.is_magazine_ready,
        folder_id: form.folder_id || null,
      });
      queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
      toast.success('Asset updated');
      onClose();
    } catch {
      toast.error('Failed to save');
    }
    setSaving(false);
  };

  const isVideo = asset.media_type === 'video';
  const isScript = asset.media_type === 'script';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-neutral-950 border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Preview header */}
        <div className="relative h-56 bg-neutral-900 rounded-t-3xl overflow-hidden">
          {isScript ? (
            <div className="w-full h-full flex items-center justify-center text-yellow-400 text-5xl">📝</div>
          ) : isVideo ? (
            <video src={asset.url} className="w-full h-full object-contain" controls />
          ) : (
            <img src={asset.url} alt="" className="w-full h-full object-cover" />
          )}
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 bg-black/70 hover:bg-black rounded-full flex items-center justify-center">
            <X size={18} className="text-white" />
          </button>
          <button
            onClick={() => set('is_magazine_ready', !form.is_magazine_ready)}
            className={`absolute top-3 left-3 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
              form.is_magazine_ready
                ? 'bg-yellow-400 text-black shadow-lg'
                : 'bg-black/70 text-white border border-white/20 hover:border-yellow-400'
            }`}
          >
            <Star size={12} fill={form.is_magazine_ready ? 'currentColor' : 'none'} />
            {form.is_magazine_ready ? 'Magazine ready' : 'Mark ready'}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          <div>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Name this asset…"
              className="w-full bg-transparent text-white text-lg font-bold tracking-wide focus:outline-none placeholder-white/30"
            />
            <p className="text-white/40 text-xs mt-1">{asset.media_type} · saved {new Date(asset.created_date).toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1.5"><User size={12}/> Actor</label>
              <input
                value={form.actor_name}
                onChange={e => set('actor_name', e.target.value)}
                placeholder="e.g. Cassia"
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1.5"><Crop size={12}/> Ratio</label>
              <select
                value={form.aspect_ratio}
                onChange={e => set('aspect_ratio', e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
              >
                <option value="">—</option>
                {RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-white/60 text-xs uppercase tracking-wider font-medium mb-1.5 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => set('asset_category', form.asset_category === c ? '' : c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                    form.asset_category === c
                      ? 'bg-yellow-400 text-black'
                      : 'bg-white/5 text-white/70 border border-white/10 hover:border-white/30'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-white/60 text-xs uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1.5"><Folder size={12}/> Folder</label>
            <select
              value={form.folder_id}
              onChange={e => set('folder_id', e.target.value)}
              className="w-full bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
            >
              <option value="">Unfiled</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <ChipsInput label="Tags" icon={Tag} values={form.tags} onChange={v => set('tags', v)} placeholder="noir, 1940, dramatic (Enter to add)" />
          <ChipsInput label="Style" icon={Tag} values={form.style_tags} onChange={v => set('style_tags', v)} placeholder="cinematic, editorial (Enter to add)" />
          <ChipsInput label="Color palette" icon={Palette} values={form.color_palette} onChange={v => set('color_palette', v)} placeholder="midnight blue, gold (Enter to add)" />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-neutral-950 border-t border-white/10 p-4 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}