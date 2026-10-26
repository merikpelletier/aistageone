from pathlib import Path
p=Path('src/components/studio/StudioAudioTool.jsx')
t=p.read_text()
old="const [duration, setDuration] = useState(3);"
if old not in t: raise SystemExit('duration state not found')
t=t.replace(old, "const [duration, setDuration] = useState(tool === 'music' ? 30 : 3);",1)
old="? { prompt, lyrics: mode === 'lyrics' ? lyrics : '', is_instrumental: mode === 'instrumental', lyrics_optimizer: mode === 'auto', audio_format: format }"
new="? { prompt, lyrics: mode === 'lyrics' ? lyrics : '', is_instrumental: mode === 'instrumental', lyrics_optimizer: mode === 'auto', audio_format: format, duration, music_length_ms: duration * 1000 }"
if old not in t: raise SystemExit('pricing input not found')
t=t.replace(old,new,1)
old="""      {tool === 'music' ? (\n        <label className=\"block\">Music type\n          <select className={field + ' bg-black'} value={mode} onChange={e => setMode(e.target.value)} disabled={busy}>\n            <option className=\"bg-black\" value=\"instrumental\">Instrumental</option>\n            <option className=\"bg-black\" value=\"lyrics\">Song — my lyrics</option>\n            <option className=\"bg-black\" value=\"auto\">Song — generate lyrics</option>\n          </select>\n        </label>\n      ) : (\n"""
new="""      {tool === 'music' ? (\n        <>\n          <label className=\"block\">Music type\n            <select className={field + ' bg-black'} value={mode} onChange={e => setMode(e.target.value)} disabled={busy}>\n              <option className=\"bg-black\" value=\"instrumental\">Instrumental</option>\n              <option className=\"bg-black\" value=\"lyrics\">Song — my lyrics</option>\n              <option className=\"bg-black\" value=\"auto\">Song — generate lyrics</option>\n            </select>\n          </label>\n          <label className=\"block\">Duration\n            <div className=\"flex items-center gap-3\">\n              <input className={field} type=\"number\" min=\"5\" max=\"300\" step=\"1\" value={duration} onChange={e => setDuration(e.target.value === '' ? '' : Number(e.target.value))} disabled={busy} />\n              <span className=\"whitespace-nowrap text-white/70\">seconds</span>\n            </div>\n            <span className=\"text-xs text-white/45\">5–300 seconds</span>\n          </label>\n        </>\n      ) : (\n"""
if old not in t: raise SystemExit('UI block not found')
p.write_text(t.replace(old,new,1))

p=Path('supabase/functions/_shared/studioAudioInput.js')
t=p.read_text()
old="""  if (body.mode !== 'lyrics' && !prompt) bad('Describe the music');\n  return {\n    prompt, lyrics: body.mode === 'lyrics' ? lyrics : '',\n    is_instrumental: body.mode === 'instrumental',\n    lyrics_optimizer: body.mode === 'auto',\n    audio_format: format,\n  };\n"""
new="""  if (body.mode !== 'lyrics' && !prompt) bad('Describe the music');\n  const duration = Number(body.duration ?? 30);\n  if (!Number.isFinite(duration) || duration < 5 || duration > 300) bad('Duration must be between 5 and 300 seconds');\n  return {\n    prompt, lyrics: body.mode === 'lyrics' ? lyrics : '',\n    is_instrumental: body.mode === 'instrumental',\n    lyrics_optimizer: body.mode === 'auto',\n    audio_format: format, duration, music_length_ms: Math.round(duration * 1000),\n  };\n"""
if old not in t: raise SystemExit('audioInput block not found')
p.write_text(t.replace(old,new,1))

p=Path('supabase/functions/_shared/studioAudio.ts')
t=p.read_text()
old="""    validateChoice(choice, model);\n    adaptInput(input, choice, model);\n\n    const dynamicQuote = await quoteAiService(\n"""
new="""    validateChoice(choice, model);\n    const providerInput = tool === 'music' ? adaptInput(input, choice, model) : input;\n\n    const dynamicQuote = await quoteAiService(\n"""
if old not in t: raise SystemExit('adapt block not found')
t=t.replace(old,new,1)
old2="""      const response = await fetch(`${API}/models/${AUDIO_TOOLS[tool].model}/predictions`, {\n        method: 'POST', headers: providerHeaders, signal: AbortSignal.timeout(25000),\n        body: JSON.stringify({ input, webhook: webhook.href, webhook_events_filter: ['completed'] }),\n      });\n"""
new2="""      const providerModel = tool === 'music' ? selectedModelKey : AUDIO_TOOLS[tool].model;\n      const response = await fetch(`${API}/models/${providerModel}/predictions`, {\n        method: 'POST', headers: providerHeaders, signal: AbortSignal.timeout(25000),\n        body: JSON.stringify({ input: providerInput, webhook: webhook.href, webhook_events_filter: ['completed'] }),\n      });\n"""
if old2 not in t: raise SystemExit('provider block not found')
p.write_text(t.replace(old2,new2,1))
