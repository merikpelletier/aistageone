import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { adjustmentFingerprint, adjustmentPrompt, adjustmentTarget } from './storyImageAdjustment.js';

import StoryImageFileActions from './StoryImageFileActions.jsx';

const button = 'rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-40';

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
  return <section className="rounded-2xl border border-yellow-400/30 bg-black p-4 text-white">
    <h4 className="font-black text-yellow-400">Adjust an existing image</h4>
    <p className="mt-1 text-xs text-white/60">Choose an image, describe a correction, then review it before replacing the original.</p>
    <div className="mt-3 flex flex-wrap gap-3">
      {segment.visual_format !== 'comic' && segment.image_url && <button type="button" disabled={Boolean(busy)} onClick={() => open(null)} className={`${button} bg-yellow-400 text-black`}>Adjust image</button>}
      {panels.map((panel, index) => panel.image_url && <button key={panel.id || index} type="button" disabled={Boolean(busy)} onClick={() => open(index)} className={`${button} flex items-center gap-3 bg-white/10`}><img src={panel.image_url} alt="" className="h-14 w-20 object-cover object-center" />Adjust panel {index + 1}</button>)}
    </div>
    {target && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3" role="dialog" aria-modal="true" aria-labelledby="adjust-image-title">
      <div className="max-h-[95vh] w-full max-w-6xl overflow-auto rounded-2xl border border-white/20 bg-neutral-950 p-5">
        <div className="flex items-center justify-between gap-3"><h3 id="adjust-image-title" className="text-xl font-black">{targetIndex === null ? 'Adjust image' : `Adjust panel ${targetIndex + 1}`}</h3><button type="button" onClick={close} disabled={Boolean(busy)} className={`${button} bg-white/10`}>Close</button></div>
        <div className="my-4 grid gap-4 md:grid-cols-2"><figure><figcaption className="mb-2 text-sm">Current image — shown proportionally; this exact framed area is what will appear in the final StoryBlock</figcaption><div className="relative isolate flex h-[48vh] w-full items-center justify-center overflow-hidden rounded-lg bg-black"><img src={target.url} alt="Current image before adjustment" className="max-h-full max-w-full object-contain" /></div><StoryImageFileActions url={target.url} userEmail={userEmail} name={`${imageName} - Current image`} ratio={targetIndex === null ? ratio : panelRatio} onUploaded={(uploadedUrl) => applyManualUpload(uploadedUrl, target)} /></figure>{candidate && <figure><figcaption className="mb-2 text-sm text-yellow-400">Adjusted candidate · not yet applied — shown proportionally; this exact framed area is what will appear in the final StoryBlock</figcaption><div className="relative isolate flex h-[48vh] w-full items-center justify-center overflow-hidden rounded-lg bg-black"><img src={candidate.url} alt="Adjusted candidate" className="max-h-full max-w-full object-contain" /></div><StoryImageFileActions url={candidate.url} userEmail={userEmail} name={`${imageName} - Adjusted image`} ratio={targetIndex === null ? ratio : panelRatio} /><a href={candidate.url} target="_blank" rel="noreferrer" className="text-xs underline">Open candidate</a></figure>}</div>
        <label htmlFor="image-adjustment-instruction" className="text-sm font-bold">What should change?</label>
        <textarea autoFocus id="image-adjustment-instruction" disabled={Boolean(busy)} value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={3} maxLength={4000} placeholder="Add her black hat. Keep everything else exactly the same." className="mt-2 w-full rounded-xl bg-white p-3 text-black" />
        {referenceImages.length > 0 && <div className="mt-3"><p className="text-xs text-white/60">Optional detail reference — choose the image showing the correct hat, costume or object.</p><div className="mt-2 flex gap-2 overflow-x-auto"><button type="button" disabled={Boolean(busy)} onClick={() => setReference('')} className={`${button} ${!reference ? 'bg-yellow-400 text-black' : 'bg-white/10'}`}>None</button>{referenceImages.filter((url) => url !== target.url).map((url, index) => <button type="button" key={url} disabled={Boolean(busy)} aria-label={`Use detail reference ${index + 1}`} aria-pressed={reference === url} onClick={() => setReference(url)} className={`shrink-0 rounded-lg border-2 ${reference === url ? 'border-yellow-400' : 'border-transparent'}`}><img src={url} alt={`Detail reference ${index + 1}`} className="h-20 w-24 object-contain" /></button>)}</div></div>}
        <p className="mt-3 text-xs text-white/55">Each generated candidate uses {price ?? 'the configured image-generation price'}{price != null ? ' credits' : ''}. Accepting or restoring does not generate another image. Review the result: AI editing can also alter details you wanted to keep.</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={Boolean(busy) || !instruction.trim()} onClick={generate} className={`${button} bg-yellow-400 text-black`}>{busy === `${segment.id}-adjust` ? 'Generating adjustment…' : 'Generate adjustment'}</button>{candidate && <><button type="button" disabled={Boolean(busy)} onClick={() => apply()} className={`${button} bg-green-400 text-black`}>Accept this image</button><button type="button" disabled={Boolean(busy)} onClick={() => setCandidate(null)} className={`${button} bg-white/10`}>Discard candidate</button></>}{original && <button type="button" disabled={Boolean(busy)} onClick={() => apply(true)} className={`${button} bg-white/10`}>Restore original</button>}</div>
      </div>
    </div>}
  </section>;
}
