import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { toast } from 'sonner';

const VIEW_SPECS = [
  ['Wide', `Move the camera significantly farther back from the Hero camera position and use a noticeably wider field of view. Reveal substantially more of the SAME room on the left, right, foreground and ceiling/floor. The result must NOT reuse the Hero framing or crop. Keep the same architectural geometry and object positions.`],
  ['Reverse', `Relocate the camera to the OPPOSITE SIDE of the room, approximately 180 degrees around the set from the Hero camera position, and point it back toward the exact area where the Hero camera was standing. Show the opposite wall and reverse the spatial relationships. The result must be unmistakably different from the Hero composition. Do NOT reproduce, mirror, crop, zoom or lightly reframe the Hero image.`],
  ['Left', `Generate a TRUE FLAT LEFT-SIDE VIEW of the SAME set, as a straight-on side elevation. Show the LEFT wall or side of the location DIRECTLY FROM THE FRONT, with the camera optical axis perpendicular (90 degrees) to that wall, level and centered. The wall plane must be parallel to the image plane, with horizontal and vertical architectural lines straight and squared. This is NOT a camera angle across the room: do not aim toward the center, do not show a corner or adjacent wall in three-quarter perspective, do not use diagonal framing, and do not create a cinematic oblique view. The output must clearly present the left side face-on. Preserve the established set identity, materials, fixtures and object positions where visible. Do not mirror, crop, or lightly reframe the Hero image.`],
  ['Right', `Generate a TRUE FLAT RIGHT-SIDE VIEW of the SAME set, as a straight-on side elevation. Show the RIGHT wall or side of the location DIRECTLY FROM THE FRONT, with the camera optical axis perpendicular (90 degrees) to that wall, level and centered. The wall plane must be parallel to the image plane, with horizontal and vertical architectural lines straight and squared. This is NOT a camera angle across the room: do not aim toward the center, do not show a corner or adjacent wall in three-quarter perspective, do not use diagonal framing, and do not create a cinematic oblique view. The output must clearly present the right side face-on. Preserve the established set identity, materials, fixtures and object positions where visible. Do not mirror, crop, or lightly reframe the Hero image.`],
  ['Detail', `Move the camera physically close to one distinctive architectural, material, furniture or required composition element that already exists in the Hero image. Create a true close detail shot from the SAME set, not a wide room view. Preserve the exact material, finish, lighting and design language.`],
  ['Day', `Keep the SAME physical camera position and composition as the Hero image, but change ONLY the time and lighting to convincing daytime. Preserve architecture, furniture, object placement, lens perspective and framing. Do not redesign the set.`],
  ['Night', `Keep the SAME physical camera position and composition as the Hero image, but change ONLY the time and lighting to convincing nighttime. Preserve architecture, furniture, object placement, lens perspective and framing. Do not redesign the set.`],
];

const humanize = value => String(value || '').replace(/_/g, ' ');
const buildCompositionPrompt = elements => {
  const valid = (elements || []).filter(item => item?.image_url);
  if (!valid.length) return '';
  const lines = valid.map((item, index) => {
    const required = item.priority === 'required' ? ' This object is mandatory. Do not omit or substitute it.' : '';
    return `${index + 1}. ${item.name || `Composition element ${index + 1}`} — role: ${humanize(item.role)}, priority: ${humanize(item.priority)}, visibility: ${humanize(item.visibility)}, placement: ${humanize(item.placement)}, scale: ${humanize(item.scale)}.${item.instruction ? ` Placement instruction: ${item.instruction}` : ''}${required}`;
  });
  return `\n\nCOMPOSITION ELEMENTS:\nThe additional supplied reference images after the set references are physical objects/products that must be integrated into the set, not used to redesign the architecture. Preserve each object's recognizable shape, materials, proportions, colors and identifying visual characteristics. Place them naturally according to the instructions below.\n${lines.join('\n')}`;
};

