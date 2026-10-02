import React, { useEffect, useMemo, useState } from 'react';
import { Box, Upload, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/api/base44Client';

const TYPES = [
  { value: 'character', label: 'Character' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'prop', label: 'Prop' },
  { value: 'set', label: 'Set' },
];

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

export default function Admin3DLibrary() {
  const [form, setForm] = useState({
    asset_type: 'character',
    name: '',
    description: '',
    category: '',
    subcategory: '',
    price_credits: '',
    preview_url: '',
    featured: false,
    active: true,
  });
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const canPublish = useMemo(() => Boolean(file && form.name.trim() && Number(form.price_credits) >= 0), [file, form]);

  async function loadAssets() {
    setLoadingAssets(true);
    const { data, error: loadError } = await supabase
      .from('studio_3d_asset')
      .select('id,name,asset_type,price_credits,r2_object_key,active,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!loadError) setAssets(data || []);
    setLoadingAssets(false);
  }

  useEffect(() => { loadAssets(); }, []);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function resolveCategoryIds() {
    let categoryId = null;
    let subcategoryId = null;

    if (form.category.trim()) {
      const categorySlug = slugify(form.category);
      const { data: category, error: categoryError } = await supabase
        .from('studio_3d_category')
        .upsert({
          asset_type: form.asset_type,
          name: form.category.trim(),
          slug: categorySlug,
          active: true,
        }, { onConflict: 'asset_type,slug' })
        .select('id')
        .single();
      if (categoryError) throw categoryError;
      categoryId = category.id;

      if (form.subcategory.trim()) {
        const { data: subcategory, error: subcategoryError } = await supabase
          .from('studio_3d_subcategory')
          .upsert({
            category_id: categoryId,
            name: form.subcategory.trim(),
            slug: slugify(form.subcategory),
            active: true,
          }, { onConflict: 'category_id,slug' })
          .select('id')
          .single();
        if (subcategoryError) throw subcategoryError;
        subcategoryId = subcategory.id;
      }
    }

    return { categoryId, subcategoryId };
  }

  async function uploadDirect(uploadUrl) {
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/zip');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => reject(new Error('R2 upload failed. Check the bucket CORS policy.'));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(true);
        else reject(new Error(`R2 upload failed (${xhr.status}).`));
      };
      xhr.send(file);
    });
  }

  async function publish(event) {
    event.preventDefault();
    if (!canPublish) return;

    setError('');
    setStatus('Preparing secure R2 upload…');
    setProgress(0);

    try {
      const { data: signed, error: signError } = await supabase.functions.invoke('admin-3d-r2-upload', {
        body: {
          filename: file.name,
          content_type: file.type || 'application/zip',
        },
      });
      if (signError) throw signError;
      if (!signed?.upload_url || !signed?.object_key) throw new Error('The upload function did not return a signed R2 URL.');

      setStatus('Uploading ZIP directly to R2…');
      await uploadDirect(signed.upload_url);

      setStatus('Saving product in the 3D catalog…');
      const { categoryId, subcategoryId } = await resolveCategoryIds();

      const baseSlug = slugify(form.name) || 'asset';
      const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
      const { error: insertError } = await supabase
        .from('studio_3d_asset')
        .insert({
          asset_type: form.asset_type,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          name: form.name.trim(),
          slug,
          description: form.description.trim() || null,
          preview_url: form.preview_url.trim() || null,
          price_credits: Math.round(Number(form.price_credits)),
          r2_object_key: signed.object_key,
          active: form.active,
          featured: form.featured,
        });
      if (insertError) throw insertError;

      setStatus('Published successfully.');
      setProgress(100);
      setFile(null);
      setForm({
        asset_type: 'character',
        name: '',
        description: '',
        category: '',
        subcategory: '',
        price_credits: '',
        preview_url: '',
        featured: false,
        active: true,
      });
      await loadAssets();
    } catch (err) {
      setError(err?.message || 'Unable to publish this 3D product.');
      setStatus('');
    }
  }

  return (
    <div className="max-w-6xl mx-auto text-white">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/45 font-bold">AISTAGE.ONE</p>
        <h2 className="text-3xl font-black mt-1">3D Library</h2>
        <p className="text-sm text-white/55 mt-2">Upload AISTAGE-owned 3D ZIP products directly to the private R2 library and publish them in the Studio catalog.</p>
      </div>

      <form onSubmit={publish} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-5">
        <div className="border border-white/15 bg-neutral-950 p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white/55">Type</span>
              <select value={form.asset_type} onChange={(e) => update('asset_type', e.target.value)} className="w-full h-11 bg-neutral-900 border border-white/15 px-3">
                {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white/55">Price · credits</span>
              <input type="number" min="0" step="1" value={form.price_credits} onChange={(e) => update('price_credits', e.target.value)} className="w-full h-11 bg-neutral-900 border border-white/15 px-3" required />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/55">Product name</span>
            <input value={form.name} onChange={(e) => update('name', e.target.value)} className="w-full h-11 bg-neutral-900 border border-white/15 px-3" required />
          </label>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/55">Description</span>
            <textarea value={form.description} onChange={(e) => update('description', e.target.value)} className="w-full min-h-24 bg-neutral-900 border border-white/15 p-3" />
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white/55">Category</span>
              <input value={form.category} onChange={(e) => update('category', e.target.value)} className="w-full h-11 bg-neutral-900 border border-white/15 px-3" placeholder="e.g. Historical" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white/55">Subcategory</span>
              <input value={form.subcategory} onChange={(e) => update('subcategory', e.target.value)} className="w-full h-11 bg-neutral-900 border border-white/15 px-3" />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-white/55">Preview image URL</span>
            <input value={form.preview_url} onChange={(e) => update('preview_url', e.target.value)} className="w-full h-11 bg-neutral-900 border border-white/15 px-3" placeholder="https://…" />
          </label>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} /> Published</label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.featured} onChange={(e) => update('featured', e.target.checked)} /> Featured</label>
          </div>
        </div>

        <aside className="border border-white/15 bg-neutral-950 p-5">
          <div className="min-h-44 border border-dashed border-white/25 flex items-center justify-center text-center p-5">
            <label className="cursor-pointer w-full">
              <Upload size={30} className="mx-auto mb-3 text-white/60" />
              <div className="font-black">{file ? file.name : 'Choose 3D ZIP'}</div>
              <div className="text-xs text-white/45 mt-2">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'The ZIP uploads directly from this browser to R2.'}</div>
              <input type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          {(status || progress > 0) && (
            <div className="mt-4 border border-white/10 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {progress === 100 ? <CheckCircle2 size={16} /> : <RefreshCw size={16} className={status && progress < 100 ? 'animate-spin' : ''} />}
                {status}
              </div>
              <div className="mt-3 h-2 bg-white/10 overflow-hidden"><div className="h-full bg-white" style={{ width: `${progress}%` }} /></div>
              <div className="text-right text-xs text-white/45 mt-1">{progress}%</div>
            </div>
          )}

          {error && <div className="mt-4 border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200 flex gap-2"><AlertCircle size={17} className="shrink-0" />{error}</div>}

          <button type="submit" disabled={!canPublish || Boolean(status && progress < 100)} className="mt-4 w-full h-12 bg-white text-black font-black uppercase tracking-wider disabled:opacity-40">
            Upload & publish
          </button>
        </aside>
      </form>

      <div className="mt-8 border border-white/15 bg-neutral-950">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="font-black flex items-center gap-2"><Box size={17} /> Published 3D products</div>
          <button type="button" onClick={loadAssets} className="text-xs font-bold text-white/60 hover:text-white">Refresh</button>
        </div>
        {loadingAssets ? (
          <div className="p-5 text-white/45">Loading…</div>
        ) : assets.length ? (
          <div className="divide-y divide-white/10">
            {assets.map((asset) => (
              <div key={asset.id} className="px-4 py-3 grid grid-cols-[1fr_auto_auto] gap-4 items-center text-sm">
                <div><div className="font-bold">{asset.name}</div><div className="text-white/40 text-xs">{asset.asset_type} · {asset.r2_object_key}</div></div>
                <div className="font-bold">{asset.price_credits} cr</div>
                <div className={asset.active ? 'text-emerald-300 text-xs font-bold' : 'text-white/35 text-xs font-bold'}>{asset.active ? 'LIVE' : 'HIDDEN'}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5 text-white/45">No 3D products yet.</div>
        )}
      </div>
    </div>
  );
}
