import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Download, RotateCcw, RotateCw, Scissors, Trash2, Repeat2, Save, Play, Pause } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fmt = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}.${Math.floor((seconds % 1) * 10)}`;

function makeBufferLike(source, length) {
  const context = new AudioContext();
  const result = context.createBuffer(source.numberOfChannels, Math.max(1, length), source.sampleRate);
  context.close();
  return result;
}

function sliceBuffer(source, startSeconds, endSeconds) {
  const start = clamp(Math.floor(startSeconds * source.sampleRate), 0, source.length);
  const end = clamp(Math.ceil(endSeconds * source.sampleRate), start + 1, source.length);
  const output = makeBufferLike(source, end - start);
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    output.copyToChannel(source.getChannelData(channel).slice(start, end), channel);
  }
  return output;
}

function concatBuffers(source, ranges) {
  const pieces = ranges
    .map(([start, end]) => [clamp(Math.floor(start * source.sampleRate), 0, source.length), clamp(Math.ceil(end * source.sampleRate), 0, source.length)])
    .filter(([start, end]) => end > start);
  const total = pieces.reduce((sum, [start, end]) => sum + (end - start), 0);
  if (!total) return source;
  const output = makeBufferLike(source, total);
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const target = output.getChannelData(channel);
    const input = source.getChannelData(channel);
    let offset = 0;
    pieces.forEach(([start, end]) => {
      target.set(input.subarray(start, end), offset);
      offset += end - start;
    });
  }
  return output;
}

function cloneWithGain(source, gainFactory) {
  const output = makeBufferLike(source, source.length);
  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    const input = source.getChannelData(channel);
    const target = output.getChannelData(channel);
    for (let i = 0; i < input.length; i += 1) target[i] = input[i] * gainFactory(i, input.length, source.sampleRate);
  }
  return output;
}

function encodeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const array = new ArrayBuffer(44 + dataSize);
  const view = new DataView(array);
  const write = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, dataSize, true);
  const channelData = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      const sample = clamp(channelData[c][i], -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([array], { type: 'audio/wav' });
}

export default function AudioSimpleEditor({ sourceUrl, sourceName = 'Music', onSaveToVault }) {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const startedAtRef = useRef(0);
  const animationRef = useRef(null);
  const [buffer, setBuffer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(0);
  const [playhead, setPlayhead] = useState(0);
  const [cuts, setCuts] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [volumeDb, setVolumeDb] = useState(0);
  const [fadeSeconds, setFadeSeconds] = useState(1);
  const [saving, setSaving] = useState(false);

  const duration = buffer?.duration || 0;
  const segments = useMemo(() => {
    if (!buffer) return [];
    const points = [0, ...cuts.filter(c => c > 0 && c < duration).sort((a, b) => a - b), duration];
    return points.slice(0, -1).map((start, index) => ({ start, end: points[index + 1] }));
  }, [buffer, cuts, duration]);

  const stop = () => {
    try { sourceNodeRef.current?.stop(); } catch {}
    sourceNodeRef.current = null;
    cancelAnimationFrame(animationRef.current);
    setPlaying(false);
  };

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    stop();
    setHistory([]);
    setFuture([]);
    setCuts([]);
    fetch(sourceUrl)
      .then(response => { if (!response.ok) throw new Error('Unable to load this audio file.'); return response.arrayBuffer(); })
      .then(async bytes => {
        const context = new AudioContext();
        const decoded = await context.decodeAudioData(bytes.slice(0));
        await context.close();
        if (disposed) return;
        setBuffer(decoded);
        setSelectionStart(0);
        setSelectionEnd(decoded.duration);
        setPlayhead(0);
      })
      .catch(error => toast.error(error.message))
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; stop(); audioContextRef.current?.close().catch(() => {}); };
  }, [sourceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 140;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / width));
    const mid = height / 2;
    ctx.strokeStyle = 'rgba(255,255,255,.72)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 1) {
      let min = 1; let max = -1;
      const from = x * step;
      const to = Math.min(data.length, from + step);
      for (let i = from; i < to; i += 1) { const v = data[i]; if (v < min) min = v; if (v > max) max = v; }
      ctx.moveTo(x, mid + min * mid * 0.85);
      ctx.lineTo(x, mid + max * mid * 0.85);
    }
    ctx.stroke();
    const x1 = duration ? (selectionStart / duration) * width : 0;
    const x2 = duration ? (selectionEnd / duration) * width : width;
    ctx.fillStyle = 'rgba(35,199,190,.16)';
    ctx.fillRect(x1, 0, Math.max(1, x2 - x1), height);
    cuts.forEach(cut => {
      const x = (cut / duration) * width;
      ctx.strokeStyle = 'rgba(255,255,255,.38)';
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    });
    const px = duration ? (playhead / duration) * width : 0;
    ctx.strokeStyle = 'rgb(35,199,190)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, height); ctx.stroke();
  }, [buffer, selectionStart, selectionEnd, playhead, cuts, duration]);

  const commit = next => {
    if (!buffer || !next || next === buffer) return;
    stop();
    setHistory(previous => [...previous.slice(-19), buffer]);
    setFuture([]);
    setBuffer(next);
    setCuts([]);
    setSelectionStart(0);
    setSelectionEnd(next.duration);
    setPlayhead(0);
  };

  const play = async () => {
    if (!buffer) return;
    if (playing) { stop(); return; }
    const context = audioContextRef.current && audioContextRef.current.state !== 'closed' ? audioContextRef.current : new AudioContext();
    audioContextRef.current = context;
    await context.resume();
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.connect(context.destination);
    const startAt = clamp(playhead, 0, Math.max(0, duration - 0.01));
    startedAtRef.current = context.currentTime - startAt;
    sourceNodeRef.current = node;
    node.onended = () => { setPlaying(false); setPlayhead(0); };
    node.start(0, startAt);
    setPlaying(true);
    const tick = () => {
      const current = context.currentTime - startedAtRef.current;
      if (current >= duration) return;
      setPlayhead(current);
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
  };

  const selectSegment = segment => { setSelectionStart(segment.start); setSelectionEnd(segment.end); setPlayhead(segment.start); };
  const addCut = () => { if (playhead > 0.02 && playhead < duration - 0.02) setCuts(previous => [...new Set([...previous, playhead])]); };
  const trim = () => commit(sliceBuffer(buffer, selectionStart, selectionEnd));
  const deleteSelection = () => {
    if (selectionStart <= 0.001 && selectionEnd >= duration - 0.001) return toast.error('Select a smaller section first.');
    commit(concatBuffers(buffer, [[0, selectionStart], [selectionEnd, duration]]));
  };
  const loopSelection = () => {
    if (selectionEnd - selectionStart < 0.02) return;
    commit(concatBuffers(buffer, [[0, selectionEnd], [selectionStart, selectionEnd], [selectionEnd, duration]]));
  };
  const normalize = () => {
    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i]));
    }
    if (!peak) return;
    commit(cloneWithGain(buffer, () => 0.98 / peak));
  };
  const applyVolume = () => commit(cloneWithGain(buffer, () => 10 ** (Number(volumeDb) / 20)));
  const applyFade = direction => {
    const samples = Math.max(1, Math.floor(clamp(Number(fadeSeconds) || 0, 0, duration) * buffer.sampleRate));
    commit(cloneWithGain(buffer, (i, length) => {
      if (direction === 'in' && i < samples) return i / samples;
      if (direction === 'out' && i >= length - samples) return (length - 1 - i) / samples;
      return 1;
    }));
  };
  const undo = () => {
    if (!history.length) return;
    stop();
    const previous = history[history.length - 1];
    setFuture(next => [buffer, ...next].slice(0, 20));
    setHistory(history.slice(0, -1));
    setBuffer(previous); setCuts([]); setSelectionStart(0); setSelectionEnd(previous.duration); setPlayhead(0);
  };
  const redo = () => {
    if (!future.length) return;
    stop();
    const nextBuffer = future[0];
    setHistory(previous => [...previous, buffer].slice(-20));
    setFuture(future.slice(1));
    setBuffer(nextBuffer); setCuts([]); setSelectionStart(0); setSelectionEnd(nextBuffer.duration); setPlayhead(0);
  };
  const exportWav = () => {
    const blob = encodeWav(buffer);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sourceName.replace(/[^a-zA-Z0-9 _-]/g, '_') || 'music'} edited.wav`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const saveToVault = async () => {
    setSaving(true);
    try {
      const blob = encodeWav(buffer);
      const file = new File([blob], `${sourceName || 'music'} edited.wav`, { type: 'audio/wav' });
      const result = await base44.integrations.Core.UploadFile({ file });
      onSaveToVault?.(result.file_url);
    } catch (error) { toast.error(error.message || 'Could not upload edited audio.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="studio-panel-secondary p-5 text-sm text-[var(--studio-text-muted)]">Loading audio editor…</div>;
  if (!buffer) return null;

  return (
    <section className="studio-panel-secondary p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div><div className="studio-tool-eyebrow">Edit music</div><div className="font-bold truncate max-w-[520px]">{sourceName}</div></div>
        <div className="flex gap-2">
          <button className="studio-button studio-button-secondary !min-h-9" onClick={undo} disabled={!history.length}><RotateCcw size={15}/>Undo</button>
          <button className="studio-button studio-button-secondary !min-h-9" onClick={redo} disabled={!future.length}><RotateCw size={15}/>Redo</button>
        </div>
      </div>

      <canvas ref={canvasRef} className="w-full h-[140px] bg-black/25 border border-[var(--studio-border)] cursor-crosshair" onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPlayhead(clamp(((event.clientX - rect.left) / rect.width) * duration, 0, duration));
      }}/>
      <div className="flex items-center gap-3">
        <button className="studio-button studio-button-primary !min-h-9" onClick={play}>{playing ? <Pause size={15}/> : <Play size={15}/>} {playing ? 'Pause' : 'Play'}</button>
        <span className="text-sm tabular-nums text-[var(--studio-text-muted)]">{fmt(playhead)} / {fmt(duration)}</span>
        <button className="studio-button studio-button-secondary !min-h-9 ml-auto" onClick={addCut}><Scissors size={15}/>Split at playhead</button>
      </div>

      {segments.length > 1 ? <div className="flex flex-wrap gap-2">{segments.map((segment, index) => <button key={`${segment.start}-${segment.end}`} onClick={() => selectSegment(segment)} className="studio-button studio-button-secondary !min-h-8 !px-3 text-xs">Segment {index + 1} · {fmt(segment.end - segment.start)}</button>)}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-[var(--studio-text-muted)]">Selection start · {fmt(selectionStart)}
          <input type="range" min="0" max={duration} step="0.01" value={selectionStart} onChange={e => { const value = Math.min(Number(e.target.value), selectionEnd - 0.01); setSelectionStart(value); }} className="w-full accent-[var(--studio-accent)]" />
        </label>
        <label className="text-xs text-[var(--studio-text-muted)]">Selection end · {fmt(selectionEnd)}
          <input type="range" min="0" max={duration} step="0.01" value={selectionEnd} onChange={e => { const value = Math.max(Number(e.target.value), selectionStart + 0.01); setSelectionEnd(value); }} className="w-full accent-[var(--studio-accent)]" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="studio-button studio-button-secondary" onClick={trim}>Trim to selection</button>
        <button className="studio-button studio-button-secondary" onClick={deleteSelection}><Trash2 size={15}/>Delete selection</button>
        <button className="studio-button studio-button-secondary" onClick={loopSelection}><Repeat2 size={15}/>Loop selection ×2</button>
        <button className="studio-button studio-button-secondary" onClick={normalize}>Normalize</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs text-[var(--studio-text-muted)]">Volume · {volumeDb} dB</label>
          <div className="flex gap-2 items-center"><input type="range" min="-18" max="12" step="1" value={volumeDb} onChange={e => setVolumeDb(Number(e.target.value))} className="flex-1 accent-[var(--studio-accent)]"/><button className="studio-button studio-button-secondary !min-h-9" onClick={applyVolume}>Apply</button></div>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-[var(--studio-text-muted)]">Fade · {fadeSeconds}s</label>
          <div className="flex gap-2 items-center"><input type="number" min="0.1" max={Math.max(0.1, duration)} step="0.1" value={fadeSeconds} onChange={e => setFadeSeconds(e.target.value)} className="studio-input h-9 w-24 px-2"/><button className="studio-button studio-button-secondary !min-h-9" onClick={() => applyFade('in')}>Fade in</button><button className="studio-button studio-button-secondary !min-h-9" onClick={() => applyFade('out')}>Fade out</button></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--studio-border)]">
        <button className="studio-button studio-button-primary" onClick={saveToVault} disabled={saving}><Save size={16}/>{saving ? 'Preparing…' : 'Save edited version to Vault'}</button>
        <button className="studio-button studio-button-secondary" onClick={exportWav}><Download size={16}/>Export WAV</button>
        <span className="text-xs self-center text-[var(--studio-text-faint)]">Original file stays untouched.</span>
      </div>
    </section>
  );
}
