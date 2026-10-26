from pathlib import Path
p=Path('src/components/studio/VideoTools.jsx')
t=p.read_text()
t=t.replace("const [editMusic, setEditMusic] = useState({ url: '', name: '', volume: 0.55 });","const [editMusic, setEditMusic] = useState({ url: '', name: '', volume: 0.55, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 });",1)
t=t.replace("setEditMusic({ url: '', name: '', volume: 0.55 });","setEditMusic({ url: '', name: '', volume: 0.55, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 });",1)
t=t.replace("setEditMusic(shotPlan[0]?.editor_music || { url: '', name: '', volume: 0.55 });","setEditMusic({ url: '', name: '', volume: 0.55, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0, ...(shotPlan[0]?.editor_music || {}) });",1)
t=t.replace("if (target.type === 'music') setEditMusic((value) => ({ ...value, url, name: name || 'Vault music' }));","if (target.type === 'music') setEditMusic((value) => ({ ...value, url, name: name || 'Vault music', start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 }));",1)
t=t.replace("setEditMusic((value) => ({ ...value, url: data.publicUrl, name: file.name }));","setEditMusic((value) => ({ ...value, url: data.publicUrl, name: file.name, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 }));",1)
old="""      if (editMusic.url) {
        musicElement = document.createElement('audio');
        musicElement.crossOrigin = 'anonymous';
        musicElement.src = editMusic.url;
        musicElement.loop = true;
        musicElement.preload = 'auto';
        const musicSource = audioContext.createMediaElementSource(musicElement);
        const musicGain = audioContext.createGain();
        musicGain.gain.value = Math.max(0, Math.min(1, Number(editMusic.volume || 0)));
        musicSource.connect(musicGain).connect(audioDestination);
        await musicElement.play();
      }
"""
new="""      let musicGain = null;
      let musicStartTimer = null;
      if (editMusic.url) {
        musicElement = document.createElement('audio');
        musicElement.crossOrigin = 'anonymous';
        musicElement.src = editMusic.url;
        musicElement.loop = Boolean(editMusic.loop);
        musicElement.preload = 'auto';
        await new Promise((resolve, reject) => {
          const ready = () => { cleanup(); resolve(); };
          const failed = () => { cleanup(); reject(new Error('Music track could not be loaded for export.')); };
          const cleanup = () => { musicElement.removeEventListener('loadedmetadata', ready); musicElement.removeEventListener('error', failed); };
          musicElement.addEventListener('loadedmetadata', ready);
          musicElement.addEventListener('error', failed);
          musicElement.load();
        });
        const musicSource = audioContext.createMediaElementSource(musicElement);
        musicGain = audioContext.createGain();
        musicGain.gain.value = 0;
        musicSource.connect(musicGain).connect(audioDestination);
        const trimStart = Math.max(0, Number(editMusic.trim_start || 0));
        const trimEnd = Math.max(trimStart, Math.min(Number(editMusic.trim_end || musicElement.duration || 0), Number(musicElement.duration || 0)));
        musicElement.currentTime = trimStart;
        const trackStart = Math.max(0, Number(editMusic.start || 0));
        const trackLength = Math.max(0, Math.min(editTimelineDuration - trackStart, editMusic.loop ? editTimelineDuration - trackStart : trimEnd - trimStart));
        const baseVolume = Math.max(0, Math.min(1, Number(editMusic.volume || 0)));
        const fadeIn = Math.max(0, Math.min(Number(editMusic.fade_in || 0), trackLength));
        const fadeOut = Math.max(0, Math.min(Number(editMusic.fade_out || 0), trackLength));
        const startMusic = async () => {
          const now = audioContext.currentTime;
          musicGain.gain.cancelScheduledValues(now);
          musicGain.gain.setValueAtTime(fadeIn > 0 ? 0 : baseVolume, now);
          if (fadeIn > 0) musicGain.gain.linearRampToValueAtTime(baseVolume, now + fadeIn);
          if (fadeOut > 0) {
            const fadeOutAt = Math.max(now, now + trackLength - fadeOut);
            musicGain.gain.setValueAtTime(baseVolume, fadeOutAt);
            musicGain.gain.linearRampToValueAtTime(0, now + trackLength);
          }
          await musicElement.play();
          if (!editMusic.loop && trackLength > 0) setTimeout(() => musicElement.pause(), trackLength * 1000);
        };
        if (trackLength > 0) {
          if (trackStart > 0) musicStartTimer = setTimeout(() => { void startMusic(); }, trackStart * 1000);
          else await startMusic();
        }
      }
"""
if old not in t: raise SystemExit('export music block not found')
t=t.replace(old,new,1)
t=t.replace("      if (musicElement) musicElement.pause();","      if (musicElement) musicElement.pause();\n      if (musicStartTimer) clearTimeout(musicStartTimer);",1)
t=t.replace("      try { musicElement?.pause(); } catch {}","      try { musicElement?.pause(); } catch {}\n      try { if (musicStartTimer) clearTimeout(musicStartTimer); } catch {}",1)
old='<audio src={editMusic.url} controls className="mt-3 w-full" />'
new='<audio src={editMusic.url} controls className="mt-3 w-full" onLoadedMetadata={(event) => { const duration = Number(event.currentTarget.duration || 0); setEditMusic((value) => ({ ...value, duration, trim_end: value.trim_end > 0 ? Math.min(value.trim_end, duration) : duration })); }} />'
if old not in t: raise SystemExit('audio preview block not found')
t=t.replace(old,new,1)
t=t.replace("setEditMusic({ url: '', name: '', volume: 0.55 })","setEditMusic({ url: '', name: '', volume: 0.55, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 })",1)
anchor='''            <section className="border border-white/10 bg-[#17191d] p-4"><div className="grid gap-3 md:grid-cols-[1fr_220px]"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#23c7be]">Music track</p>'''
idx=t.find(anchor)
if idx<0: raise SystemExit('music section anchor not found')
end=t.find('</section>', idx)+10
insert='''
            {editMusic.url && <section className="border border-white/10 bg-[#17191d] p-4"><div className="mb-2 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#23c7be]">Music timeline</p><p className="text-[10px] text-white/35">Visible audio track aligned to the scene timeline.</p></div><span className="text-[10px] text-white/45">{Number(editMusic.start || 0).toFixed(2)}s → {Math.min(editTimelineDuration, Number(editMusic.start || 0) + Math.max(0, (editMusic.loop ? editTimelineDuration : Number(editMusic.trim_end || editMusic.duration || 0) - Number(editMusic.trim_start || 0)))).toFixed(2)}s</span></div><div className="overflow-x-auto border border-white/10 bg-black/30"><div className="relative h-16" style={{ width: `${editTimelineWidth}px`, minWidth: '100%' }}><div className="absolute inset-y-2 border border-[#23c7be]/50 bg-[#23c7be]/15 px-2 py-1" style={{ left: `${Math.max(0, Number(editMusic.start || 0)) * editTimelinePixelsPerSecond}px`, width: `${Math.max(8, Math.min(Math.max(0, editTimelineDuration - Number(editMusic.start || 0)), editMusic.loop ? Math.max(0, editTimelineDuration - Number(editMusic.start || 0)) : Math.max(0, Number(editMusic.trim_end || editMusic.duration || 0) - Number(editMusic.trim_start || 0))) * editTimelinePixelsPerSecond)}px` }}><p className="truncate text-[10px] font-black text-[#8ee9e4]">♫ {editMusic.name || 'Music'}</p><p className="text-[8px] text-white/50">{editMusic.loop ? 'Loop' : 'Single play'}</p></div><div className="pointer-events-none absolute bottom-0 top-0 z-40 w-[2px] bg-[#23c7be]" style={{ left: `${editPlayhead * editTimelinePixelsPerSecond}px` }} /></div></div><div className="mt-3 grid gap-2 md:grid-cols-3"><label className="text-[10px] text-white/45">Start on timeline<input type="number" min="0" max={Math.max(0, editTimelineDuration)} step="0.05" value={editMusic.start || 0} onChange={(event) => setEditMusic((value) => ({ ...value, start: Math.max(0, Math.min(editTimelineDuration, Number(event.target.value) || 0)) }))} className="mt-1 w-full bg-black/30 p-2 text-xs text-white" /></label><label className="text-[10px] text-white/45">Trim start<input type="number" min="0" max={Math.max(0, Number(editMusic.trim_end || editMusic.duration || 0))} step="0.05" value={editMusic.trim_start || 0} onChange={(event) => setEditMusic((value) => ({ ...value, trim_start: Math.max(0, Math.min(Number(event.target.value) || 0, Number(value.trim_end || value.duration || 0))) }))} className="mt-1 w-full bg-black/30 p-2 text-xs text-white" /></label><label className="text-[10px] text-white/45">Trim end<input type="number" min={Number(editMusic.trim_start || 0)} max={Math.max(0, Number(editMusic.duration || 0))} step="0.05" value={editMusic.trim_end || 0} onChange={(event) => setEditMusic((value) => ({ ...value, trim_end: Math.max(Number(value.trim_start || 0), Math.min(Number(event.target.value) || 0, Number(value.duration || 0))) }))} className="mt-1 w-full bg-black/30 p-2 text-xs text-white" /></label><label className="text-[10px] text-white/45">Fade in<input type="number" min="0" step="0.1" value={editMusic.fade_in || 0} onChange={(event) => setEditMusic((value) => ({ ...value, fade_in: Math.max(0, Number(event.target.value) || 0) }))} className="mt-1 w-full bg-black/30 p-2 text-xs text-white" /></label><label className="text-[10px] text-white/45">Fade out<input type="number" min="0" step="0.1" value={editMusic.fade_out || 0} onChange={(event) => setEditMusic((value) => ({ ...value, fade_out: Math.max(0, Number(event.target.value) || 0) }))} className="mt-1 w-full bg-black/30 p-2 text-xs text-white" /></label><button type="button" onClick={() => setEditMusic((value) => ({ ...value, loop: !value.loop }))} className={`self-end border p-2 text-xs font-bold ${editMusic.loop ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 text-white/60'}`}>{editMusic.loop ? 'Loop on' : 'Loop off'}</button></div></section>}
'''
t=t[:end]+insert+t[end:]
p.write_text(t)
