from pathlib import Path

p = Path('src/components/studio/VideoTools.jsx')
s = p.read_text()

def replace_once(old, new, label):
    global s
    count = s.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {count}')
    s = s.replace(old, new, 1)

replace_once(
    "import ShootTimelineEngine from '@/components/studio/ShootTimelineEngine';\n",
    "import ShootTimelineEngine from '@/components/studio/ShootTimelineEngine';\nimport DynamicAiModelControls, { buildModelToolInput, getMappedModelField } from '@/components/studio/DynamicAiModelControls';\n",
    'import',
)

replace_once(
    "  const [selectedModel, setSelectedModel] = useState(null);\n",
    "  const [selectedModel, setSelectedModel] = useState(null);\n  const [modelParamsByKey, setModelParamsByKey] = useState({});\n",
    'state',
)

replace_once("""  const quoteService = 'generateVideo:video';
  const pricingInput = useMemo(() => ({
    duration: Math.max(3, Math.min(15, Number(activeShot?.duration || 5))),
    mode: 'pro',
    aspect_ratio: aspectRatio,
    prompt: activeShot ? `${activeShot.framing || 'Medium shot'}. ${activeShot.description || ''} ${shotDialogueText(activeShot)}`.trim() : '',
    reference_images: activeShot ? [setReference.url, ...shotCast(activeShot).map((member) => member.reference_url), ...(activeShot.shot_references || []).map((ref) => ref.url)].filter(Boolean).slice(0, 7) : [setReference.url].filter(Boolean),
    generate_audio: true,
  }), [activeShot, aspectRatio, cast, setReference.url]);

  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: quoteService, kind: 'video', input: pricingInput });
  const effectiveModel = selectedModel || modelOptions.find((item) => item.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote } = useAiPriceQuote({ service: quoteService, kind: 'video', input: pricingInput, modelKey: effectiveModel });
""", """  const quoteService = 'generateVideo:video';
  const modelDiscoveryInput = useMemo(() => ({
    duration: Number(activeShot?.duration || 5),
    aspect_ratio: aspectRatio,
    prompt: activeShot ? `${activeShot.framing || 'Medium shot'}. ${activeShot.description || ''} ${shotDialogueText(activeShot)}`.trim() : '',
    reference_images: activeShot ? [setReference.url, ...shotCast(activeShot).map((member) => member.reference_url), ...(activeShot.shot_references || []).map((ref) => ref.url)].filter(Boolean) : [setReference.url].filter(Boolean),
  }), [activeShot, aspectRatio, cast, setReference.url]);
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({ service: quoteService, kind: 'video', input: modelDiscoveryInput });
  const effectiveModel = selectedModel || modelOptions.find((item) => item.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const effectiveModelOption = modelOptions.find((item) => item.model_key === effectiveModel) || null;
  const modelParams = effectiveModel ? (modelParamsByKey[effectiveModel] || {}) : {};
  const durationBinding = getMappedModelField(effectiveModelOption, 'duration');
  const durationField = durationBinding?.schema || {};
  const modelDurationMin = Number.isFinite(Number(durationField.minimum)) ? Number(durationField.minimum) : 3;
  const modelDurationMax = Number.isFinite(Number(durationField.maximum)) ? Number(durationField.maximum) : 15;
  const normalizeVideoDuration = (value) => Math.max(modelDurationMin, Math.min(modelDurationMax, Number(value) || modelDurationMin));
  const aspectBinding = getMappedModelField(effectiveModelOption, 'aspect_ratio');
  const modelAspectRatios = Array.isArray(aspectBinding?.schema?.enum) && aspectBinding.schema.enum.length ? aspectBinding.schema.enum.map(String) : RATIOS.map((ratio) => ratio.id);
  const referenceBinding = getMappedModelField(effectiveModelOption, 'reference_images');
  const modelReferenceMax = Number.isFinite(Number(referenceBinding?.schema?.maxItems)) ? Number(referenceBinding.schema.maxItems) : 7;
  const systemModelInput = useMemo(() => ({
    duration: normalizeVideoDuration(activeShot?.duration || 5),
    aspect_ratio: aspectRatio,
    prompt: modelDiscoveryInput.prompt,
    reference_images: modelDiscoveryInput.reference_images.slice(0, modelReferenceMax),
  }), [activeShot?.duration, aspectRatio, modelDiscoveryInput.prompt, modelDiscoveryInput.reference_images, modelDurationMin, modelDurationMax, modelReferenceMax]);
  const pricingInput = useMemo(() => buildModelToolInput(effectiveModelOption, modelParams, systemModelInput), [effectiveModelOption, modelParams, systemModelInput]);
  const { quote: priceQuote } = useAiPriceQuote({ service: quoteService, kind: 'video', input: pricingInput, modelKey: effectiveModel });
""", 'pricing')

replace_once(
    "  const updateBeat = (shotId, beatId, patch) => setShotPlan((items) => items.map((shot) => shot.id === shotId ? { ...shot, lines: (shot.lines || []).map((line) => line.id === beatId ? { ...line, ...patch } : line) } : shot));\n",
    "  const updateBeat = (shotId, beatId, patch) => setShotPlan((items) => items.map((shot) => shot.id === shotId ? { ...shot, lines: (shot.lines || []).map((line) => line.id === beatId ? { ...line, ...patch } : line) } : shot));\n  const updateModelParam = (name, value) => { if (!effectiveModel) return; setModelParamsByKey((current) => { const next = { ...(current[effectiveModel] || {}) }; if (value === undefined || value === null || value === '') delete next[name]; else next[name] = value; return { ...current, [effectiveModel]: next }; }); };\n",
    'updater',
)

