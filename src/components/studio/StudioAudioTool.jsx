import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import SaveToVaultModal from './SaveToVaultModal';
import AudioSimpleEditor from './AudioSimpleEditor';
import { audioInput, AUDIO_TOOLS } from '../../../supabase/functions/_shared/studioAudioInput.js';
import { toast } from 'sonner';
import { useAiPriceQuote } from '@/hooks/useAiPriceQuote';
import { useAiModelOptions } from '@/hooks/useAiModelOptions';

const terminal = job => !job || ['succeeded', 'failed'].includes(job.status);
const field = 'w-full bg-white/10 text-white rounded-xl p-3 border border-white/20';
export default function StudioAudioTool({ tool, user }) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [mode, setMode] = useState('instrumental');
  const [duration, setDuration] = useState(tool === 'music' ? 30 : 3);
  const [format, setFormat] = useState(tool === 'music' ? 'mp3' : 'wav');
  const [config, setConfig] = useState(null);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [vault, setVault] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [showVaultAudio, setShowVaultAudio] = useState(false);
  const [vaultAudioAssets, setVaultAudioAssets] = useState([]);
  const [vaultAudioLoading, setVaultAudioLoading] = useState(false);
  const [editorSource, setEditorSource] = useState(null);
  const audioFileInput = useRef(null);
  const submission = useRef(false);
  const mounted = useRef(true);
  const service = AUDIO_TOOLS[tool].service;
  const pricingInput = tool === 'music'
    ? { prompt, lyrics: mode === 'lyrics' ? lyrics : '', is_instrumental: mode === 'instrumental', lyrics_optimizer: mode === 'auto', audio_format: format, duration, music_length_ms: duration * 1000 }
    : { prompt, duration, output_format: format };
  const { options: modelOptions, loading: modelsLoading } = useAiModelOptions({
    service,
    kind: 'audio',
    input: pricingInput,
    enabled: true,
  });
  const effectiveModel = selectedModel || modelOptions.find(m => m.recommended)?.model_key || modelOptions[0]?.model_key || null;
  const { quote: priceQuote, loading: priceLoading } = useAiPriceQuote({
    service,
    kind: 'audio',
    input: pricingInput,
    modelKey: effectiveModel,
    enabled: true,
  });
  const invoke = async body => (await base44.functions.invoke(service, body)).data;
  const remember = next => {
    setJob(next);
    setHistory(previous => [next, ...previous.filter(item => item.id !== next.id)].slice(0, 30));
  };
  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    Promise.all([
      base44.functions.invoke(service, { action: 'config' }),
      base44.functions.invoke(service, { action: 'list' }),
    ]).then(([settings, listing]) => {
      if (disposed) return;
      setConfig(settings.data);
      setHistory(listing.data.jobs);
      setJob(listing.data.jobs.find(item => !terminal(item)) || null);
    }).catch(err => { if (!disposed) setError(err.message); })
      .finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; mounted.current = false; };
  }, [service, user?.id]);
  useEffect(() => {
    if (!job?.id || terminal(job)) return;
    let disposed = false;
    let timer;
    const poll = async () => {
      try {
        const { data } = await base44.functions.invoke(service, { action: 'status', id: job.id });
        if (disposed) return;
        remember(data.job);
        setError('');
        if (terminal(data.job)) return;
      } catch (err) { if (!disposed) setError(err.message); }
      if (!disposed) timer = setTimeout(poll, 7000);
    };
    timer = setTimeout(poll, 2000);
    return () => { disposed = true; clearTimeout(timer); };
  }, [job?.id, job?.status, service]);
  const generate = async () => {
    if (submission.current || !terminal(job)) return;
    const body = { prompt, lyrics, mode, duration, format, title, model_key: effectiveModel || undefined };
    try { audioInput(tool, body); } catch (err) { setError(err.message); return; }
    submission.current = true;
    setSending(true);
    setError('');
    const id = crypto.randomUUID();
    remember({ id, title: title || AUDIO_TOOLS[tool].label, status: 'submitting', format, created_at: new Date().toISOString() });
    try {
      const data = await invoke({ ...body, id, action: 'start' });
      if (mounted.current) remember(data.job);
    } catch (err) {
      if (mounted.current) {
        setError(err.message);
        if ([400, 401, 403, 409].includes(err.status)) {
          const latest = await invoke({ action: 'list' }).catch(() => null);
          if (mounted.current && latest) {
            setHistory(latest.jobs);
            setJob(latest.jobs.find(item => item.id === id) || null);
          }
        }
      }
    } finally {
      submission.current = false;
      if (mounted.current) setSending(false);
    }
  };
  const download = async () => {
    setDownloading(true);
    try {
      const response = await fetch(job.file_url);
      if (!response.ok) throw new Error('Download failed. Please try again.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = (job.title || tool).replace(/[^a-zA-Z0-9 _-]/g, '_') + '.' + job.format;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) { toast.error(err.message); }
    finally { setDownloading(false); }
  };

  const openGeneratedEditor = () => {
    const source = job?.status === 'succeeded' && job?.file_url
      ? job
      : history.find(item => item.status === 'succeeded' && item.file_url);
    if (!source?.file_url) { toast.error('Generate a music track first.'); return; }
    setEditorSource({ url: source.file_url, name: source.title || 'Generated music', source: 'generated' });
  };
  const openVaultAudio = async () => {
    if (!user?.email) return;
    setVaultAudioLoading(true);
    setShowVaultAudio(true);
    try {
      const assets = await base44.entities.VaultAsset.filter({ user_email: user.email, media_type: 'audio' }, '-created_date', 100);
      setVaultAudioAssets(assets || []);
    } catch (err) { toast.error(err.message || 'Could not load audio from Vault.'); }
    finally { setVaultAudioLoading(false); }
  };
  const uploadMusicFile = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith('audio/')) { toast.error('Choose an audio file.'); return; }
    setAudioUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setEditorSource({ url: result.file_url, name: file.name.replace(/\.[^.]+$/, '') || 'Uploaded music', source: 'upload' });
      toast.success('Audio loaded into Music editor.');
    } catch (err) { toast.error(err.message || 'Could not upload audio.'); }
    finally { setAudioUploading(false); if (audioFileInput.current) audioFileInput.current.value = ''; }
  };

  const busy = sending || !terminal(job);
  return (
    <div className="space-y-4 text-white">
      {tool === 'music' ? (
        <section className="studio-panel-secondary p-4 space-y-3">
          <div>
            <div className="studio-tool-eyebrow">Music source</div>
            <p className="text-sm text-[var(--studio-text-muted)]">Generate a track here, upload your own audio, or bring one from your Vault.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button className="studio-button studio-button-secondary" onClick={openGeneratedEditor}>Generated</button>
            <button className="studio-button studio-button-secondary" disabled={audioUploading} onClick={() => audioFileInput.current?.click()}>{audioUploading ? 'Uploading…' : 'Upload'}</button>
            <input ref={audioFileInput} type="file" accept="audio/*" className="hidden" onChange={e => uploadMusicFile(e.target.files?.[0])} />
            <button className="studio-button studio-button-secondary" onClick={openVaultAudio}>Vault</button>
          </div>
        </section>
      ) : null}
      {tool === 'music' && editorSource ? (
        <AudioSimpleEditor
          sourceUrl={editorSource.url}
          sourceName={editorSource.name}
          onSaveToVault={(url) => setVault({ file_url: url, title: `${editorSource.name} edited` })}
        />
      ) : null}
      <div className="space-y-2">
        <label className="block">AI Model
          <select className={field + ' bg-black'} value={effectiveModel || ''} onChange={e => setSelectedModel(e.target.value || null)} disabled={busy || modelsLoading || modelOptions.length === 0}>
            {modelsLoading ? <option value="">Loading models…</option> : null}
            {!modelsLoading && modelOptions.length === 0 ? <option value="">No model available</option> : null}
            {modelOptions.map(m => (
              <option key={m.model_key} value={m.model_key}>
                {m.name || m.model_key}{m.recommended ? ' — Recommended' : ''}{m.credits ? ` — ${m.credits} credits` : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center justify-between text-sm text-white/70">
          <span>AI cost</span>
          <span>{priceLoading ? 'Calculating…' : priceQuote?.credits ? `${priceQuote.credits} credits` : 'Calculated automatically'}</span>
        </div>
      </div>
      <label className="block">Name
        <input className={field} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder={AUDIO_TOOLS[tool].label} disabled={busy} />
      </label>
      {tool === 'music' ? (
        <>
          <label className="block">Music type
            <select className={field + ' bg-black'} value={mode} onChange={e => setMode(e.target.value)} disabled={busy}>
              <option className="bg-black" value="instrumental">Instrumental</option>
              <option className="bg-black" value="lyrics">Song — my lyrics</option>
              <option className="bg-black" value="auto">Song — generate lyrics</option>
            </select>
          </label>
          <label className="block">Duration
            <div className="flex items-center gap-3">
              <input className={field} type="number" min="5" max="300" step="1" value={duration} onChange={e => setDuration(e.target.value === '' ? '' : Number(e.target.value))} disabled={busy} />
              <span className="whitespace-nowrap text-white/70">seconds</span>
            </div>
            <span className="text-xs text-white/45">5–300 seconds</span>
          </label>
        </>
      ) : (
        <label className="block">Duration: {duration} seconds
          <input className="w-full accent-yellow-400" type="range" min="1" max="10" step="0.5" value={duration} onChange={e => setDuration(Number(e.target.value))} disabled={busy} />
        </label>
      )}
      <label className="block">{tool === 'music' ? 'Describe the music: style, mood, instruments…' : 'Describe the sound effect'}
        <textarea className={field} rows={3} maxLength={2000} value={prompt} onChange={e => setPrompt(e.target.value)} disabled={busy} />
      </label>
      {tool === 'music' && mode === 'lyrics' ? (
        <label className="block">Lyrics
          <textarea className={field} rows={7} maxLength={3500} value={lyrics} onChange={e => setLyrics(e.target.value)} placeholder={'[Verse]\nYour lyrics…\n[Chorus]'} disabled={busy} />
          <span className="text-xs">{lyrics.length}/3500</span>
        </label>
      ) : null}
      <label className="block">Download format
        <select className={field + ' bg-black'} value={format} onChange={e => setFormat(e.target.value)} disabled={busy}>
          <option className="bg-black" value="mp3">MP3</option>
          <option className="bg-black" value="wav">WAV</option>
        </select>
      </label>
      {error ? <p role="alert" className="text-red-300">{error}</p> : null}
      {job?.error ? <p role="status" className="text-yellow-300">{job.error}</p> : null}
      <button className="w-full rounded-xl bg-yellow-400 text-black font-bold p-3 disabled:opacity-50" disabled={loading || busy || !config?.ready} onClick={generate}>
        {busy ? 'Generating… You can return later.' : 'Generate ' + AUDIO_TOOLS[tool].label + (priceQuote?.credits ? ' · ' + priceQuote.credits + ' credits' : '')}
      </button>
      {!loading && !config?.ready ? <p className="text-sm">Enable this tool in Admin before generating.</p> : null}
      {job?.status === 'succeeded' && job.file_url ? (
        <div className="space-y-3 rounded-xl bg-white/5 p-4">
          <p className="font-bold">{job.title}</p>
          <audio controls src={job.file_url} className="w-full" />
          <div className="flex gap-3 flex-wrap">
            <button className="rounded-xl bg-yellow-400 text-black font-bold px-4 py-2" onClick={() => setVault(job)}>Save to Vault</button>
            {tool === 'music' ? <button className="rounded-xl border border-white/30 px-4 py-2" onClick={() => setEditorSource({ url: job.file_url, name: job.title || 'Generated music', source: 'generated' })}>Edit music</button> : null}
            <button className="rounded-xl border border-white/30 px-4 py-2" disabled={downloading} onClick={download}>{downloading ? 'Downloading…' : 'Download'}</button>
          </div>
        </div>
      ) : null}
      {history.length ? <details><summary className="cursor-pointer">Recent generations</summary>
        <div className="mt-2 space-y-2">{history.map(item => (
          <button key={item.id} disabled={sending} onClick={() => { setJob(item); setError(''); }} className="block text-left w-full rounded-lg bg-white/10 p-2">
            {item.title} · {item.status} · {new Date(item.created_at).toLocaleString()}
          </button>
        ))}</div>
      </details> : null}
      {tool === 'sound_fx' && (!config || config.model === 'sepal/audiogen') ? <p className="text-xs text-white/60">AudioGen model licence: non-commercial. Commercial authorization must be checked before commercial use.</p> : null}
      {vault ? <SaveToVaultModal userEmail={user?.email} imageUrl={vault.file_url} mediaType="audio" onClose={() => setVault(null)} onSaved={() => { setVault(null); toast.success('Audio saved to your Vault.'); }} /> : null}
      {tool === 'music' && showVaultAudio ? (
        <div className="fixed inset-0 z-[99998] bg-black/80 flex items-center justify-center p-4">
          <div className="studio-panel w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="studio-tool-header flex items-center justify-between">
              <div><div className="studio-tool-eyebrow">Vault</div><h3 className="studio-tool-title">Choose audio</h3></div>
              <button className="studio-button studio-button-secondary !min-h-9" onClick={() => setShowVaultAudio(false)}>Close</button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2">
              {vaultAudioLoading ? <p className="text-sm text-[var(--studio-text-muted)]">Loading audio…</p> : null}
              {!vaultAudioLoading && !vaultAudioAssets.length ? <p className="text-sm text-[var(--studio-text-muted)]">No audio files in your Vault.</p> : null}
              {vaultAudioAssets.map(asset => (
                <button key={asset.id} className="w-full text-left studio-panel-secondary p-3 flex items-center gap-3 hover:border-[var(--studio-accent)]" onClick={() => {
                  setEditorSource({ url: asset.url, name: asset.name || 'Vault audio', source: 'vault' });
                  setShowVaultAudio(false);
                }}>
                  <div className="min-w-0 flex-1"><div className="font-semibold truncate">{asset.name || 'Audio'}</div><div className="text-xs text-[var(--studio-text-faint)] truncate">{asset.url}</div></div>
                  <span className="text-xs text-[var(--studio-accent)]">Open</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
