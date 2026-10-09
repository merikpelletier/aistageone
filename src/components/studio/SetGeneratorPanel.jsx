import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { toast } from 'sonner';

const VIEW_SPECS = [
  ['Wide', `Move the camera significantly farther back from the Hero camera position and use a noticeably wider field of view. Reveal substantially more of the SAME room on the left, right, foreground and ceiling/floor. The result must NOT reuse the Hero framing or crop. Keep the same architectural geometry and object positions.`],
  ['Reverse', `Relocate the camera to the OPPOSITE SIDE of the room, approximately 180 degrees around the set from the Hero camera position, and point it back toward the exact area where the Hero camera was standing. Show the opposite wall and reverse the spatial relationships. The result must be unmistakably different from the Hero composition. Do NOT reproduce, mirror, crop, zoom or lightly reframe the Hero image.`],
  ['Left', `Relocate the camera clearly to the LEFT side of the Hero camera position, approximately 70 to 100 degrees around the room, and aim across the SAME set toward the center. Reveal surfaces and architectural elements that were hidden from the Hero viewpoint. Do NOT reproduce, mirror, crop or slightly reframe the Hero composition.`],
  ['Right', `Relocate the camera clearly to the RIGHT side of the Hero camera position, approximately 70 to 100 degrees around the room, and aim across the SAME set toward the center. Reveal surfaces and architectural elements that were hidden from the Hero viewpoint. Do NOT reproduce, mirror, crop or slightly reframe the Hero composition.`],
  ['Detail', `Move the camera physically close to one distinctive architectural, material or furniture detail that already exists in the Hero image. Create a true close detail shot from the SAME set, not a wide room view. Preserve the exact material, finish, lighting and design language.`],
  ['Day', `Keep the SAME physical camera position and composition as the Hero image, but change ONLY the time and lighting to convincing daytime. Preserve architecture, furniture, object placement, lens perspective and framing. Do not redesign the set.`],
  ['Night', `Keep the SAME physical camera position and composition as the Hero image, but change ONLY the time and lighting to convincing nighttime. Preserve architecture, furniture, object placement, lens perspective and framing. Do not redesign the set.`],
];

const buildHeroPrompt = (name, description) => `Create a production-ready cinematic set design image for a fictional film or series.\nSet name: ${name || 'Untitled set'}\nCreative brief:\n${description || 'No additional brief provided.'}\nRender the actual physical environment, not a mood board, not a collage, not a floor plan. Show a believable camera-ready location with coherent architecture, materials, lighting and depth. No people, no text, no logos. High-end production design, realistic spatial continuity, 16:9 composition.`;

const buildViewPrompt = (name, description, instruction) => `${buildHeroPrompt(name, description)}\n\nCAMERA CONTINUITY TASK:\nThe supplied Hero image defines a real three-dimensional set. Treat it as a spatial reference, not as a composition to copy. Infer the room geometry, architecture, furniture placement, windows, doors, stairs, fixtures, materials and proportions from it.\n\n${instruction}\n\nNON-NEGOTIABLE CONTINUITY RULES:\n- This must be the exact SAME location and production set, never a redesign.\n- Preserve architecture, dimensions, materials, furniture, fixtures, windows, doors, stairs and object placement.\n- Preserve the visual identity and palette.\n- For camera-angle views, physically relocate the virtual camera in the inferred 3D space. Do not fake a new angle by mirroring, cropping, zooming or making a small framing change.\n- The new viewpoint must show correct parallax and reveal/occlude elements according to the new camera position.\n- No people, no text, no logos.\n- 16:9 cinematic production reference image.`;

