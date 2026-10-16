import React, { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Play, RotateCcw, Volume2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { VOICE_LANGUAGES, VOICE_NAMES } from '@/lib/voiceCatalog';
import { toast } from 'sonner';

const control = 'w-full border border-white/15 bg-[#20242a] px-2 py-2 text-xs font-semibold text-white focus:border-[#23c7be] focus:outline-none';
const action = 'inline-flex items-center justify-center gap-2 border border-white/10 px-3 py-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-35';

function orderBoxes(boxes) {
  return (Array.isArray(boxes) ? boxes : [])
    .map((box, index) => ({ ...box, order: Number.isFinite(Number(box.order)) ? Number(box.order) : index + 1 }))
    .sort((a, b) => a.order - b.order)
    .map((box, index) => ({ ...box, order: index + 1 }));
}

function defaultCharacterVoice(character, index) {
  return character?.voice || character?.voice_id || character?.tts_voice || VOICE_NAMES[(index + 1) % VOICE_NAMES.length] || VOICE_NAMES[0] || '';
}

function dispatchActive(id) {
  window.dispatchEvent(new CustomEvent('fotoplay-audio-active', { detail: { id: id || '' } }));
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function playUrl(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = resolve;
    audio.onerror = () => reject(new Error('Unable to play generated line'));
    audio.play().catch(reject);
  });
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
}

function linearResample(data, fromRate, toRate) {
  if (fromRate === toRate) return data;
  const length = Math.max(1, Math.round(data.length * toRate / fromRate));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const pos = i * fromRate / toRate;
    const left = Math.floor(pos);
    const right = Math.min(data.length - 1, left + 1);
    const mix = pos - left;
    out[i] = data[left] * (1 - mix) + data[right] * mix;
  }
  return out;
}

async function decodeMono(url, context, targetRate) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load generated audio');
  const buffer = await context.decodeAudioData(await response.arrayBuffer());
  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return linearResample(mono, buffer.sampleRate, targetRate);
}

async function combineToWav(lines) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('Audio assembly is not supported by this browser');
  const context = new AudioContextClass();
  const sampleRate = 44100;
  try {
    const decoded = [];
    let totalSamples = 0;
    let cursorSeconds = 0;
    const timeline = [];
    for (const line of lines) {
      const data = await decodeMono(line.audio_url, context, sampleRate);
      const pause = Math.max(0, Math.min(5, Number(line.pause_after ?? 0.35)));
      const start = cursorSeconds;
      const duration = data.length / sampleRate;
      const end = start + duration;
      timeline.push({ box_id: line.id, order: line.order, start, end, duration, pause_after: pause, speaker_id: line.speaker_id || '', type: line.type });
      decoded.push({ data, pauseSamples: Math.round(pause * sampleRate) });
      totalSamples += data.length + Math.round(pause * sampleRate);
      cursorSeconds = end + pause;
    }
    const pcm = new Float32Array(totalSamples);
    let offset = 0;
    decoded.forEach(({ data, pauseSamples }) => {
      pcm.set(data, offset);
      offset += data.length + pauseSamples;
    });

    const buffer = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(buffer);
    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcm.length * 2, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, 'data');
    view.setUint32(40, pcm.length * 2, true);
    let byteOffset = 44;
    for (let i = 0; i < pcm.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, pcm[i]));
      view.setInt16(byteOffset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      byteOffset += 2;
    }
    return { file: new File([buffer], `fotoplay-audio-${crypto.randomUUID()}.wav`, { type: 'audio/wav' }), timeline };
  } finally {
    context.close?.();
  }
}