const buildHeroPrompt = (name, description, compositionElements = []) => `Create a production-ready cinematic set design image for a fictional film or series.\nSet name: ${name || 'Untitled set'}\nCreative brief:\n${description || 'No additional brief provided.'}\nRender the actual physical environment, not a mood board, not a collage, not a floor plan. Show a believable camera-ready location with coherent architecture, materials, lighting and depth. No people, no added text. High-end production design, realistic spatial continuity, 16:9 composition.${buildCompositionPrompt(compositionElements)}`;

const buildViewPrompt = (name, description, instruction, compositionElements = []) => `${buildHeroPrompt(name, description, compositionElements)}\n\nCAMERA CONTINUITY TASK:\nThe supplied Hero image defines a real three-dimensional set. Treat it as a spatial reference, not as a composition to copy. Infer the room geometry, architecture, furniture placement, windows, doors, stairs, fixtures, materials and proportions from it.\n\n${instruction}\n\nNON-NEGOTIABLE CONTINUITY RULES:\n- This must be the exact SAME location and production set, never a redesign.\n- Preserve architecture, dimensions, materials, furniture, fixtures, windows, doors, stairs and object placement.\n- Preserve the visual identity and palette.\n- Preserve the SAME physical placement of all composition elements within the set. Their apparent position, scale, occlusion and visibility must change naturally according to the new camera angle.\n- Required composition elements must not be omitted or substituted.\n- For camera-angle views, physically relocate the virtual camera in the inferred 3D space. Do not fake a new angle by mirroring, cropping, zooming or making a small framing change.\n- EXCEPTION FOR LEFT AND RIGHT: these are orthogonal, straight-on side elevations, NOT cinematic camera angles; obey the requested flat wall-facing composition and avoid all three-quarter framing.\n- The new viewpoint must show correct parallax and reveal/occlude elements according to the new camera position.\n- No people, no added text.\n- 16:9 cinematic production reference image.`;

const EditableImage = ({ label, url, box, onStart, onMove, onEnd, onCancel }) => (
  <div className="relative aspect-video overflow-hidden border border-white/15 bg-black select-none"
    style={{ touchAction: 'none', cursor: url ? 'crosshair' : 'default' }}
    onPointerDown={event => url && onStart(event, label)}
    onPointerMove={onMove}
    onPointerUp={onEnd}
    onPointerCancel={onCancel}
  >
    {url ? <img src={url} alt={`Current ${label} view — drag to select the area to adjust`} draggable={false} className="h-full w-full object-contain pointer-events-none" /> :
      <div className="flex h-full items-center justify-center text-xs text-white/35">No {label} image yet</div>}
    {box && <div className="pointer-events-none absolute border-2 border-[#23c7be] bg-[#23c7be]/15"
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }} />}
  </div>
);

