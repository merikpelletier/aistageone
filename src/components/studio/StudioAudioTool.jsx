import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import SaveToVaultModal from './SaveToVaultModal';
import { audioInput, AUDIO_TOOLS } from '../../../supabase/functions/_shared/studioAudioInput.js';
import { toast } from 'sonner';

const terminal = job => !job || ['succeeded', 'failed'].includes(job.status);
const field = 'w-full bg-white/10 text-white rounded-xl p-3 border border-white/20';
export default function StudioAudioTool({ tool, user }) {
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [mode, setMode] = useState('instrumental');
  const [duration, setDuration] = useState(3);
  const [format, setFormat] = useState(tool === 'music' ? 'mp3' : 'wav');
  const [config, setConfig] = useState(null);
  const [job, setJob] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [vault, setVault] = useState(null);
  const submission = useRef(false);
  const mounted = useRef(true);
  const service = AUDIO_TOOLS[tool].service;
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
      setJob(listing.data.jobs[0] || null);
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
    const body = { prompt, lyrics, mode, duration, format, title };
    try { audioInput(tool, body); } catch (err) { setError(err.message); return; }
    submission.current = true;
    setSending(true);
    setError('');
    const id = crypto.randomUUID();
    // Keep the ID before sending; a lost HTTP response must not trigger another
    // paid start. Poll this same ID instead.
    remember({ id, title: title || AUDIO_TOOLS[tool].label, status: 'submitting', format, created_at: new Date().toISOString() });
    try {
      const data = await invoke({ ...body, id, action: 'start' });
      if (mounted.current) remember(data.job);
    } catch (err) {
      if (mounted.current) {
        setError(err.message);
        // Explicit preflight validation/auth failures cannot have started a job.
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
  const busy = sending || !terminal(job);
  return (
    <div className="space-y-4 text-white">
      <p className="text-sm text-white/70">{config?.model || AUDIO_TOOLS[tool].model}</p>
      <label className="block">Name
        <input className={field} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder={AUDIO_TOOLS[tool].label} disabled={busy} />
      </label>
      {tool === 'music' ? (
        <label className="block">Music type
          <select className={field + ' bg-black'} value={mode} onChange={e => setMode(e.target.value)} disabled={busy}>
            <option className="bg-black" value="instrumental">Instrumental</option>
            <option className="bg-black" value="lyrics">Song — my lyrics</option>
            <option className="bg-black" value="auto">Song — generate lyrics</option>
          </select>
        </label>
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
        {busy ? 'Generating… You can return later.' : 'Generate ' + AUDIO_TOOLS[tool].label + (config?.credit_cost != null ? ' · ' + config.credit_cost + ' credit(s)' : '')}
      </button>
      {!loading && !config?.ready ? <p className="text-sm">Enable this tool and set its credits in Admin before generating.</p> : null}
      {job?.status === 'succeeded' && job.file_url ? (
        <div className="space-y-3 rounded-xl bg-white/5 p-4">
          <p className="font-bold">{job.title}</p>
          <audio controls src={job.file_url} className="w-full" />
          <div className="flex gap-3 flex-wrap">
            <button className="rounded-xl bg-yellow-400 text-black font-bold px-4 py-2" onClick={() => setVault(job)}>Save to Vault</button>
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
    </div>
  );
}
