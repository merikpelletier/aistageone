import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Sparkles, Wand2, Check } from 'lucide-react';
import { toast } from 'sonner';

// App cover / canvas sizes — these map to the exact pixel dimensions the
// replicateGenerate (seedream-4.5) tool produces, so generated images fit
// the magazine page and the dossier covers without cropping.
const RATIOS = [
  { key: '2:3', label: 'Cover', hint: '2:3 · Magazine cover', w: 2, h: 3 },
  { key: '3:4', label: 'Portrait', hint: '3:4 · Portrait image', w: 3, h: 4 },
  { key: '1:1', label: 'Square', hint: '1:1 · Square image', w: 1, h: 1 },
  { key: '4:3', label: 'Landscape', hint: '4:3 · Landscape image', w: 4, h: 3 },
  { key: '16:9', label: 'Spread', hint: '16:9 · Double-page spread', w: 16, h: 9 },
];

// Generate an editorial image at an exact cover size, optionally using vault
// images as style references. Uses the existing replicateGenerate tool
// (seedream-4.5) which honors explicit width/height. The result is saved to
// the user's Vault so it stays linked to the asset library.
export default function AtelierGenerateModal({ userEmail, canvasRatio, onSelect, onClose }) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState(canvasRatio || '9:16');
  const [refUrls, setRefUrls] = useState([]);
  const [refCategory, setRefCategory] = useState('covers');
  const [status, setStatus] = useState('idle'); // idle | generating
  const [resultUrl, setResultUrl] = useState(null);

  const CATEGORIES = ['covers', 'clothes', 'characters', 'merchandise'];

  // Style references come from the admin-curated shared pool (StyleReference),
  // not the user's personal vault — so every user picks from the same quality set.
  const { data: refImages = [] } = useQuery({
    queryKey: ['styleReferences'],
    queryFn: () => base44.entities.StyleReference.filter({ is_active: true }, 'order'),
  });

  const { data: pricing } = useQuery({
    queryKey: ['toolPricing', 'compose_scene'],
    queryFn: () => base44.entities.ToolPricing.filter({ tool_id: 'compose_scene', is_active: true }).then(r => r[0]),
  });
  const cost = pricing?.token_cost;

  const toggleRef = (url) => setRefUrls(prev => prev[0] === url ? [] : [url]);

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error('Describe the image first'); return; }
    setStatus('generating'); setResultUrl(null);
    try {
      const res = await base44.functions.invoke('replicateGenerate', {
        method: 'compose_scene',
        prompt: prompt.trim(),
        reference_image_urls: refUrls.length ? refUrls : undefined,
        aspect_ratio: ratio,
      });
      const url = res?.data?.file_url;
      if (!url) {
        const err = res?.data?.error || res?.data?.message;
        if (err && /insufficient|token|balance/i.test(err)) {
          toast.error('Not enough tokens for this tool');
        } else {
          toast.error(err || 'Generation failed');
        }
        setStatus('idle');
        return;
      }
      setResultUrl(url);
      toast.success('Image generated');
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message;
      toast.error(/insufficient|token|balance/i.test(msg || '') ? 'Not enough tokens for this tool' : 'Generation failed');
      setStatus('idle');
    }
  };

  const handleUse = async () => {
    if (!resultUrl) return;
    try {
      await base44.entities.VaultAsset.create({
        user_email: userEmail,
        url: resultUrl,
        media_type: 'image',
        name: prompt.trim().slice(0, 40) || 'Generated',
        tags: ['ai-generated', 'atelier'],
        asset_category: 'reference',
        aspect_ratio: ratio.replace(':', ''),
      });
      qc.invalidateQueries({ queryKey: ['vaultImages', userEmail] });
    } catch { /* non-blocking */ }
    onSelect(resultUrl, { cover: true });
    onClose();
  };

  const ratioBox = RATIOS.find(r => r.key === ratio) || RATIOS[0];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-neutral-950 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-400 rounded-lg flex items-center justify-center"><Wand2 size={16} className="text-black" /></div>
            <p className="text-white font-bold tracking-wide">Generate Image</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center"><X size={16} className="text-white" /></button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Describe the image</p>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Cinematic editorial portrait, dramatic side lighting, deep shadows, film grain, 1970s noir…"
              className="w-full bg-black border border-white/15 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
            />
          </div>

          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Choose the purpose</p>
            <div className="grid grid-cols-5 gap-2">
              {RATIOS.map(r => (
                <button key={r.key} onClick={() => setRatio(r.key)} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-center ${ratio === r.key ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-white/10 text-white border-transparent'}`}>
                  <span className="text-xs font-bold leading-tight">{r.label}</span>
                  <span className="text-[8px] leading-tight opacity-70 px-0.5">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Style reference <span className="text-white/30 normal-case">{refUrls.length === 1 ? '· selected' : ''}</span></p>
            <p className="text-white/30 text-xs mb-2">Optional — pick one curated reference image to inspire the look. The AI uses it as visual context.</p>
            <div className="flex gap-1.5 mb-2">
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setRefCategory(c)} className={`px-2.5 py-1 rounded-full text-[10px] font-bold capitalize ${refCategory === c ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white border border-white/15'}`}>{c}</button>
              ))}
            </div>
            {refImages.length === 0 ? (
              <p className="text-white/30 text-xs">No references available yet.</p>
            ) : (
              <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto">
                {refImages.filter(a => (a.category || 'covers') === refCategory).map(a => {
                  const sel = refUrls.includes(a.url);
                  return (
                    <button key={a.id} onClick={() => toggleRef(a.url)} className={`relative rounded-lg overflow-hidden border-2 transition-colors ${sel ? 'border-yellow-400' : 'border-transparent'}`} style={{ aspectRatio: '3/4' }}>
                      <img src={a.url} alt="" className="w-full h-full object-cover" />
                      {sel && <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center"><Check size={10} className="text-black" /></span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {resultUrl && (
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider font-bold mb-2">Result · {ratioBox.label} · {ratioBox.hint.split(' · ')[0]}</p>
              <div className="mx-auto rounded-xl overflow-hidden bg-white/5 border border-white/10" style={{ aspectRatio: `${ratioBox.w}/${ratioBox.h}`, maxHeight: 240 }}>
                <img src={resultUrl} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/10 flex gap-2">
          {resultUrl ? (
            <button onClick={handleUse} className="flex-1 flex items-center justify-center gap-2 py-3 bg-yellow-400 text-black rounded-xl font-bold"><Check size={16} /> Add to canvas &amp; vault</button>
          ) : (
            <button onClick={handleGenerate} disabled={status === 'generating'} className="flex-1 flex items-center justify-center gap-2 py-3 bg-yellow-400 text-black rounded-xl font-bold disabled:opacity-50">
              {status === 'generating' ? <><Loader2 size={16} className="animate-spin" /> Generating…</> : <><Sparkles size={16} /> Generate{cost != null ? ` · ${cost} credits` : ''}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}