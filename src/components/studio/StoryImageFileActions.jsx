import React, { useRef, useState } from 'react';
import { Download, Save, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { saveStoryImage, storyImageFilename } from './storyImageFiles.js';

export default function StoryImageFileActions({ url, userEmail, name = 'FotoPlay image', ratio = '16:9' }) {
  const [busy, setBusy] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  if (!url) return null;
  const run = async (kind) => {
    if (lock.current) return;
    lock.current = true; setBusy(kind); setError('');
    try {
      if (kind === 'vault') {
        await saveStoryImage(base44.entities.VaultAsset, { url, userEmail, name, ratio });
        setSavedUrl(url);
      } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Unable to download this image (${response.status}).`);
        const blob = await response.blob();
        if (!blob.size || !blob.type.startsWith('image/')) throw new Error('The server did not return an image.');
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href; link.download = storyImageFilename(name, blob.type);
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(href), 60000);
      }
    } catch (failure) { setError(failure.message || 'Unable to save this image.'); }
    finally { lock.current = false; setBusy(''); }
  };
  const style = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black disabled:opacity-40';
  return <div className="my-2 w-full" aria-label={`Image files: ${name}`}>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => run('vault')} disabled={Boolean(busy) || savedUrl === url} className={`${style} bg-yellow-400 text-black`}>{busy === 'vault' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{savedUrl === url ? 'Saved to Vault' : 'Save to Vault'}</button>
      <button type="button" onClick={() => run('download')} disabled={Boolean(busy)} className={`${style} bg-white/10 text-white`}>{busy === 'download' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}Download</button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    {savedUrl === url && <p role="status" className="mt-2 text-xs text-green-300">Image saved to your Vault.</p>}
  </div>;
}
