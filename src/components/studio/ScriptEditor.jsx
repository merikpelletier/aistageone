import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Save, Download, FileText, Sparkles, MessageSquare, Clapperboard, Check } from 'lucide-react';
import { toast } from 'sonner';
import { parseScript } from '@/lib/parseScript';

export default function ScriptEditor({ asset, userEmail, onClose, onUsePrompt }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(asset.url);
        const body = await res.text();
        if (active) { setText(body); setDirty(false); }
      } catch (e) {
        toast.error('Failed to load script');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [asset.url]);

  const parsed = useMemo(() => parseScript(text), [text]);

  // Flatten segments into a list of usable prompt/dialog items
  const items = useMemo(() => {
    const out = [];
    parsed.segments.forEach((seg) => {
      if (seg.narration) out.push({ seg, kind: 'prompt', label: 'Narration', text: seg.narration });
      if (seg.action) out.push({ seg, kind: 'prompt', label: 'Action', text: seg.action });
      if (seg.dialogue) out.push({ seg, kind: 'dialog', label: 'Dialogue', text: seg.dialogue });
    });
    return out;
  }, [parsed]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const safeName = (asset.name || 'script').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'script';
      const file = new File([text], `${safeName}.txt`, { type: 'text/plain' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.VaultAsset.update(asset.id, { url: file_url });
      queryClient.invalidateQueries({ queryKey: ['vaultAssets', userEmail] });
      setDirty(false);
      toast.success('Script saved');
    } catch (e) {
      toast.error('Failed to save script');
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (i) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const useSelected = () => {
    if (selected.size === 0) return;
    const combined = items
      .filter((_, i) => selected.has(i))
      .map((it) => it.text)
      .join('\n\n');
    handleUsePrompt(combined);
  };

  const handleUsePrompt = (itemText) => {
    if (onUsePrompt) {
      onUsePrompt(itemText);
    } else {
      navigator.clipboard?.writeText(itemText).then(() => toast.success('Copied to clipboard'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-3xl w-full max-h-full bg-neutral-950 rounded-xl overflow-hidden flex flex-col border border-yellow-400/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black">
          <span className="text-white font-bold flex items-center gap-2">
            <FileText size={16} className="text-yellow-400" />
            {asset.name || 'Script'}
            {dirty && <span className="text-yellow-400 text-xs font-bold ml-1">• unsaved</span>}
          </span>
          <div className="flex items-center gap-2">
            <a href={asset.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
              <Download size={12} /> Download
            </a>
            <button
              onClick={handleSave}
              disabled={saving || loading || !dirty}
              className="flex items-center gap-1.5 bg-yellow-400 text-black text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
            <button onClick={onClose} className="p-1.5 text-white hover:text-yellow-400 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Editor + prompts panel */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-yellow-400" />
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Text editor */}
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setDirty(true); }}
                className="w-full min-h-[40vh] bg-neutral-950 text-white text-sm font-mono leading-relaxed p-5 focus:outline-none resize-none border-b border-white/10"
                placeholder="Write your script…"
              />

              {/* Found prompts & dialogs */}
              {items.length > 0 && (
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-yellow-400" />
                    <p className="text-yellow-400 text-xs uppercase tracking-wider font-bold">
                      Found Prompts & Dialogs ({items.length})
                    </p>
                  </div>
                  {items.map((item, i) => {
                    const isDialog = item.kind === 'dialog';
                    const isSelected = selected.has(i);
                    return (
                      <div
                        key={i}
                        onClick={() => toggleItem(i)}
                        className={`rounded-xl p-3 border cursor-pointer transition-colors ${isSelected ? 'bg-yellow-400/10 border-yellow-400/60' : 'bg-white/5 border-white/10 hover:border-white/25'}`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] uppercase tracking-wider font-bold flex items-center gap-1.5 ${isDialog ? 'text-blue-400' : 'text-yellow-400'}`}>
                            {isDialog ? <MessageSquare size={11} /> : <Clapperboard size={11} />}
                            Seg {item.seg.index} • {item.label}
                          </span>
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${isSelected ? 'bg-yellow-400 border-yellow-400' : 'border-white/30'}`}>
                            {isSelected && <Check size={12} className="text-black" />}
                          </div>
                        </div>
                        <p className={`text-sm leading-relaxed ${isDialog ? 'text-blue-300 border-l-2 border-blue-400/40 pl-2.5' : 'text-white/90'}`}>
                          {item.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky selection bar */}
        {items.length > 0 && (
          <div className="border-t border-white/10 bg-black px-5 py-3 flex items-center justify-between">
            <span className="text-white/70 text-xs font-semibold">
              {selected.size > 0 ? `${selected.size} selected` : 'Tap items to select'}
            </span>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-white/60 hover:text-white text-xs font-bold px-3 py-2 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={useSelected}
                disabled={selected.size === 0}
                className="flex items-center gap-1.5 bg-yellow-400 text-black text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-40 active:scale-95 transition-transform"
              >
                <Sparkles size={13} />
                Use {selected.size > 0 ? `${selected.size} ` : ''}in Animate Image
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}