replace_once(
    "        if (baseReferenceCount + currentRefs.length >= 7) return shot;\n",
    "        if (baseReferenceCount + currentRefs.length >= modelReferenceMax) return shot;\n",
    'reference add limit',
)

replace_once(
    "    return refs.slice(0, 7);\n",
    "    return refs.slice(0, modelReferenceMax);\n",
    'reference send limit',
)

replace_once("""      const startData = await invokeGenerateVideo({
        async_mode: true,
        prompt: finalPrompt,
        reference_image_urls: refs,
        duration: Math.max(3, Math.min(15, Number(shot.duration) || 5)),
        aspect_ratio: aspectRatio,
        resolution: '720p',
        generate_audio: true,
        engine: 'video',
        model_key: effectiveModel || undefined,
      }, { 'x-idempotency-key': crypto.randomUUID() });
""", """      const effectiveInput = buildModelToolInput(effectiveModelOption, modelParams, {
        duration: normalizeVideoDuration(shot.duration),
        aspect_ratio: aspectRatio,
        prompt: finalPrompt,
        reference_images: refs.slice(0, modelReferenceMax),
      });
      const startData = await invokeGenerateVideo({
        async_mode: true,
        prompt: finalPrompt,
        reference_image_urls: refs.slice(0, modelReferenceMax),
        duration: normalizeVideoDuration(shot.duration),
        aspect_ratio: aspectRatio,
        engine: 'video',
        model_key: effectiveModel || undefined,
        model_input: effectiveInput,
      }, { 'x-idempotency-key': crypto.randomUUID() });
""", 'generation payload')

replace_once(
    "<section className=\"grid gap-3 md:grid-cols-[1fr_300px]\"><input value={title} onChange={(event) => setTitle(event.target.value)} className=\"border border-white/10 bg-[#17191d] px-4 py-3 text-sm font-bold\" placeholder=\"Scene title\" /><div className=\"grid grid-cols-3 gap-2\">{RATIOS.map((ratio) => <button key={ratio.id} type=\"button\" onClick={() => setAspectRatio(ratio.id)} className={`border p-2 text-xs font-bold ${aspectRatio === ratio.id ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 text-white/55'}`}>{ratio.label}<br /><span className=\"font-black\">{ratio.id}</span></button>)}</div></section>",
    "<section className=\"grid gap-3 md:grid-cols-[1fr_300px]\"><input value={title} onChange={(event) => setTitle(event.target.value)} className=\"border border-white/10 bg-[#17191d] px-4 py-3 text-sm font-bold\" placeholder=\"Scene title\" /><div className=\"grid grid-cols-3 gap-2\">{modelAspectRatios.map((ratioId) => { const ratio = RATIOS.find((item) => item.id === ratioId); return <button key={ratioId} type=\"button\" onClick={() => setAspectRatio(ratioId)} className={`border p-2 text-xs font-bold ${aspectRatio === ratioId ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 text-white/55'}`}>{ratio?.label || ratioId}<br /><span className=\"font-black\">{ratioId}</span></button>; })}</div></section>",
    'ratio selector',
)

replace_once(
    "<section className=\"border border-white/10 bg-[#17191d] p-4\"><p className=\"mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50\">Video model</p><select value={effectiveModel || ''} onChange={(event) => setSelectedModel(event.target.value || null)} disabled={modelsLoading || !modelOptions.length} className=\"w-full border border-white/10 bg-black/30 p-3 text-sm text-white\">{modelsLoading && <option>Loading models…</option>}{modelOptions.map((item) => <option key={item.model_key} value={item.model_key}>{item.name || item.model_key}{item.recommended ? ' — Recommended' : ''}</option>)}</select></section>",
    "<section className=\"border border-white/10 bg-[#17191d] p-4\"><p className=\"mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50\">Video model</p><select value={effectiveModel || ''} onChange={(event) => setSelectedModel(event.target.value || null)} disabled={modelsLoading || !modelOptions.length} className=\"w-full border border-white/10 bg-black/30 p-3 text-sm text-white\">{modelsLoading && <option>Loading models…</option>}{modelOptions.map((item) => <option key={item.model_key} value={item.model_key}>{item.name || item.model_key}{item.recommended ? ' — Recommended' : ''}</option>)}</select><DynamicAiModelControls model={effectiveModelOption} values={modelParams} inheritedValues={{ duration: activeShot?.duration, aspect_ratio: aspectRatio, prompt: modelDiscoveryInput.prompt, reference_images: modelDiscoveryInput.reference_images.slice(0, modelReferenceMax) }} onChange={updateModelParam} /></section>",
    'model section',
)

replace_once(
    "<input type=\"number\" min=\"3\" max=\"15\" value={shot.duration} onChange={(event) => updateShot(shot.id, { duration: Math.max(3, Math.min(15, Number(event.target.value) || 3)) })} className=\"min-w-0 flex-1 bg-black/30 p-2 text-xs text-white\" /><button type=\"button\" onClick={() => updateShot(shot.id, { duration: fittedDuration(shotDialogueText(shot)) })} className=\"bg-white/10 px-2 text-[9px] font-bold\">Fit</button>",
    "<input type=\"number\" min={modelDurationMin} max={modelDurationMax} value={shot.duration} onChange={(event) => updateShot(shot.id, { duration: normalizeVideoDuration(event.target.value) })} className=\"min-w-0 flex-1 bg-black/30 p-2 text-xs text-white\" /><button type=\"button\" onClick={() => updateShot(shot.id, { duration: normalizeVideoDuration(Math.ceil(estimatedSpeechSeconds(shotDialogueText(shot)) + 1)) })} className=\"bg-white/10 px-2 text-[9px] font-bold\">Fit</button>",
    'duration control',
)

p.write_text(s)
