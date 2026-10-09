import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { toast } from 'sonner';

const VIEW_SPECS = [
  ['Wide', 'wide establishing view of the same set, preserving architecture, materials, palette and visual identity'],
  ['Reverse', 'reverse camera angle of the same set, looking back from the opposite side while preserving all spatial details'],
  ['Left', 'left-side camera angle of the same set with identical architecture, materials and design continuity'],
  ['Right', 'right-side camera angle of the same set with identical architecture, materials and design continuity'],
  ['Detail', 'cinematic detail shot from the same set, focused on a distinctive material or architectural feature'],
  ['Day', 'the same set in daytime lighting, preserving every design and architectural element'],
  ['Night', 'the same set at night, preserving every design and architectural element'],
];

const buildHeroPrompt = (name, description) => `Create a production-ready cinematic set design image for a fictional film or series.\nSet name: ${name || 'Untitled set'}\nCreative brief:\n${description || 'No additional brief provided.'}\nRender the actual physical environment, not a mood board, not a collage, not a floor plan. Show a believable camera-ready location with coherent architecture, materials, lighting and depth. No people, no text, no logos. High-end production design, realistic spatial continuity, 16:9 composition.`;

export default function SetGeneratorPanel({ name, description, images, setImages }) {
  const [mode, setMode] = useState(images?.length ? 'reference' : 'scratch');
  const [generating, setGenerating] = useState('');
  const [progress, setProgress] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const referenceCount = mode === 'reference' ? Math.min(images?.length || 0, 3) : 0;
  const canGenerateHero = useMemo(() => Boolean(name?.trim() || description?.trim()), [name, description]);
  const pricingInput = useMemo(() => ({
    prompt: buildHeroPrompt(name, description),
    aspect_ratio: '16:9',
    reference_image_urls: mode === 'reference' ? (images || []).slice(0, 3) : [],
  }), [name, description, mode, images]);
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({
    service: 'replicateGenerate:compose_scene',
    kind: 'image',
    input: pricingInput,
  });
  const effectiveModel = selectedModel || modelOptions.find(model => model.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({
    service: 'replicateGenerate:compose_scene',
    kind: 'image',
    input: pricingInput,
    modelKey: effectiveModel,
  });

  const runGeneration = async (prompt, refs = []) => {
    if (!effectiveModel) throw new Error('No AI model available for Set Designer');
    const res = await base44.functions.invoke('replicateGenerate', {
      method: 'compose_scene',
      prompt,
      reference_image_urls: refs,
      aspect_ratio: '16:9',
      model_key: effectiveModel,
    });
    if (res.data?.error) throw new Error(res.data.error);
    if (!res.data?.file_url) throw new Error('Generation returned no image');
    return res.data.file_url;
  };

  const generateSet = async () => {
    if (!canGenerateHero) {
      toast.error('Add a set name or creative brief first.');
      return;
    }
    if (!effectiveModel) {
      toast.error('No AI image model is enabled for Set Designer.');
      return;
    }
    if (mode === 'reference' && !images?.length) {
      toast.error('Add at least one reference image, or choose From Scratch.');
      return;
    }

    setGenerating('Hero');
    setProgress({ current: 1, total: 8, label: 'Hero' });

    try {
      const refs = mode === 'reference' ? images.slice(0, 3) : [];
      const heroUrl = await runGeneration(buildHeroPrompt(name, description), refs);

      setImages(current => {
        const next = [...current];
        next[0] = heroUrl;
        return next.slice(0, 8);
      });

      for (let offset = 0; offset < VIEW_SPECS.length; offset += 1) {
        const [label, instruction] = VIEW_SPECS[offset];
        const index = offset + 1;
        setGenerating(label);
        setProgress({ current: index + 1, total: 8, label });

        const prompt = `${buildHeroPrompt(name, description)}\nUse the provided hero image as the strict visual and spatial reference. Generate a ${instruction}. It must clearly be the SAME location, not a redesign. Keep architecture, surfaces, fixtures, furniture, proportions and palette consistent. No people, no text, no logos.`;
        const url = await runGeneration(prompt, [heroUrl]);

        setImages(current => {
          const next = [...current];
          while (next.length <= index) next.push(null);
          next[index] = url;
          return next.slice(0, 8);
        });
      }

      toast.success('Set and continuity views generated');
    } catch (error) {
      console.error('Set generation failed', error);
      toast.error(error.message?.includes('Insufficient') || error.message?.includes('credits') ? 'Not enough credits to finish the set generation.' : (error.message || 'Set generation failed. Try again.'));
    } finally {
      setGenerating('');
      setProgress(null);
    }
  };

  return (
    <section className="set-generator-panel border border-white/10 bg-[#17191d] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#23c7be]"><Sparkles size={16} /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Generate the set</span></div>
          <h3 className="mt-1 text-xl font-black text-white">Create from scratch or build from references</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">The Hero is generated first. Wide, Reverse, Left, Right, Detail, Day and Night are then generated automatically from that Hero and placed in the Visual Continuity Board.</p>
        </div>
        <div className="grid min-w-[280px] grid-cols-2 border border-white/10 bg-black/25 p-1">
          <button type="button" onClick={() => setMode('scratch')} disabled={Boolean(generating)} className={`px-4 py-2.5 text-xs font-black ${mode === 'scratch' ? 'bg-[#23c7be] text-black' : 'text-white/65 hover:text-white'} disabled:opacity-40`}>FROM SCRATCH</button>
          <button type="button" onClick={() => setMode('reference')} disabled={Boolean(generating)} className={`px-4 py-2.5 text-xs font-black ${mode === 'reference' ? 'bg-[#23c7be] text-black' : 'text-white/65 hover:text-white'} disabled:opacity-40`}>FROM REFERENCE</button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/45">AI Model</label>
          <select
            value={effectiveModel || ''}
            onChange={event => setSelectedModel(event.target.value || null)}
            disabled={modelsLoading || modelOptions.length === 0 || Boolean(generating)}
            className="w-full border border-white/15 bg-black/25 px-3 py-3 text-sm font-bold text-white outline-none focus:border-[#23c7be] disabled:opacity-50"
          >
            {modelsLoading && <option value="">Loading models…</option>}
            {!modelsLoading && modelOptions.length === 0 && <option value="">No model enabled for Set Designer</option>}
            {modelOptions.map(model => (
              <option key={model.model_key} value={model.model_key}>
                {model.name || model.model_key}{model.recommended ? ' — Recommended' : ''}{model.credits ? ` — ${model.credits} credits` : ''}
              </option>
            ))}
          </select>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/45">
            <span>{mode === 'scratch' ? 'No reference required.' : `${referenceCount} reference${referenceCount === 1 ? '' : 's'} will guide the Hero generation.`}</span>
            <span>AI cost per image: {priceLoading ? 'Calculating…' : priceQuote?.credits ? `${priceQuote.credits} credits` : effectiveModel ? 'Unable to calculate' : 'Select a model'}</span>
          </div>
          {progress && <div className="mt-3 text-xs font-black text-[#8ee9e4]">GENERATING {progress.current}/8 · {progress.label.toUpperCase()}</div>}
        </div>
        <button type="button" onClick={generateSet} disabled={Boolean(generating) || !canGenerateHero || !effectiveModel || modelsLoading} className="flex min-w-[220px] items-center justify-center gap-2 bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[0.06] disabled:text-white/30">
          {generating ? <><Loader2 size={16} className="animate-spin" />GENERATING {progress?.current || 1}/8...</> : <><Camera size={16} />GENERATE SET</>}
        </button>
      </div>
    </section>
  );
}