export default function SetGeneratorPanel({ name, description, images, setImages, compositionElements = [] }) {
  const [mode, setMode] = useState(images?.filter(Boolean).length ? 'reference' : 'scratch');
  const [generating, setGenerating] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [reverseDirection, setReverseDirection] = useState('');
  const [reverseType, setReverseType] = useState('auto');
  const [viewAdjustments, setViewAdjustments] = useState({});
  const [editRegions, setEditRegions] = useState({});
  const [drawingRegion, setDrawingRegion] = useState(null);
  const [editPreview, setEditPreview] = useState(null);
  const adjustView = (label, value) => setViewAdjustments(current => ({ ...current, [label]: value }));
  const adjustmentInstruction = label => viewAdjustments[label]?.trim() ? `\n\nHIGHEST PRIORITY — USER ADJUSTMENT FOR ${label.toUpperCase()} VIEW:\n${viewAdjustments[label].trim()}\nMake this requested change visibly and precisely in the generated image. For features the user explicitly changes (including windows, doors or walls), the instruction OVERRIDES the reference image and the general continuity/preservation rules above. Preserve only the other, unaffected parts of the same set. Do not reintroduce a feature the user asked to remove.` : '';
  const heroImage = images?.[0] || null;
  const setReferences = (images || []).filter(Boolean).slice(0, 3);
  const compositionRefs = (compositionElements || []).map(item => item?.image_url).filter(Boolean);
  const referenceCount = mode === 'reference' ? setReferences.length : 0;
  const canGenerateHero = useMemo(() => Boolean(name?.trim() || description?.trim()), [name, description]);
  const heroPrompt = useMemo(() => buildHeroPrompt(name, description, compositionElements) + adjustmentInstruction('Hero'), [name, description, compositionElements, viewAdjustments.Hero]);
  const heroRefs = useMemo(() => [...(mode === 'reference' ? setReferences : []), ...compositionRefs], [mode, setReferences.join('|'), compositionRefs.join('|')]);
  const pricingInput = useMemo(() => ({
    prompt: heroPrompt,
    aspect_ratio: '16:9',
    reference_image_urls: heroRefs,
  }), [heroPrompt, heroRefs.join('|')]);
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

  const runGeneration = async (prompt, refs = [], ratio = '16:9') => {
    if (!effectiveModel) throw new Error('No AI model available for Set Designer');
    const res = await base44.functions.invoke('replicateGenerate', {
      method: 'compose_scene',
      prompt,
      reference_image_urls: refs,
      aspect_ratio: ratio,
      model_key: effectiveModel,
    });
    if (res.data?.error) throw new Error(res.data.error);
    if (!res.data?.file_url) throw new Error('Generation returned no image');
    return res.data.file_url;
  };


  // Local image edit: work on a selected crop, then composite its result back into
  // the untouched source pixels. This is NOT a new full-frame camera generation.
  const loadImage = url => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The image could not be loaded for local editing.'));
    img.src = url;
  });
  const toBlob = canvas => new Promise((resolve, reject) =>
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image export failed.')), 'image/png')
  );
  const uploadPng = async (blob, name) => {
    const { file_url } = await base44.integrations.Core.UploadFile({
      file: new File([blob], name, { type: 'image/png' }),
    });
    if (!file_url) throw new Error('Edited image upload failed.');
    return file_url;
  };
  const pointOnImage = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    };
  };
  const beginRegion = (event, label) => {
    if (generating) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointOnImage(event);
    setDrawingRegion({ label, start: point, end: point });
  };
  const moveRegion = event => {
    if (!drawingRegion) return;
    const end = pointOnImage(event);
    setDrawingRegion(current => current ? { ...current, end } : null);
  };
  const finishRegion = event => {
    if (!drawingRegion) return;
    const end = pointOnImage(event);
    const { start, label } = drawingRegion;
    const region = {
      x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y),
    };
    if (region.width >= 0.015 && region.height >= 0.015) {
      setEditRegions(current => ({ ...current, [label]: region }));
    }
    setDrawingRegion(null);
  };
  const editBox = label => {
    if (drawingRegion?.label === label) {
      const { start, end } = drawingRegion;
      return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
    }
    return editRegions[label];
  };
  const localEdit = async (label, index) => {
    const originalUrl = images?.[index];
    const region = editRegions[label];
    const adjustment = viewAdjustments[label]?.trim();
    if (!originalUrl || !region || !adjustment || !effectiveModel) {
      toast.error('Select an area on the image and describe the adjustment first.');
      return;
    }
    setGenerating(label);
    try {
      const original = await loadImage(originalUrl);
      const x = Math.round(region.x * original.naturalWidth);
      const y = Math.round(region.y * original.naturalHeight);
      const width = Math.min(original.naturalWidth - x, Math.max(1, Math.round(region.width * original.naturalWidth)));
      const height = Math.min(original.naturalHeight - y, Math.max(1, Math.round(region.height * original.naturalHeight)));
      const crop = document.createElement('canvas');
      crop.width = width;
      crop.height = height;
      crop.getContext('2d').drawImage(original, x, y, width, height, 0, 0, width, height);
      const cropUrl = await uploadPng(await toBlob(crop), 'set-edit-source.png');
      const ratio = width / height >= 1.55 ? '16:9' : width / height >= 1.15 ? '4:3' : width / height >= 0.85 ? '1:1' : width / height >= 0.65 ? '3:4' : '9:16';
      const prompt = `Edit the supplied image crop, not an entire scene. Preserve the framing, lighting, existing structures, and everything not mentioned. Apply exactly this change to the supplied image crop: ${adjustment}. This image is a portion of a larger approved production set. No new camera angle, no restaging, no additional people, no text.`;
      const changedUrl = await runGeneration(prompt, [cropUrl], ratio);
      const changed = await loadImage(changedUrl);
      const composite = document.createElement('canvas');
      composite.width = original.naturalWidth;
      composite.height = original.naturalHeight;
      const ctx = composite.getContext('2d');
      ctx.drawImage(original, 0, 0);
      // Only selected pixels are replaced. All other original pixels are preserved.
      ctx.drawImage(changed, x, y, width, height);
      const mergedUrl = await uploadPng(await toBlob(composite), 'set-local-adjustment.png');
      setEditPreview({ label, index, before: originalUrl, after: mergedUrl });
      toast.success('Adjustment ready for review. The original view has not been replaced.');
    } catch (error) {
      console.error('Set local adjustment failed', error);
      toast.error(error.message || 'Local adjustment failed. Your original image is unchanged.');
    } finally {
      setGenerating('');
    }
  };
  const acceptEdit = () => {
    if (!editPreview) return;
    setImages(current => {
      const next = [...current];
      next[editPreview.index] = editPreview.after;
      return next;
    });
    setEditRegions(current => ({ ...current, [editPreview.label]: null }));
    setEditPreview(null);
    toast.success('Adjustment applied to the view. Save your set to keep this change.');
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
    if (mode === 'reference' && !setReferences.length) {
      toast.error('Add at least one set reference image, or choose From Scratch.');
      return;
    }

    setGenerating('Hero');
    try {
      const url = await runGeneration(heroPrompt, heroRefs);
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

  const REVERSE_DIRECTIONS = {
    auto: `First identify from the supplied Hero image whether this is an interior room, an exterior building entrance, or another type of space. Generate the natural camera reverse for THAT actual location: for a room, face the opposite side of the room from the other end; for a building entrance, position the camera by the entrance facing back toward the camera's original approach, showing the arrival area rather than copying the façade; for other locations, reverse the original camera's line of sight. Keep the known scene coherent; when the opposite side is not visible in the Hero, infer a plausible continuation rather than claiming its layout is known.`,
    interior: `INTERIOR REVERSE. Place the camera across the same room, point it toward the original Hero camera's side and show the opposite direction of the space. Maintain room dimensions, furniture identity, doors and windows that are visible in both angles. Surfaces not shown in the Hero must be plausible extrapolations, NOT mirrored copies of the visible wall.`,
    entrance: `EXTERIOR ENTRANCE REVERSE. Position the camera near the building entrance, looking outward toward the approach and grounds where the original Hero camera was located. The main façade is behind the camera and must NOT appear as a repeated background. Show a plausible arrival area while preserving all visible entrance features, steps, canopy and landscaping that would naturally remain in frame. Maintain the same light and weather.`,
    rear: `REAR EXTERIOR VIEW, not a 180-degree camera reverse. Show the other physical side of this same building, retaining its design vocabulary, scale, materials, roofline and landscape. Because the Hero does not reveal the rear elevation, depict a plausible continuation and do not copy, mirror or repeat the front façade.`,
  };
  const viewInstruction = (label, instruction) => {
    if (label !== 'Reverse') return instruction;
    return `${reverseType === 'interior' ? instruction : ''}\n\nREVERSE VIEW DIRECTION:\n${REVERSE_DIRECTIONS[reverseType] || REVERSE_DIRECTIONS.auto}\n${reverseDirection.trim() ? `ADDITIONAL USER DETAILS (take precedence for unseen areas): ${reverseDirection.trim()}` : ''}\nThis is a distinct viewpoint, not a mirror, crop or zoom of the Hero image. Do not imply that unseen architecture is known with certainty.`;
  };

  const generateView = async (index, label, instruction) => {
    if (!heroImage || !effectiveModel) return;
    setGenerating(label);
    try {
      const prompt = buildViewPrompt(name, description, viewInstruction(label, instruction), compositionElements) + adjustmentInstruction(label);
      const refs = [heroImage, ...compositionRefs];
      const url = await runGeneration(prompt, refs);
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
        const prompt = buildViewPrompt(name, description, viewInstruction(label, instruction), compositionElements) + adjustmentInstruction(label);
        const refs = [heroImage, ...compositionRefs];
        const url = await runGeneration(prompt, refs);
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
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">Generate the Hero first, then choose only the additional production views you need. Composition elements are included as separate object references. Each generated image is billed separately.</p>
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
            <span>{mode === 'scratch' ? 'No set reference required.' : `${referenceCount} set reference${referenceCount === 1 ? '' : 's'} will guide the Hero generation.`}</span>
            {compositionElements.length > 0 && <span>{compositionElements.length} composition element{compositionElements.length === 1 ? '' : 's'} will be included.</span>}
            <span>AI cost per image: {priceLoading ? 'Calculating…' : creditsPerImage ? `${creditsPerImage} credits` : effectiveModel ? 'Unable to calculate' : 'Select a model'}</span>
          </div>
        </div>
        <button type="button" onClick={generateHero} disabled={Boolean(generating) || !canGenerateHero || !effectiveModel || modelsLoading} className="flex min-w-[220px] items-center justify-center gap-2 bg-[#23c7be] px-5 py-3 text-sm font-black text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[0.06] disabled:text-white/30">
          {generating === 'Hero' ? <><Loader2 size={16} className="animate-spin" />GENERATING HERO...</> : <><Camera size={16} />GENERATE HERO SET{creditsPerImage ? ` · ${creditsPerImage}` : ''}</>}
        </button>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <EditableImage label="Hero" url={heroImage} box={editBox('Hero')} onStart={beginRegion} onMove={moveRegion} onEnd={finishRegion} onCancel={() => setDrawingRegion(null)} />
        <div>
          <label htmlFor="set-view-adjustment-hero" className="mb-2 block text-xs font-bold text-white/70">Hero · Adjustment instructions</label>
          <textarea id="set-view-adjustment-hero" value={viewAdjustments.Hero || ''} onChange={event => adjustView('Hero', event.target.value)} disabled={Boolean(generating)} rows={4} placeholder="Describe only the change you want" className="w-full border border-white/15 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-[#23c7be] focus:outline-none" />
          <p className="mt-1 text-xs text-white/45">Drag on the image to select an area. Only that area will be edited.</p>
          <button type="button" onClick={() => localEdit('Hero', 0)} disabled={!heroImage || !editRegions.Hero || !viewAdjustments.Hero?.trim() || Boolean(generating) || !effectiveModel}
            className="mt-2 w-full border border-[#23c7be]/50 px-3 py-2 text-xs font-black text-[#8ee9e4] disabled:opacity-30">{generating === 'Hero' ? 'APPLYING...' : 'APPLY ADJUSTMENT'}</button>
        </div>
      </div>

      {heroImage && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Production views</p>
              <p className="mt-1 text-xs text-white/40">Choose the angles you need. Composition elements keep the same physical placement across views.</p>
            </div>
            <button type="button" onClick={generateAllViews} disabled={Boolean(generating) || !effectiveModel} className="border border-[#23c7be]/35 bg-[#23c7be]/10 px-4 py-2.5 text-xs font-black text-[#8ee9e4] hover:bg-[#23c7be]/15 disabled:opacity-40">
              GENERATE ALL VIEWS{creditsPerImage ? ` · ${creditsPerImage * 7} CREDITS` : ''}
            </button>
          </div>
          <div className="mb-4 space-y-3 border border-white/15 bg-black/20 p-4">
            <p className="text-xs font-bold text-white/80">Reverse camera · Choose the view</p>
            <p className="text-xs leading-5 text-white/50">No camera terminology or prompt required. Choose what you want to see; Set writes the camera instructions automatically.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['auto', 'Automatic reverse', 'Let Set choose according to the Hero'],
                ['interior', 'Opposite side of the room', 'Interior reverse angle'],
                ['entrance', 'Looking away from the building', 'View outward from its entrance'],
                ['rear', 'Back of the building', 'Rear exterior, not a camera reverse'],
              ].map(([value, label, detail]) => (
                <button key={value} type="button" disabled={Boolean(generating)}
                  aria-pressed={reverseType === value}
                  onClick={() => setReverseType(value)}
                  className={`border px-3 py-2.5 text-left transition disabled:opacity-40 ${reverseType === value ? 'border-[#23c7be] bg-[#23c7be]/10' : 'border-white/15 bg-black/20 hover:border-white/40'}`}>
                  <span className="block text-xs font-bold text-white">{label}</span>
                  <span className="mt-1 block text-[11px] text-white/50">{detail}</span>
                </button>
              ))}
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-white/60 hover:text-white">Optional: add details for the unseen area</summary>
              <textarea id="reverse-direction" value={reverseDirection} onChange={(event) => setReverseDirection(event.target.value)}
                disabled={Boolean(generating)} rows={3}
                aria-label="Additional reverse view details"
                placeholder="For example: a circular driveway and palm-lined approach"
                className="mt-2 w-full border border-white/15 bg-[#101215] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#23c7be] focus:outline-none" />
            </details>
            <p className="text-[11px] text-white/40">Unseen areas are inferred by AI and may not exactly match the real architecture.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {VIEW_SPECS.map(([label, instruction], offset) => {
              const index = offset + 1;
              const exists = Boolean(images?.[index]);
              const busy = generating === label;
              return <div key={label} className={`border p-3 ${exists ? 'border-[#23c7be]/35 bg-[#23c7be]/10' : 'border-white/10 bg-black/20'}`}>
                <label htmlFor={`set-view-adjustment-${label}`} className="block text-xs font-black text-white">{label.toUpperCase()}</label>
                <div className="mt-2"><EditableImage label={label} url={images[index]} box={editBox(label)} onStart={beginRegion} onMove={moveRegion} onEnd={finishRegion} onCancel={() => setDrawingRegion(null)} /></div>
                <textarea id={`set-view-adjustment-${label}`} value={viewAdjustments[label] || ''} onChange={event => adjustView(label, event.target.value)} disabled={Boolean(generating)} rows={3} placeholder="Describe only the change you want" className="mt-2 w-full border border-white/15 bg-black/25 px-2 py-2 text-xs text-white placeholder:text-white/35 focus:border-[#23c7be] focus:outline-none" />
                <p className="mt-1 text-[11px] text-white/45">Drag on the image to select the area to change.</p>
                <button type="button" onClick={() => localEdit(label, index)} disabled={!exists || !editRegions[label] || !viewAdjustments[label]?.trim() || Boolean(generating) || !effectiveModel}
                  className="mt-2 w-full border border-[#23c7be]/50 px-2 py-2 text-xs font-black text-[#8ee9e4] disabled:opacity-30">{busy ? 'APPLYING...' : 'APPLY ADJUSTMENT'}</button>
                <button type="button" onClick={() => generateView(index, label, instruction)} disabled={Boolean(generating) || !effectiveModel} className="mt-2 w-full border border-[#23c7be]/35 px-2 py-2 text-xs font-black text-[#8ee9e4] hover:bg-[#23c7be]/10 disabled:opacity-40">
                  {busy ? 'GENERATING...' : exists ? `REGENERATE${creditsPerImage ? ` · ${creditsPerImage}` : ''}` : `GENERATE${creditsPerImage ? ` · ${creditsPerImage}` : ''}`}
                </button>
              </div>;
            })}
          </div>
        </div>
      )}
      {editPreview && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-5xl space-y-4 bg-[#17191d] p-5">
            <h3 className="text-lg font-black text-white">Review {editPreview.label} adjustment</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div><p className="mb-2 text-xs text-white/60">Original</p><img src={editPreview.before} alt="Unchanged original view" className="w-full" /></div>
              <div><p className="mb-2 text-xs text-white/60">Adjusted preview</p><img src={editPreview.after} alt="Locally adjusted view" className="w-full" /></div>
            </div>
            <p className="text-xs text-white/55">Only the selected area is replaced. The original remains unchanged until you accept.</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setEditPreview(null)} className="border border-white/20 px-5 py-2 text-sm text-white">DISCARD</button>
              <button type="button" onClick={acceptEdit} className="bg-[#23c7be] px-5 py-2 text-sm font-black text-black">ACCEPT ADJUSTMENT</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
