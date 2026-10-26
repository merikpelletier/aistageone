from pathlib import Path
p = Path('supabase/functions/_shared/studioAudio.ts')
t = p.read_text()
old1 = "    adaptInput(input, choice, model);"
new1 = "    const providerInput = adaptInput(input, choice, model);"
old2 = "      const response = await fetch(`${API}/models/${AUDIO_TOOLS[tool].model}/predictions`, {\n        method: 'POST', headers: providerHeaders, signal: AbortSignal.timeout(25000),\n        body: JSON.stringify({ input, webhook: webhook.href, webhook_events_filter: ['completed'] }),\n      });"
new2 = "      const response = await fetch(`${API}/models/${selectedModelKey}/predictions`, {\n        method: 'POST', headers: providerHeaders, signal: AbortSignal.timeout(25000),\n        body: JSON.stringify({ input: providerInput, webhook: webhook.href, webhook_events_filter: ['completed'] }),\n      });"
for i,(old,new) in enumerate(((old1,new1),(old2,new2)),1):
    if t.count(old) != 1:
        raise SystemExit(f'Target {i}: expected exactly one match, found {t.count(old)}')
    t = t.replace(old,new,1)
p.write_text(t)
