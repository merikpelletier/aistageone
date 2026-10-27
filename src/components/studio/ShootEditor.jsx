import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, Loader2, Music2, Pause, Play, Scissors, Trash2, Undo2, Upload, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import ShootTimelineEngine from '@/components/studio/ShootTimelineEngine';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const clipDuration = (clip) => Math.max(0.05, Number(clip?.trim_end || 0) - Number(clip?.trim_start || 0));

const timelineLocation = (clips, time) => {
  const safe = Math.max(0, Number(time || 0));
  let cursor = 0;
  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const duration = clipDuration(clip);
    const end = cursor + duration;
    if (safe < end || index === clips.length - 1) {
      return { clip, index, start: cursor, end, local: clamp(safe - cursor, 0, duration) };
    }
    cursor = end;
  }
  return null;
};

const clipStart = (clips, id) => {
  let cursor = 0;
  for (const clip of clips) {
    if (clip.id === id) return cursor;
    cursor += clipDuration(clip);
  }
  return 0;
};

const formatTime = (seconds) => {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const frames = Math.floor((safe - Math.floor(safe)) * 30);
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
};

export default function ShootEditor({
  clips,
  music,
  ratio,
  selectedClipId,
  playhead,
  playing,
  canUndo,
  exporting,
  onClipsChange,
  onMusicChange,
  onRatioChange,
  onSelectedClipChange,
  onPlayheadChange,
  onPlayingChange,
  onUndo,
  onSave,
  onExport,
  onMusicUpload,
  onMusicVault,
  onClipMetadata,
}) {
  const engineRef = useRef(null);
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);

  const duration = useMemo(() => clips.reduce((sum, clip) => sum + clipDuration(clip), 0), [clips]);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || clips[0] || null;
  const selectedIndex = selectedClip ? clips.findIndex((clip) => clip.id === selectedClip.id) : -1;
  const pxPerSecond = 72 * zoom;
  const trackWidth = Math.max(viewportWidth, Math.max(duration, 1) * pxPerSecond);
  const rulerStep = zoom >= 2 ? 0.5 : zoom <= 0.75 ? 2 : 1;
  const rulerMarks = Math.floor(duration / rulerStep) + 1;

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const update = () => setViewportWidth(node.clientWidth || 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target?.matches?.('input, textarea, select') || target?.isContentEditable) return;
      if (event.code === 'Space') {
        event.preventDefault();
        if (playing) engineRef.current?.pause();
        else void engineRef.current?.play(playhead);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        onUndo?.();
      }
      if (event.key === 'Delete' && selectedClip) {
        event.preventDefault();
        deleteSelectedClip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playing, playhead, selectedClipId, clips, canUndo]);

  const seek = (time, resume = playing) => {
    const safe = clamp(Number(time || 0), 0, Math.max(0, duration));
    const location = timelineLocation(clips, safe);
    if (location?.clip?.id) onSelectedClipChange?.(location.clip.id);
    onPlayheadChange?.(safe);
    void engineRef.current?.seek(safe, resume);
  };

  const selectClip = (clip) => {
    onSelectedClipChange?.(clip.id);
    seek(clipStart(clips, clip.id), false);
  };

  const updateClip = (id, patch) => {
    onClipsChange?.(clips.map((clip) => clip.id === id ? { ...clip, ...patch } : clip), true);
  };

  const deleteSelectedClip = () => {
    if (!selectedClip) return;
    const index = clips.findIndex((clip) => clip.id === selectedClip.id);
    const next = clips.filter((clip) => clip.id !== selectedClip.id);
    const nextSelection = next[Math.min(index, Math.max(0, next.length - 1))]?.id || null;
    onClipsChange?.(next, true);
    onSelectedClipChange?.(nextSelection);
    onPlayheadChange?.(Math.min(playhead, next.reduce((sum, clip) => sum + clipDuration(clip), 0)));
  };

  const splitAtPlayhead = () => {
    const location = timelineLocation(clips, playhead);
    if (!location?.clip) return;
    const clip = location.clip;
    const mediaTime = Number(clip.trim_start || 0) + location.local;
    if (mediaTime <= Number(clip.trim_start || 0) + 0.05 || mediaTime >= Number(clip.trim_end || 0) - 0.05) return;
    const left = { ...clip, id: crypto.randomUUID(), trim_end: mediaTime, label: `${clip.label} A` };
    const right = { ...clip, id: crypto.randomUUID(), trim_start: mediaTime, label: `${clip.label} B` };
    const next = [...clips.slice(0, location.index), left, right, ...clips.slice(location.index + 1)];
    onClipsChange?.(next, true);
    onSelectedClipChange?.(right.id);
  };

  const moveSelected = (direction) => {
    if (selectedIndex < 0) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= clips.length) return;
    const next = [...clips];
    [next[selectedIndex], next[target]] = [next[target], next[selectedIndex]];
    onClipsChange?.(next, true);
    const nextStart = clipStart(next, selectedClip.id);
    seek(nextStart, false);
  };

  const beginTrim = (event, type, clip) => {
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const original = { trim_start: Number(clip.trim_start || 0), trim_end: Number(clip.trim_end || 0) };
    dragRef.current = { type, clipId: clip.id, startX, original };
    const move = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) / pxPerSecond;
      let patch;
      if (type === 'clip-start') {
        patch = { trim_start: clamp(original.trim_start + delta, 0, original.trim_end - 0.05) };
      } else {
        const maxEnd = Math.max(original.trim_end, Number(clip.source_duration || original.trim_end));
        patch = { trim_end: clamp(original.trim_end + delta, original.trim_start + 0.05, maxEnd) };
      }
      onClipsChange?.(clips.map((item) => item.id === clip.id ? { ...item, ...patch } : item), false);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragRef.current = null;
      onClipsChange?.(null, true, true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const beginMusicMove = (event) => {
    if (!music.url) return;
    event.preventDefault();
    const startX = event.clientX;
    const originalStart = Number(music.start || 0);
    const move = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) / pxPerSecond;
      onMusicChange?.({ ...music, start: clamp(originalStart + delta, 0, Math.max(0, duration)) }, false);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onMusicChange?.(null, true, true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const beginMusicTrim = (event, side) => {
    if (!music.url) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const original = { start: Number(music.start || 0), trimStart: Number(music.trim_start || 0), trimEnd: Number(music.trim_end || music.duration || 0) };
    const move = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) / pxPerSecond;
      if (side === 'left') {
        const nextTrim = clamp(original.trimStart + delta, 0, original.trimEnd - 0.05);
        const timelineShift = nextTrim - original.trimStart;
        onMusicChange?.({ ...music, trim_start: nextTrim, start: clamp(original.start + timelineShift, 0, Math.max(0, duration)) }, false);
      } else {
        onMusicChange?.({ ...music, trim_end: clamp(original.trimEnd + delta, original.trimStart + 0.05, Number(music.duration || original.trimEnd)) }, false);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      onMusicChange?.(null, true, true);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const handleTrackPointer = (event) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    seek(x / pxPerSecond, playing);
  };

  const musicDuration = Math.max(0, Number(music.trim_end || music.duration || 0) - Number(music.trim_start || 0));
  const musicVisibleDuration = music.loop ? Math.max(0, duration - Number(music.start || 0)) : Math.min(musicDuration, Math.max(0, duration - Number(music.start || 0)));

  return (
    <div className="space-y-3">
      <section className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-[#17191d] p-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => playing ? engineRef.current?.pause() : void engineRef.current?.play(playhead)} disabled={!clips.length} className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.06] px-3 text-xs font-black disabled:opacity-30">{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}</button>
          <button type="button" onClick={splitAtPlayhead} disabled={!clips.length} className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.06] px-3 text-xs font-bold disabled:opacity-30"><Scissors size={14} /> Split</button>
          <button type="button" onClick={onUndo} disabled={!canUndo} className="flex h-9 items-center gap-2 border border-white/10 bg-white/[0.06] px-3 text-xs font-bold disabled:opacity-30"><Undo2 size={14} /> Undo</button>
          <span className="min-w-[84px] font-mono text-xs font-black text-[#8ee9e4]">{formatTime(playhead)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {['16:9', '9:16', '1:1'].map((value) => <button key={value} type="button" onClick={() => onRatioChange?.(value)} className={`h-8 border px-2 text-[10px] font-bold ${ratio === value ? 'border-[#23c7be] bg-[#23c7be]/10 text-[#8ee9e4]' : 'border-white/10 text-white/50'}`}>{value}</button>)}
          <button type="button" onClick={onSave} className="h-8 border border-white/10 bg-white/[0.06] px-3 text-[10px] font-bold">Save</button>
          <button type="button" onClick={onExport} disabled={exporting || !clips.length} className="h-8 bg-[#23c7be] px-3 text-[10px] font-black text-black disabled:opacity-40">{exporting ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : null}Export</button>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[1fr_300px]">
        <section className="border border-white/10 bg-black p-2">
          <div className={`mx-auto overflow-hidden bg-black ${ratio === '9:16' ? 'aspect-[9/16] max-h-[560px]' : ratio === '1:1' ? 'aspect-square max-h-[560px]' : 'aspect-video'}`}>
            {selectedClip ? <ShootTimelineEngine ref={engineRef} clips={clips} music={music} playhead={playhead} playing={playing} onPlayhead={onPlayheadChange} onPlayingChange={onPlayingChange} onActiveClip={onSelectedClipChange} videoStyle={{ transform: `translate(${Number(selectedClip.x || 0)}%, ${Number(selectedClip.y || 0)}%) scale(${Number(selectedClip.scale || 1)})`, transformOrigin: 'center center' }} /> : <div className="flex h-full min-h-56 items-center justify-center text-sm text-white/30">No clips</div>}
          </div>
        </section>

        <aside className="space-y-3 border border-white/10 bg-[#17191d] p-3">
          {selectedClip ? <>
            <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-xs font-black">{selectedClip.label}</p><p className="text-[9px] text-white/35">VIDEO CLIP</p></div><button type="button" onClick={deleteSelectedClip} className="p-2 text-red-300"><Trash2 size={14} /></button></div>
            <div className="grid grid-cols-2 gap-2"><button type="button" disabled={selectedIndex <= 0} onClick={() => moveSelected(-1)} className="border border-white/10 p-2 text-[10px] font-bold disabled:opacity-25">← Earlier</button><button type="button" disabled={selectedIndex < 0 || selectedIndex >= clips.length - 1} onClick={() => moveSelected(1)} className="border border-white/10 p-2 text-[10px] font-bold disabled:opacity-25">Later →</button></div>
            <label className="block text-[10px] text-white/45">Scale · {Number(selectedClip.scale || 1).toFixed(2)}×<input type="range" min="1" max="2.5" step="0.05" value={selectedClip.scale || 1} onChange={(event) => updateClip(selectedClip.id, { scale: Number(event.target.value) })} className="mt-1 w-full" /></label>
            <label className="block text-[10px] text-white/45">Position X · {Number(selectedClip.x || 0)}<input type="range" min="-100" max="100" step="1" value={selectedClip.x || 0} onChange={(event) => updateClip(selectedClip.id, { x: Number(event.target.value) })} className="mt-1 w-full" /></label>
            <label className="block text-[10px] text-white/45">Position Y · {Number(selectedClip.y || 0)}<input type="range" min="-100" max="100" step="1" value={selectedClip.y || 0} onChange={(event) => updateClip(selectedClip.id, { y: Number(event.target.value) })} className="mt-1 w-full" /></label>
            <label className="block text-[10px] text-white/45">Clip volume · {Math.round(Number(selectedClip.volume ?? 1) * 100)}%<input type="range" min="0" max="1" step="0.05" value={selectedClip.volume ?? 1} onChange={(event) => updateClip(selectedClip.id, { volume: Number(event.target.value) })} className="mt-1 w-full" /></label>
            <button type="button" onClick={() => updateClip(selectedClip.id, { muted: !selectedClip.muted })} className="flex w-full items-center justify-center gap-2 border border-white/10 p-2 text-xs font-bold">{selectedClip.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}{selectedClip.muted ? 'Muted' : 'Clip audio on'}</button>
          </> : <p className="text-xs text-white/35">Select a clip.</p>}

          {music.url && <div className="space-y-2 border-t border-white/10 pt-3"><div className="flex items-center gap-2"><Music2 size={14} className="text-[#8ee9e4]" /><div className="min-w-0"><p className="truncate text-xs font-black">{music.name || 'Music'}</p><p className="text-[9px] text-white/35">AUDIO TRACK</p></div></div><label className="block text-[10px] text-white/45">Music volume · {Math.round(Number(music.volume ?? 0.55) * 100)}%<input type="range" min="0" max="1" step="0.05" value={music.volume ?? 0.55} onChange={(event) => onMusicChange?.({ ...music, volume: Number(event.target.value) }, true)} className="mt-1 w-full" /></label><div className="grid grid-cols-2 gap-2"><label className="text-[10px] text-white/45">Fade in<input type="number" min="0" step="0.1" value={music.fade_in || 0} onChange={(event) => onMusicChange?.({ ...music, fade_in: Math.max(0, Number(event.target.value) || 0) }, true)} className="mt-1 w-full bg-black/30 p-2 text-xs" /></label><label className="text-[10px] text-white/45">Fade out<input type="number" min="0" step="0.1" value={music.fade_out || 0} onChange={(event) => onMusicChange?.({ ...music, fade_out: Math.max(0, Number(event.target.value) || 0) }, true)} className="mt-1 w-full bg-black/30 p-2 text-xs" /></label></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => onMusicChange?.({ ...music, loop: !music.loop }, true)} className={`border p-2 text-[10px] font-bold ${music.loop ? 'border-[#23c7be] text-[#8ee9e4]' : 'border-white/10'}`}>{music.loop ? 'Loop on' : 'Loop off'}</button><button type="button" onClick={() => onMusicChange?.({ url: '', name: '', volume: 0.55, start: 0, trim_start: 0, trim_end: 0, duration: 0, loop: false, fade_in: 0, fade_out: 0 }, true)} className="border border-red-400/25 p-2 text-[10px] font-bold text-red-200">Remove</button></div></div>}
        </aside>
      </div>

      <section className="border border-white/10 bg-[#111317]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-2">
          <div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#23c7be]">Timeline</span><span className="text-[9px] text-white/35">Video + music on one shared timebase</span></div>
          <div className="flex items-center gap-1"><button type="button" onClick={() => setZoom((value) => clamp(Number((value - 0.25).toFixed(2)), 0.5, 3))} className="border border-white/10 p-1.5"><ZoomOut size={12} /></button><span className="min-w-12 text-center text-[9px] text-white/50">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => clamp(Number((value + 0.25).toFixed(2)), 0.5, 3))} className="border border-white/10 p-1.5"><ZoomIn size={12} /></button></div>
        </div>

        <div className="grid grid-cols-[64px_1fr] md:grid-cols-[88px_1fr]">
          <div className="border-r border-white/10 bg-[#17191d]">
            <div className="h-7 border-b border-white/10" />
            <div className="flex h-24 items-center px-2 text-[9px] font-black text-white/55">V1 · VIDEO</div>
            <div className="flex h-16 items-center px-2 text-[9px] font-black text-white/55">A1 · MUSIC</div>
          </div>

          <div ref={viewportRef} className="overflow-x-auto overflow-y-hidden">
            <div className="relative" style={{ width: `${trackWidth}px`, minWidth: '100%' }}>
              <div className="relative h-7 border-b border-white/10 bg-black/20" onPointerDown={handleTrackPointer}>
                {Array.from({ length: rulerMarks }, (_, index) => {
                  const second = index * rulerStep;
                  return <div key={second} className="absolute inset-y-0 border-l border-white/15" style={{ left: `${second * pxPerSecond}px` }}><span className="absolute left-1 top-1 text-[8px] text-white/35">{second.toFixed(rulerStep < 1 ? 1 : 0)}s</span></div>;
                })}
              </div>

              <div className="relative h-24 border-b border-white/10 bg-black/30" onPointerDown={handleTrackPointer}>
                {clips.map((clip, index) => {
                  const start = clipStart(clips, clip.id);
                  const width = clipDuration(clip) * pxPerSecond;
                  const selected = clip.id === selectedClipId;
                  return <div key={clip.id} onPointerDown={(event) => { event.stopPropagation(); selectClip(clip); }} className={`absolute inset-y-1 overflow-hidden border ${selected ? 'z-20 border-[#23c7be] ring-1 ring-[#23c7be]' : 'z-10 border-white/15'} bg-[#20252c]`} style={{ left: `${start * pxPerSecond}px`, width: `${Math.max(18, width)}px` }}>
                    <video src={clip.url} muted preload="metadata" onLoadedMetadata={(event) => onClipMetadata?.(clip, event.currentTarget.duration)} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/10" />
                    <div className="pointer-events-none absolute bottom-2 left-3 right-3"><p className="truncate text-[10px] font-black">{index + 1}. {clip.label}</p><p className="text-[8px] text-white/55">{clipDuration(clip).toFixed(2)}s</p></div>
                    <button type="button" aria-label="Trim clip start" onPointerDown={(event) => beginTrim(event, 'clip-start', clip)} className="absolute inset-y-0 left-0 z-30 w-3 cursor-ew-resize bg-white/10 hover:bg-[#23c7be]/50"><span className="absolute left-1/2 top-1/2 h-7 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-white/70" /></button>
                    <button type="button" aria-label="Trim clip end" onPointerDown={(event) => beginTrim(event, 'clip-end', clip)} className="absolute inset-y-0 right-0 z-30 w-3 cursor-ew-resize bg-white/10 hover:bg-[#23c7be]/50"><span className="absolute left-1/2 top-1/2 h-7 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-white/70" /></button>
                  </div>;
                })}
              </div>

              <div className="relative h-16 bg-black/30" onPointerDown={handleTrackPointer}>
                {!music.url ? <div className="absolute inset-2 flex items-center gap-2"><label className="flex cursor-pointer items-center gap-2 border border-dashed border-white/20 px-3 py-2 text-[10px] font-bold text-white/55"><Upload size={12} /> Add music<input type="file" accept="audio/*" className="hidden" onChange={(event) => onMusicUpload?.(event.target.files?.[0])} /></label><button type="button" onClick={(event) => { event.stopPropagation(); onMusicVault?.(); }} className="flex items-center gap-2 border border-white/10 px-3 py-2 text-[10px] font-bold text-white/55"><Folder size={12} /> Vault</button></div> : <div onPointerDown={(event) => { event.stopPropagation(); beginMusicMove(event); }} className="absolute inset-y-2 cursor-grab overflow-hidden border border-[#23c7be]/60 bg-[#23c7be]/15 active:cursor-grabbing" style={{ left: `${Number(music.start || 0) * pxPerSecond}px`, width: `${Math.max(24, musicVisibleDuration * pxPerSecond)}px` }}>
                  <div className="absolute inset-0 flex items-end gap-[2px] px-3 pb-2 opacity-55">{Array.from({ length: 48 }, (_, index) => <span key={index} className="flex-1 bg-[#8ee9e4]" style={{ height: `${18 + ((index * 17) % 24)}%` }} />)}</div>
                  <div className="pointer-events-none absolute inset-0 flex items-center px-5"><div className="min-w-0"><p className="truncate text-[10px] font-black text-[#bff7f3]">♫ {music.name || 'Music'}</p><p className="text-[8px] text-white/55">{music.loop ? 'Loop' : `${musicDuration.toFixed(2)}s`}</p></div></div>
                  <button type="button" aria-label="Trim music start" onPointerDown={(event) => beginMusicTrim(event, 'left')} className="absolute inset-y-0 left-0 z-30 w-3 cursor-ew-resize bg-[#23c7be]/35"><span className="absolute left-1/2 top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-white/80" /></button>
                  {!music.loop && <button type="button" aria-label="Trim music end" onPointerDown={(event) => beginMusicTrim(event, 'right')} className="absolute inset-y-0 right-0 z-30 w-3 cursor-ew-resize bg-[#23c7be]/35"><span className="absolute left-1/2 top-1/2 h-6 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-white/80" /></button>}
                </div>}
              </div>

              <div className="pointer-events-none absolute bottom-0 top-0 z-50 w-[2px] bg-[#23c7be]" style={{ left: `${playhead * pxPerSecond}px` }}><div className="absolute -left-[5px] top-0 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#23c7be]" /></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
