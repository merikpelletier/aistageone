import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { adjustmentFingerprint, adjustmentPrompt, adjustmentTarget } from './storyImageAdjustment.js';

import StoryImageFileActions from './StoryImageFileActions.jsx';

const button = 'border border-white/10 px-3 py-2.5 text-xs font-black transition-colors disabled:opacity-40';

export default function StoryImageAdjustment({ userEmail, imageName = 'FotoPlay', segment, ratio, panelRatio, price, busy, setBusy, onApply, referenceImages = [] }) {
  const [targetIndex, setTargetIndex] = useState(undefined);
  const [instruction, setInstruction] = useState('');
  const [reference, setReference] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  const latest = useRef({ segment, ratio, onApply });
  latest.current = { segment, ratio, onApply };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const target = targetIndex === undefined ? null : adjustmentTarget(segment, targetIndex);
  const original = target && segment.image_adjustments?.[target.key]?.original;
  const open = (index) => { setTargetIndex(index); setInstruction(''); setReference(''); setCandidate(null); setError(''); };
  const close = () => { if (!pending.current) setTargetIndex(undefined); };
  useEffect(() => {
    if (!target) return undefined;
    const escape = (event) => { if (event.key === 'Escape' && !pending.current) setTargetIndex(undefined); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [targetIndex]);

  const generate = async () => {
    if (pending.current || busy || !target || !instruction.trim()) return;
    pending.current = true; setError(''); setBusy(`${segment.id}-adjust`);
    const fingerprint = adjustmentFingerprint(segment, ratio);
    try {
      const response = await base44.integrations.Core.GenerateImage({
        prompt: adjustmentPrompt(instruction, Boolean(reference)),
        reference_image_urls: [target.url, ...(reference && reference !== target.url ? [reference] : [])],
        aspect_ratio: targetIndex === null ? ratio : panelRatio,
      });
      if (!response?.file_url) throw new Error('No adjusted image was returned.');
      if (!alive.current) return;
      setCandidate({ url: response.file_url, fingerprint, target, instruction: instruction.trim(), reference });
    } catch (failure) { if (alive.current) setError(failure.message || 'Image adjustment failed.'); }
    finally { pending.current = false; setBusy(''); }
  };

  const apply = async (restore = false) => {
    if (pending.current || busy || (!restore && !candidate)) return;
    pending.current = true; setError(''); setBusy(`${segment.id}-adjust-save`);
    try {
      const fingerprint = restore ? adjustmentFingerprint(segment, ratio) : candidate.fingerprint;
      if (adjustmentFingerprint(latest.current.segment, latest.current.ratio) !== fingerprint) throw new Error('The image or its settings changed. Close this window and adjust the current image.');
      await latest.current.onApply({ ...(candidate || {}), target, restore, fingerprint });
      if (alive.current) { setTargetIndex(undefined); setCandidate(null); }
    } catch (failure) { if (alive.current) setError(failure.message || 'Unable to save the adjustment. Your candidate is still available here.'); }
    finally { pending.current = false; setBusy(''); }
  };

  const applyManualUpload = async (uploadedUrl, uploadTarget) => {
    if (pending.current) return;
    pending.current = true; setError(''); setBusy(`${segment.id}-adjust-save`);
    try {
      const fingerprint = adjustmentFingerprint(latest.current.segment, latest.current.ratio);
      if (adjustmentFingerprint(segment, ratio) !== fingerprint) throw new Error('The image or its settings changed. Close this window and adjust the current image.');
      await latest.current.onApply({ url: uploadedUrl, target: uploadTarget, instruction: 'Manual upload replacement', reference: '', restore: false, fingerprint });
    } catch (failure) { if (alive.current) setError(failure.message || 'Unable to save the uploaded image. The original image was kept.'); throw failure; }
    finally { pending.current = false; setBusy(''); }
  };

  const panels = segment.visual_format === 'comic' ? (segment.comic_panels || []).slice(0, segment.comic_panel_count || 3) : [];
  if (!segment.image_url && !panels.some((panel) => panel.image_url)) return null;

  if (target) return <section className="bg-[#111418] text-white" aria-labelledby="adjust-image-title">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/10 bg-[#111418] px-4 py-3">
      <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#23c7be]">FotoPlay tool</p><h3 id="adjust-image-title" className="mt-1 truncate text-lg font-black">{targetIndex === null ? 'Adjust image' : `Adjust panel ${targetIndex + 1}`}</h3></div>
      <button type="button" onClick={close} disabled={Boolean(busy)} className={`${button} shrink-0 bg-[#1c2025] text-white hover:border-[#23c7be]`}>Back</button>
    </div>
    <div className="space-y-4 p-4">
      <figure>
        <figcaption className="mb-2 text-xs font-semibold text-white/65">Current image</figcaption>
        <div className="flex max-h-[260px] min-h-[180px] w-full items-center justify-center overflow-hidden border border-white/10 bg-black"><img src={target.url} alt="Current image before adjustment" className="max-h-[260px] max-w-full object-contain" /></div>
        <StoryImageFileActions url={target.url} userEmail={userEmail} name={`${imageName} - Current image`} ratio={targetIndex === null ? ratio : panelRatio} onUploaded={(uploadedUrl) => applyManualUpload(uploadedUrl, target)} />
      </figure>

      {candidate && <figure>
        <figcaption className="mb-2 text-xs font-black text-[#23c7be]">Adjusted candidate · not yet applied</figcaption>
        <div className="flex max-h-[260px] min-h-[180px] w-full items-center justify-center overflow-hidden border border-[#23c7be]/45 bg-black"><img src={candidate.url} alt="Adjusted candidate" className="max-h-[260px] max-w-full object-contain" /></div>
        <StoryImageFileActions url={candidate.url} userEmail={userEmail} name={`${imageName} - Adjusted image`} ratio={targetIndex === null ? ratio : panelRatio} />
        <a href={candidate.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#23c7be] underline">Open candidate</a>
      </figure>}

      <div>
        <label htmlFor="image-adjustment-instruction" className="text-xs font-black uppercase tracking-[.08em] text-white/75">What should change?</label>
        <textarea autoFocus id="image-adjustment-instruction" disabled={Boolean(busy)} value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={4} maxLength={4000} placeholder="Add her black hat. Keep everything else exactly the same." className="mt-2 w-full resize-y border border-white/15 bg-[#20242a] p-3 text-sm text-white placeholder:text-white/35 focus:border-[#23c7be] focus:outline-none" />
      </div>

      {referenceImages.length > 0 && <div><p className="text-xs text-white/55">Optional detail reference</p><div className="mt-2 flex gap-2 overflow-x-auto pb-1"><button type="button" disabled={Boolean(busy)} onClick={() => setReference('')} className={`${button} shrink-0 ${!reference ? 'border-[#23c7be] bg-[#23c7be] text-black' : 'bg-[#1c2025] text-white hover:border-[#23c7be]'}`}>None</button>{referenceImages.filter((url) => url !== target.url).map((url, index) => <button type="button" key={url} disabled={Boolean(busy)} aria-label={`Use detail reference ${index + 1}`} aria-pressed={reference === url} onClick={() => setReference(url)} className={`shrink-0 border-2 ${reference === url ? 'border-[#23c7be]' : 'border-white/10'}`}><img src={url} alt={`Detail reference ${index + 1}`} className="h-16 w-20 object-contain" /></button>)}</div></div>}

      <p className="text-[11px] leading-relaxed text-white/45">Each generated candidate uses {price ?? 'the configured image-generation price'}{price != null ? ' credits' : ''}. Accepting or restoring does not generate another image.</p>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      <div className="grid gap-2"><button type="button" disabled={Boolean(busy) || !instruction.trim()} onClick={generate} className={`${button} w-full border-[#23c7be] bg-[#23c7be] text-black hover:bg-[#39d7ce]`}>{busy === `${segment.id}-adjust` ? 'Generating adjustment…' : 'Generate adjustment'}</button>{candidate && <><button type="button" disabled={Boolean(busy)} onClick={() => apply()} className={`${button} w-full border-white/15 bg-white text-black hover:bg-white/90`}>Accept this image</button><button type="button" disabled={Boolean(busy)} onClick={() => setCandidate(null)} className={`${button} w-full bg-[#1c2025] text-white hover:border-[#23c7be]`}>Discard candidate</button></>}{original && <button type="button" disabled={Boolean(busy)} onClick={() => apply(true)} className={`${button} w-full bg-[#1c2025] text-white hover:border-[#23c7be]`}>Restore original</button>}</div>
    </div>
  </section>;

  return <section className="border border-white/10 bg-[#111418] p-4 text-white">
    <h4 className="font-black text-[#23c7be]">Adjust an existing image</h4>
    <p className="mt-1 text-xs text-white/55">Choose an image, describe a correction, then review it before replacing the original.</p>
    <div className="mt-3 flex flex-wrap gap-3">
      {segment.visual_format !== 'comic' && segment.image_url && <button type="button" disabled={Boolean(busy)} onClick={() => open(null)} className={`${button} border-[#23c7be] bg-[#23c7be] text-black hover:bg-[#39d7ce]`}>Adjust image</button>}
      {panels.map((panel, index) => panel.image_url && <button key={panel.id || index} type="button" disabled={Boolean(busy)} onClick={() => open(index)} className={`${button} flex items-center gap-3 bg-[#1c2025] text-white hover:border-[#23c7be]`}><img src={panel.image_url} alt="" className="h-14 w-20 object-cover object-center" />Adjust panel {index + 1}</button>)}
    </div>
  </section>;
}