export default function FotoPlayAudioPanel({ boxes, characters = [], segment, project, pricing, busy, setBusy, onBoxesChange, onPersist }) {
  const ordered = useMemo(() => orderBoxes(boxes), [boxes]);
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef(false);
  const language = segment.narrator_language || project.production_settings?.narrator_language || 'en';

  const patchBox = (id, values) => onBoxesChange(orderBoxes(ordered.map((box) => box.id === id ? { ...box, ...values } : box)));
  const move = (id, delta) => {
    const index = ordered.findIndex((box) => box.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    [next[index], next[target]] = [next[target], next[index]];
    onBoxesChange(next.map((box, i) => ({ ...box, order: i + 1 })));
  };

  const resolveVoice = (box) => {
    if (box.voice) return box.voice;
    if (box.type === 'narration') return segment.narrator_voice || VOICE_NAMES[0] || '';
    const characterIndex = characters.findIndex((item) => item.id === box.speaker_id);
    return defaultCharacterVoice(characters[characterIndex], Math.max(0, characterIndex));
  };

  const resolveLanguage = (box) => box.language || language;
  const lineNeedsGeneration = (box) => !box.audio_url || box.audio_source_text !== box.text || box.audio_voice !== resolveVoice(box) || box.audio_language !== resolveLanguage(box);

  const generateLine = async (box, currentBoxes = ordered) => {
    if (!box.text?.trim()) throw new Error(`Line ${box.order} has no text`);
    const voice = resolveVoice(box);
    if (!voice) throw new Error(`Choose a voice for line ${box.order}`);
    const response = await base44.functions.invoke('generateSpeech', { text: box.text, voice, language_code: resolveLanguage(box) });
    const data = response?.data || {};
    const url = data.file_url;
    if (!url) throw new Error(`No audio returned for line ${box.order}`);
    const creditCost = Number(data.credit_cost ?? 0);
    const balanceAfter = Number(data.balance_after);
    const nextBoxes = currentBoxes.map((item) => item.id === box.id ? {
      ...item,
      voice,
      audio_url: url,
      audio_source_text: item.text,
      audio_voice: voice,
      audio_language: resolveLanguage(item),
      audio_credit_cost: Number.isFinite(creditCost) ? creditCost : 0,
      audio_balance_after: Number.isFinite(balanceAfter) ? balanceAfter : null,
      audio_generated_at: new Date().toISOString(),
    } : item);
    return { boxes: nextBoxes, creditCost: Number.isFinite(creditCost) ? creditCost : 0, balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : null };
  };

  const buildSegmentAudio = async (sourceBoxes, forceAll = false) => {
    if (!sourceBoxes.length) throw new Error('Add at least one narration or dialogue box first');
    setBusy?.('audio-sequence');
    try {
      let next = orderBoxes(sourceBoxes);
      let totalCharged = 0;
      for (const box of next) {
        const current = next.find((item) => item.id === box.id);
        if (forceAll || lineNeedsGeneration(current)) {
          const generated = await generateLine(current, next);
          next = generated.boxes;
          totalCharged += generated.creditCost;
        }
      }
      const playable = next.filter((box) => box.text?.trim() && box.audio_url);
      const { file, timeline } = await combineToWav(playable);
      const uploaded = await base44.integrations.Core.UploadFile({ file });
      const signature = JSON.stringify(next.map((box) => ({ id: box.id, order: box.order, text: box.text, voice: resolveVoice(box), language: resolveLanguage(box), pause: box.pause_after ?? 0.35 })));
      await onPersist({ text_boxes: next, narration_url: uploaded.file_url, audio_sequence: timeline, audio_source_text: signature, audio_voice: 'multi', audio_stale: false, status: 'draft' });
      toast.success(totalCharged > 0 ? `FotoPlay final audio generated · ${totalCharged} credits charged` : 'FotoPlay final audio assembled · no new credits charged');
    } finally {
      setBusy?.('');
    }
  };

  const playSequence = async () => {
    if (playing) {
      stopRef.current = true;
      return;
    }
    const playable = ordered.filter((box) => box.text?.trim() && box.audio_url);
    if (!playable.length) return toast.error('Generate the audio lines first');
    stopRef.current = false;
    setPlaying(true);
    try {
      for (const box of playable) {
        if (stopRef.current) break;
        dispatchActive(box.id);
        await playUrl(box.audio_url);
        if (stopRef.current) break;
        await wait(Math.max(0, Math.min(5, Number(box.pause_after ?? 0.35))) * 1000);
      }
    } catch (error) {
      toast.error(error.message || 'Playback failed');
    } finally {
      dispatchActive('');
      stopRef.current = false;
      setPlaying(false);
    }
  };

  return <div className="space-y-3">
    <div className="border border-white/10 bg-[#181c21] p-3">
      <p className="text-xs font-black uppercase tracking-[.12em] text-[#23c7be]">Reading order</p>
      <p className="mt-1 text-xs text-white/55">Audio follows this order, not the visual position of the boxes.</p>
    </div>

    {ordered.map((box, index) => {
      const character = characters.find((item) => item.id === box.speaker_id);
      const voice = resolveVoice(box);
      const stale = lineNeedsGeneration(box);
      const hasRecordedLineCost = box.audio_credit_cost !== undefined && box.audio_credit_cost !== null;
      const lineCost = hasRecordedLineCost ? Number(box.audio_credit_cost) : null;
      return <div key={box.id} className="space-y-3 border border-white/10 bg-[#181c21] p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center bg-[#23c7be] text-xs font-black text-black">{index + 1}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-black">{box.type === 'dialogue' ? (character?.name || 'Dialogue') : 'Narration'}</p><p className="truncate text-[10px] text-white/45">{box.text || 'Empty text block'}</p></div>
          <button type="button" disabled={index === 0} onClick={() => move(box.id, -1)} className="border border-white/10 p-1.5 disabled:opacity-25"><ArrowUp size={13} /></button>
          <button type="button" disabled={index === ordered.length - 1} onClick={() => move(box.id, 1)} className="border border-white/10 p-1.5 disabled:opacity-25"><ArrowDown size={13} /></button>
        </div>

        {box.type === 'dialogue' && <label className="block text-[10px] font-black uppercase text-white/50">Speaker
          <select value={box.speaker_id || ''} onChange={(e) => patchBox(box.id, { speaker_id: e.target.value, voice: '' })} className={`${control} mt-1`}>
            <option value="" className="text-black">Choose character</option>
            {characters.map((item) => <option key={item.id} value={item.id} className="text-black">{item.name}</option>)}
          </select>
        </label>}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-black uppercase text-white/50">Voice
            <select value={voice} onChange={(e) => patchBox(box.id, { voice: e.target.value })} className={`${control} mt-1`}>
              {VOICE_NAMES.map((name) => <option key={name} value={name} className="text-black">{name}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-black uppercase text-white/50">Language
            <select value={resolveLanguage(box)} onChange={(e) => patchBox(box.id, { language: e.target.value })} className={`${control} mt-1`}>
              {VOICE_LANGUAGES.map(([code, name]) => <option key={code} value={code} className="text-black">{name}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-[10px] font-black uppercase text-white/50">Pause after · {Number(box.pause_after ?? 0.35).toFixed(2)}s
          <input type="range" min="0" max="3" step="0.05" value={Number(box.pause_after ?? 0.35)} onChange={(e) => patchBox(box.id, { pause_after: Number(e.target.value) })} className="mt-2 w-full accent-[#23c7be]" />
        </label>

        {box.audio_url && !stale && <div className="flex items-center justify-between border border-[#23c7be]/35 bg-[#23c7be]/10 px-3 py-2">
          <span className="text-[11px] font-black text-[#23c7be]">{hasRecordedLineCost ? `✓ Generated · ${lineCost} credit${lineCost === 1 ? '' : 's'}` : '✓ Generated · cost not recorded'}</span>
          <button type="button" onClick={() => { dispatchActive(box.id); playUrl(box.audio_url).finally(() => dispatchActive('')); }} className="inline-flex items-center gap-1 text-[11px] font-black text-white"><Play size={12} /> Listen</button>
        </div>}
        {box.audio_url && stale && <div className="border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] font-black text-amber-200">Audio exists, but this line changed and needs regeneration.</div>}

        <div className="flex gap-2">
          {box.audio_url && <button type="button" onClick={() => { dispatchActive(box.id); playUrl(box.audio_url).finally(() => dispatchActive('')); }} className={`${action} flex-1 bg-[#242930]`}><Play size={13} /> Listen</button>}
          <button type="button" disabled={busy === 'audio-sequence'} onClick={async () => {
            try {
              setBusy?.('audio-sequence');
              const generated = await generateLine(box, ordered);
              onBoxesChange(generated.boxes);
              await onPersist({ text_boxes: generated.boxes, audio_stale: true, status: 'draft' });
              toast.success(`Line ${box.order} generated · ${generated.creditCost} credit${generated.creditCost === 1 ? '' : 's'} charged`);
            } catch (error) {
              toast.error(error.message || 'Line generation failed');
            } finally {
              setBusy?.('');
            }
          }} className={`${action} flex-1 bg-[#242930]`}>{stale ? <Volume2 size={13} /> : <RotateCcw size={13} />} {stale ? 'Generate line' : 'Regenerate line'}</button>
        </div>
      </div>;
    })}

    {!ordered.length && <div className="border border-white/10 bg-[#181c21] p-4 text-sm font-semibold text-white/50">Add narration or dialogue boxes first. Their order will appear here automatically.</div>}

    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={playSequence} disabled={!ordered.some((box) => box.audio_url)} className={`${action} bg-white text-black`}><Play size={14} /> {playing ? 'Stop playback' : 'Play sequence'}</button>
      <button type="button" onClick={() => buildSegmentAudio(ordered, false).catch((error) => toast.error(error.message || 'Audio generation failed'))} disabled={busy === 'audio-sequence' || !ordered.length} className={`${action} bg-[#23c7be] text-black`}>{busy === 'audio-sequence' ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />} Build final audio</button>
    </div>

    {segment.narration_url && !segment.audio_stale && <div className="border border-[#23c7be]/25 bg-[#23c7be]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[.08em] text-[#23c7be]">✓ Final publication audio ready</div>}
    <p className="text-[10px] text-white/40">Play sequence is the editing preview. Build final audio creates the combined publication track in the background.</p>
  </div>;
}