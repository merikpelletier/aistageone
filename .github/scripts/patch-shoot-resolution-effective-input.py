from pathlib import Path

path = Path('src/components/studio/VideoTools.jsx')
text = path.read_text()

old = """  const pricingModelParams = useMemo(() => {\n    if (!referenceVideoBinding) return modelParams;\n    return { ...modelParams, [referenceVideoBinding.name]: activeVideoReferenceUrls };\n  }, [modelParams, referenceVideoBinding?.name, activeVideoReferenceUrls.join('|')]);"""
new = """  const pricingModelParams = useMemo(() => {\n    const next = { ...modelParams };\n    if (resolutionBinding && resolutionValue) next[resolutionBinding.name] = resolutionValue;\n    if (audioBinding) next[audioBinding.name] = audioValue;\n    if (referenceVideoBinding) next[referenceVideoBinding.name] = activeVideoReferenceUrls;\n    return next;\n  }, [modelParams, resolutionBinding?.name, resolutionValue, audioBinding?.name, audioValue, referenceVideoBinding?.name, activeVideoReferenceUrls.join('|')]);"""
if text.count(old) != 1:
    raise SystemExit(f'pricing block match count: {text.count(old)}')
text = text.replace(old, new, 1)

old2 = """      const generationModelParams = referenceVideoBinding ? { ...modelParams, [referenceVideoBinding.name]: shotVideoUrls } : modelParams;"""
new2 = """      const generationModelParams = { ...modelParams };\n      if (resolutionBinding && resolutionValue) generationModelParams[resolutionBinding.name] = resolutionValue;\n      if (audioBinding) generationModelParams[audioBinding.name] = audioValue;\n      if (referenceVideoBinding) generationModelParams[referenceVideoBinding.name] = shotVideoUrls;"""
if text.count(old2) != 1:
    raise SystemExit(f'generation block match count: {text.count(old2)}')
text = text.replace(old2, new2, 1)

path.write_text(text)
