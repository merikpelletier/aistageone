from pathlib import Path

path = Path('src/components/studio/VideoTools.jsx')
text = path.read_text()
scene = '''            <section className="border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-xs font-black uppercase tracking-[0.15em] text-[#23c7be]">Scene</p><textarea value={sceneText} onChange={(event) => setSceneText(event.target.value)} className="min-h-[260px] w-full bg-black/30 p-4 text-sm leading-6" placeholder="Keep the complete scene here as your source. You build the shots yourself in Cuts." /></section>\n'''
ai = '''            <section className="border border-white/10 bg-[#17191d] p-4"><p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/50">Video model</p><select value={effectiveModel || ''} onChange={(event) => setSelectedModel(event.target.value || null)} disabled={modelsLoading || !modelOptions.length} className="w-full border border-white/10 bg-black/30 p-3 text-sm text-white">{modelsLoading && <option>Loading models…</option>}{modelOptions.map((item) => <option key={item.model_key} value={item.model_key}>{item.name || item.model_key}{item.recommended ? ' — Recommended' : ''}</option>)}</select><DynamicAiModelControls model={effectiveModelOption} values={modelParams} inheritedValues={{ duration: activeShot?.duration, aspect_ratio: aspectRatio, prompt: modelDiscoveryInput.prompt, reference_images: modelDiscoveryInput.reference_images.slice(0, modelReferenceMax) }} onChange={updateModelParam} /></section>\n'''
if text.count(scene) != 1 or text.count(ai) != 1:
    raise SystemExit('Expected Setup blocks not found exactly once')
text = text.replace(scene + ai, ai.replace('>Video model<', '>AI Video<') + scene, 1)
path.write_text(text)
