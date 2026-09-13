const imageFields = ['image_url', 'image_source_instruction', 'image_source_aspect_ratio', 'text_overlay_source_url', 'text_overlay_applied_signature', 'comic_page_source'];

export function adjustmentFingerprint(segment, ratio) {
  return JSON.stringify({ ratio, images: imageFields.map((key) => segment[key] || ''), panels: segment.comic_panels || [], boxes: segment.text_boxes || [], format: segment.visual_format, instruction: segment.image_instruction });
}

export function adjustmentTarget(segment, panelIndex = null) {
  if (panelIndex !== null) {
    const panel = segment.comic_panels?.[panelIndex];
    if (!panel?.image_url) throw new Error('This panel has no image to adjust.');
    return { key: `panel:${panel.id || panelIndex}`, url: panel.image_url, snapshot: { image_url: panel.image_url, source_prompt: panel.source_prompt || '' }, panelIndex };
  }
  if (!segment.image_url) throw new Error('Generate an image first.');
  return { key: 'single', url: segment.text_overlay_source_url || segment.image_url, snapshot: Object.fromEntries(imageFields.map((key) => [key, segment[key] || ''])), panelIndex: null };
}

export function adjustmentPrompt(instruction, hasReference) {
  if (!instruction.trim()) throw new Error('Describe the adjustment first.');
  return `Edit the FIRST supplied image itself. It is the original image to modify, not a style or composition reference. Make only the following requested adjustment: ${instruction.trim()}\nPreserve all other content, character identities, poses, camera, framing, image dimensions, lighting, background, clothing, objects, colors and photographic style. Do not recreate or reinterpret the scene. Do not add text or borders.${hasReference ? '\nThe SECOND image is a detail reference only (for example a hat or costume). Use only the requested detail from it; never copy its composition or replace the first image.' : ''}`;
}

export function adjustmentRecord(segment, target, resultUrl, instruction, referenceUrl = '') {
  const previous = segment.image_adjustments?.[target.key];
  return {
    ...(segment.image_adjustments || {}),
    [target.key]: {
      original: previous?.original || { ...target.snapshot, source_url: target.url },
      history: [...(previous?.history || []), { source_url: target.url, result_url: resultUrl, instruction, reference_url: referenceUrl, accepted_at: new Date().toISOString() }].slice(-20),
    },
  };
}
