import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
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
  const heroImage = images?.[0] || null;
  const referenceCount = mode === 'reference' ? Math.min(images?.length || 0, 3) : 0;
  const canGenerateHero = useMemo(() => Boolean(name?.trim() || description?.trim()), [name, description]);

  const runGeneration = async (prompt, refs = []) => {
    const res = await base44.functions.invoke('replicateGenerate', {
      method: 'compose_scene',
      prompt,
      reference_image_urls: refs,
      aspect_ratio: '16:9',
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
    if (mode === 'reference' && !images?.length) {
      toast.error('Add at least one reference image, or choose From Scratch.');
      return;
    }
    setGenerating('hero');
    try {
      const refs = mode === 'reference' ? images.slice(0, 3) : [];
      const url = await runGeneration(buildHeroPrompt(name, description), refs);
      setImages(current => [url, ...current.filter(item => item !== url)].slice(0, 8));
      toast.success('Hero set generated');
    } catch (error) {
      console.error('Set generation failed', error);
      toast.error(error.message?.includes('Insufficient tokens') ? 'Not enough credits for this generation.' : 'Set generation failed. Try again.');
    } finally {
      setGenerating('');
    }
  };

  const generateView = async (index, label, instruction) => {
    if (!heroImage) return;
    setGenerating(label);
    try {
      const prompt = `${buildHeroPrompt(name, description)}\nUse the provided hero image as the strict visual and spatial reference. Generate a ${instruction}. It must clearly be the SAME location, not a redesign. Keep architecture, surfaces, fixtures, furniture, proportions and palette consistent. No people, no text, no logos.`;
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
      toast.error(error.message?.includes('Insufficient tokens') ? 'Not enough credits for this generation.' : `${label} generation failed.`);
    } finally {
      setGenerating('');
    }
  };

  return (
    <section className="border border-white/10 bg-[#17191d] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#23c7be]"><Sparkles size={16} /><span className="text-[10px] font-black uppercase tracking-[0.18em]">Generate the set</span></div>
          <h3 className="mt-1 text-xl font-black text-white">Create from scratch or build from references</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">A reference image is optional. From Scratch uses the brief and creative-direction choices. From Reference also uses up to three imported images.</p>
        </div>
        <div className="grid min-w-[280px] grid-cols-2 border border-white/10 bg-black/25 p-1">
          <button type="button" onClick={() => setMode('scratch')} className={`px-4 py-2.5 text-xs font-black ${mode === 'scratch' ? 'bg-[#23c7be] text-black' : 'text-white/65 hover:text-white'}`}>FROM SCRATCH</button>
          <button type="button" onClick={() => setMode('reference')} className={`px-4 py-2.5 text-xs font-black ${mode === 'reference' ? 'bg-[#23c7be] text-black' : 'text-white/65 hover:text-white'}`}>FROM REFERENCE</button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-white/45">
          {mode === 'scratch' ? 'No reference required.' : `${referenceCount} reference${referenceCount === 1 ? '' : 's'} will guide the generation.`}
        </div>
        <button type="button" onClick={generateHero} disabled={Boolean(generating) || !canGenerateHero} className="flex min-w-[220px] items-center justify-center gap-2 bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[0.06] disabled:text-white/30">
          {generating === 'hero' ? <><Loader2 size={16} className="animate-spin" />GENERATING SET...</> : <><Camera size={16} />GENERATE HERO SET</>}
        </button>
      </div>

      {heroImage && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Generate matching production views</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {VIEW_SPECS.map(([label, instruction], offset) => {
              const index = offset + 1;
              const exists = Boolean(images?.[index]);
              const busy = generating === label;
              return <button key={label} type="button" onClick={() => generateView(index, label, instruction)} disabled={Boolean(generating)} className={`border px-3 py-3 text-left text-xs font-black transition ${exists ? 'border-[#23c7be]/35 bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 bg-black/20 text-white hover:border-white/30'} disabled:opacity-40`}>
                {busy ? 'GENERATING...' : exists ? `${label.toUpperCase()} · REGENERATE` : `GENERATE ${label.toUpperCase()}`}
              </button>;
            })}
          </div>
        </div>
      )}
    </section>
  );
}
