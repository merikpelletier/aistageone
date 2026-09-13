import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronUp, Pencil, Check, X, Loader2, Clapperboard, Plus, FileDown } from 'lucide-react';
import { toast } from 'sonner';

export default function BlockTextEditor({ block, index, onProduce, onRetry, generating, onAddBefore, onAddAfter, onAddSegmentBefore, onAddSegmentAfter, onBlockUpdated, episodeTitle, userEmail }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [summary, setSummary] = useState(block.narrative_summary || '');
  const [segments, setSegments] = useState(block.segment_instructions || []);

  // Sync local state when block prop changes (e.g. after agent finishes planning)
  // but don't overwrite user edits while editing
  useEffect(() => {
    if (!editing) {
      setSummary(block.narrative_summary || '');
      setSegments(block.segment_instructions || []);
    }
  }, [block.narrative_summary, block.segment_instructions, editing]);

  const isPending = block.generation_status === 'pending';
  const hasMedia = (block.video_segments || []).length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.StoryBlock.update(block.id, {
        narrative_summary: summary,
        segment_instructions: segments,
      });
      onBlockUpdated?.(updated);
      setEditing(false);
      toast.success('Chapter text saved');
    } catch (e) {
      toast.error('Failed to save');
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setSummary(block.narrative_summary || '');
    setSegments(block.segment_instructions || []);
    setEditing(false);
  };

  const updateSegment = (idx, field, value) => {
    setSegments(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // ── Export this chapter's text/info into a video script saved to the vault ──
  const handleExportScript = async () => {
    setExporting(true);
    try {
      let email = userEmail;
      if (!email) {
        try {
          const me = await base44.auth.me();
          email = me?.email;
        } catch {}
      }
      if (!email) { toast.error('Sign in to save to your vault'); return; }
      const title = (episodeTitle || block.block_title || `Chapter ${index + 1}`).trim();
      const lines = [];
      lines.push(title);
      lines.push('='.repeat(title.length));
      lines.push('');
      if (summary) {
        lines.push('NARRATIVE SUMMARY');
        lines.push(summary);
        lines.push('');
      }
      lines.push(`SEGMENTS (${segments.length})`);
      lines.push('');
      segments.forEach((seg, i) => {
        const header = `SEGMENT ${i + 1}`;
        const meta = [seg.media_type, seg.shot_framing].filter(Boolean).join(' • ');
        lines.push(`[${header}]${meta ? ' — ' + meta.toUpperCase() : ''}`);
        if (seg.selected_set) lines.push(`SET: ${seg.selected_set}`);
        const chars = Array.isArray(seg.characters_present) ? seg.characters_present.filter(Boolean).join(', ') : '';
        if (chars) lines.push(`CHARACTERS: ${chars}`);
        if (seg.emotional_tone) lines.push(`TONE: ${seg.emotional_tone}`);
        if (seg.narration_text) { lines.push('NARRATION:'); lines.push(seg.narration_text); }
        if (seg.dialogue) { lines.push('DIALOGUE:'); lines.push(seg.dialogue); }
        if (seg.story_action) { lines.push('ACTION:'); lines.push(seg.story_action); }
        if (seg.sound_effect) lines.push(`SOUND: ${seg.sound_effect}`);
        if (seg.continuity_notes) lines.push(`CONTINUITY: ${seg.continuity_notes}`);
        lines.push('---');
        lines.push('');
      });
      const scriptText = lines.join('\n');
      const safeName = title.replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'script';
      const file = new File([scriptText], `${safeName}.txt`, { type: 'text/plain' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.VaultAsset.create({
        user_email: email,
        name: title,
        url: file_url,
        media_type: 'script',
        asset_category: 'script',
      });
      toast.success('Video script saved to vault');
    } catch (e) {
      toast.error('Failed to export script');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white/5 rounded-2xl overflow-hidden">
      {/* Review header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3.5 text-left bg-yellow-400 hover:bg-yellow-300 text-black rounded-xl transition-colors shadow-lg"
      >
        <div className="flex items-center gap-2">
          <span className="text-black text-sm font-black uppercase tracking-wide">View & edit story text</span>
        </div>
        {expanded ? <ChevronUp size={20} className="text-black" strokeWidth={3} /> : <ChevronDown size={20} className="text-black" strokeWidth={3} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Narrative summary */}
              <div>
                <p className="text-white text-xs uppercase tracking-wider font-bold mb-1.5">Narrative Summary</p>
                {editing ? (
                  <textarea
                    value={summary}
                    onChange={e => setSummary(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-white text-sm placeholder-white/40 focus:outline-none focus:border-yellow-400 resize-none"
                    rows={3}
                  />
                ) : (
                  <p className="text-white text-sm leading-relaxed">{summary || '(No summary)'}</p>
                )}
              </div>

              {/* Segments */}
              <div className="space-y-2">
                <p className="text-white text-xs uppercase tracking-wider font-bold">Segments ({segments.length})</p>
                {segments.map((seg, i) => (
                  <div key={i}>
                    {i === 0 && (
                      <button
                        onClick={() => onAddSegmentBefore?.(i)}
                        className="w-full mb-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-md"
                      >
                        <Plus size={16} strokeWidth={3} /> INSERT BEFORE #{i + 1}
                      </button>
                    )}
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 bg-yellow-400 rounded flex items-center justify-center text-black text-xs font-black">{i + 1}</span>
                        <span className="text-white text-xs uppercase tracking-wide font-bold">{seg.media_type || 'image'}</span>
                        {seg.shot_framing && <span className="text-white text-xs">• {seg.shot_framing}</span>}
                      </div>
                      {editing ? (
                        <div className="space-y-2">
                          <div>
                            <p className="text-white/60 text-[10px] uppercase tracking-wider font-bold mb-1">Narration</p>
                            <textarea
                              value={seg.narration_text || ''}
                              onChange={e => updateSegment(i, 'narration_text', e.target.value)}
                              placeholder="Narration text…"
                              className="w-full bg-black border border-white/10 rounded p-2.5 text-white text-sm placeholder-white/40 focus:outline-none focus:border-yellow-400 resize-none"
                              rows={2}
                            />
                          </div>
                          <div>
                            <p className="text-yellow-400 text-[10px] uppercase tracking-wider font-bold mb-1">Dialogue</p>
                            <textarea
                              value={seg.dialogue || ''}
                              onChange={e => updateSegment(i, 'dialogue', e.target.value)}
                              placeholder='Character: "spoken words"'
                              className="w-full bg-black border border-yellow-400/40 rounded p-2.5 text-yellow-400 text-sm placeholder-white/30 focus:outline-none focus:border-yellow-400 resize-none"
                              rows={2}
                            />
                          </div>
                          <div>
                            <p className="text-white/60 text-[10px] uppercase tracking-wider font-bold mb-1">Action</p>
                            <input
                              value={seg.story_action || ''}
                              onChange={e => updateSegment(i, 'story_action', e.target.value)}
                              placeholder="Story action…"
                              className="w-full bg-black border border-white/10 rounded p-2.5 text-white text-sm placeholder-white/40 focus:outline-none focus:border-yellow-400"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-white text-sm leading-relaxed">{seg.narration_text || '(No narration)'}</p>
                          {seg.dialogue && (
                            <p className="text-yellow-400 text-sm mt-1.5 font-semibold leading-relaxed border-l-2 border-yellow-400/40 pl-2.5">{seg.dialogue}</p>
                          )}
                          {seg.story_action && <p className="text-white text-xs mt-1 italic">{seg.story_action}</p>}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onAddSegmentAfter?.(i)}
                      className="w-full mt-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-md"
                    >
                      <Plus size={16} strokeWidth={3} /> INSERT AFTER #{i + 1}
                    </button>
                  </div>
                ))}
              </div>

              {/* Edit / Save / Cancel */}
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 py-2.5 bg-yellow-400 text-black font-bold rounded-lg text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Save Changes
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2.5 bg-white/10 text-white font-bold rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex-1 py-2.5 bg-white/10 text-white font-bold rounded-lg text-sm flex items-center justify-center gap-1.5"
                  >
                    <Pencil size={16} />
                    Edit Text
                  </button>
                )}
                <button
                  onClick={handleExportScript}
                  disabled={exporting || segments.length === 0 && !summary}
                  className="flex-1 py-2.5 bg-yellow-400 text-black font-bold rounded-lg text-sm flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                  {exporting ? 'Exporting…' : 'Export Script'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}