export default function SetGeneratorPanel({ name, description, images, setImages }) {
  const [mode, setMode] = useState(images?.length ? 'reference' : 'scratch');
  const [generating, setGenerating] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const heroImage = images?.[0] || null;
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
  const creditsPerImage = priceQuote?.credits || null;

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

  const generateHero = async () => {
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
    try {
      const refs = mode === 'reference' ? images.slice(0, 3) : [];
      const url = await runGeneration(buildHeroPrompt(name, description), refs);
      setImages(current => {
        const next = [...current];
        next[0] = url;
        return next.slice(0, 8);
      });
      toast.success('Hero set generated');
    } catch (error) {
      console.error('Set Hero generation failed', error);
      toast.error(error.message?.includes('Insufficient') || error.message?.includes('credits') ? 'Not enough credits for this generation.' : (error.message || 'Set generation failed. Try again.'));
    } finally {
      setGenerating('');
    }
  };

  const generateView = async (index, label, instruction) => {
    if (!heroImage || !effectiveModel) return;
    setGenerating(label);
    try {
      const prompt = buildViewPrompt(name, description, instruction);
      const url = await runGeneration(prompt, [heroImage]);
      setImages(current => {
        const next = [...current];
        while (next.length <= index) next.push(null);
        next[index] = url;
        return next.slice(0, 8);
      });
      toast.success(`${label} view generated`);
    } catch (error) {
      console.error(`Set ${label} generation failed`, error);
      toast.error(error.message?.includes('Insufficient') || error.message?.includes('credits') ? 'Not enough credits for this generation.' : (error.message || `${label} generation failed.`));
    } finally {
      setGenerating('');
    }
  };

  const generateAllViews = async () => {
    if (!heroImage || !effectiveModel) return;
    try {
      for (let offset = 0; offset < VIEW_SPECS.length; offset += 1) {
        const [label, instruction] = VIEW_SPECS[offset];
        const index = offset + 1;
        setGenerating(label);
        const prompt = buildViewPrompt(name, description, instruction);
        const url = await runGeneration(prompt, [heroImage]);
        setImages(current => {
          const next = [...current];
          while (next.length <= index) next.push(null);
          next[index] = url;
          return next.slice(0, 8);
        });
      }
      toast.success('All continuity views generated');
    } catch (error) {
      console.error('Set continuity generation failed', error);
      toast.error(error.message?.includes('Insufficient') || error.message?.includes('credits') ? 'Not enough credits to finish all views.' : (error.message || 'Continuity generation failed.'));
    } finally {
      setGenerating('');
    }
  };

  return (
    <section className="set-generator-panel border border-white/10 bg-[#17191d] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#23c7be]"><Sparkles size={16} /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Generate the set</span></div>
          <h3 className="mt-1 text-xl font-black text-white">Create from scratch or build from references</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">Generate the Hero first, then choose only the additional production views you need. Each generated image is billed separately.</p>
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
            <span>AI cost per image: {priceLoading ? 'Calculating…' : creditsPerImage ? `${creditsPerImage} credits` : effectiveModel ? 'Unable to calculate' : 'Select a model'}</span>
          </div>
        </div>
        <button type="button" onClick={generateHero} disabled={Boolean(generating) || !canGenerateHero || !effectiveModel || modelsLoading} className="flex min-w-[220px] items-center justify-center gap-2 bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[0.06] disabled:text-white/30">
          {generating === 'Hero' ? <><Loader2 size={16} className="animate-spin" />GENERATING HERO...</> : <><Camera size={16} />GENERATE HERO SET{creditsPerImage ? ` · ${creditsPerImage}` : ''}</>}
        </button>
      </div>

      {heroImage && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Production views</p>
              <p className="mt-1 text-xs text-white/40">Choose the angles you need. Each button generates one additional image.</p>
            </div>
            <button type="button" onClick={generateAllViews} disabled={Boolean(generating) || !effectiveModel} className="border border-[#23c7be]/35 bg-[#23c7be]/10 px-4 py-2.5 text-xs font-black text-[#8ee9e4] hover:bg-[#23c7be]/15 disabled:opacity-40">
              GENERATE ALL VIEWS{creditsPerImage ? ` · ${creditsPerImage * 7} CREDITS` : ''}
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {VIEW_SPECS.map(([label, instruction], offset) => {
              const index = offset + 1;
              const exists = Boolean(images?.[index]);
              const busy = generating === label;
              return <button key={label} type="button" onClick={() => generateView(index, label, instruction)} disabled={Boolean(generating) || !effectiveModel} className={`border px-3 py-3 text-left text-xs font-black transition ${exists ? 'border-[#23c7be]/35 bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 bg-black/20 text-white hover:border-white/30'} disabled:opacity-40`}>
                {busy ? 'GENERATING...' : exists ? `${label.toUpperCase()} · REGENERATE${creditsPerImage ? ` · ${creditsPerImage}` : ''}` : `GENERATE ${label.toUpperCase()}${creditsPerImage ? ` · ${creditsPerImage}` : ''}`}
              </button>;
            })}
          </div>
        </div>
      )}
    </section>
  );
}
