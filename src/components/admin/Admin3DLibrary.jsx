import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Box, CheckCircle2, ImagePlus, Pencil, RefreshCw, Upload, X } from 'lucide-react';
import { supabase } from '@/api/base44Client';

const TYPES = [
  { value: 'character', label: 'Character' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'prop', label: 'Prop' },
  { value: 'set', label: 'Set' },
];

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function createImageItem(file) {
  return {
    id: crypto.randomUUID(),
    file,
    preview: URL.createObjectURL(file),
  };
}

const EMPTY_FORM = {
  asset_type: 'character',
  name: '',
  description: '',
  category: '',
  subcategory: '',
  price_credits: '',
  featured: false,
  active: true,
};

export default function Admin3DLibrary() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [cover, setCover] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [existingCover, setExistingCover] = useState('');
  const [existingGallery, setExistingGallery] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [existingR2ObjectKey, setExistingR2ObjectKey] = useState(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  const isEditing = Boolean(editingId);
  const hasCover = Boolean(cover?.file || existingCover);
  const hasZip = Boolean(file || existingR2ObjectKey);

  const canPublish = useMemo(
    () => Boolean(hasZip && hasCover && form.name.trim() && Number(form.price_credits) >= 0),
    [hasZip, hasCover, form]
  );

  async function loadAssets() {
    setLoadingAssets(true);
    const { data, error: loadError } = await supabase
      .from('studio_3d_asset')
      .select('id,name,description,asset_type,category_id,subcategory_id,price_credits,r2_object_key,preview_url,gallery,active,featured,created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!loadError) setAssets(data || []);
    setLoadingAssets(false);
  }

  useEffect(() => { loadAssets(); }, []);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function chooseCover(nextFile) {
    setCover((current) => {
      if (current?.preview) URL.revokeObjectURL(current.preview);
      return nextFile ? createImageItem(nextFile) : null;
    });
  }

  function addGallery(files) {
    const nextFiles = Array.from(files || []).filter((item) => item.type.startsWith('image/'));
    if (!nextFiles.length) return;
    setGallery((current) => [...current, ...nextFiles.map(createImageItem)]);
  }

  function removeGallery(id) {
    setGallery((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return current.filter((item) => item.id !== id);
    });
  }

  function resetImageFiles() {
    if (cover?.preview) URL.revokeObjectURL(cover.preview);
    gallery.forEach((item) => {
      if (item.preview) URL.revokeObjectURL(item.preview);
    });
    setCover(null);
    setGallery([]);
  }

  function resetForm() {
    resetImageFiles();
    setExistingCover('');
    setExistingGallery([]);
    setExistingR2ObjectKey(null);
    setEditingId(null);
    setFile(null);
    setForm(EMPTY_FORM);
    setError('');
    setStatus('');
    setProgress(0);
  }

  async function resolveCategoryNames(categoryId, subcategoryId) {
    let category = '';
    let subcategory = '';

    if (categoryId) {
      const { data } = await supabase
        .from('studio_3d_category')
        .select('name')
        .eq('id', categoryId)
        .maybeSingle();
      category = data?.name || '';
    }

    if (subcategoryId) {
      const { data } = await supabase
        .from('studio_3d_subcategory')
        .select('name')
        .eq('id', subcategoryId)
        .maybeSingle();
      subcategory = data?.name || '';
    }

    return { category, subcategory };
  }

  async function startEdit(asset) {
    setError('');
    setStatus('Loading product…');
    resetImageFiles();

    const { data: fullAsset, error: assetError } = await supabase
      .from('studio_3d_asset')
      .select('id,name,description,asset_type,category_id,subcategory_id,price_credits,r2_object_key,preview_url,gallery,active,featured')
      .eq('id', asset.id)
      .single();

    if (assetError) {
      setError(assetError.message);
      setStatus('');
      return;
    }

    const names = await resolveCategoryNames(fullAsset.category_id, fullAsset.subcategory_id);

    setEditingId(fullAsset.id);
    setExistingR2ObjectKey(fullAsset.r2_object_key || null);
    setExistingCover(fullAsset.preview_url || '');
    setExistingGallery(Array.isArray(fullAsset.gallery) ? fullAsset.gallery : []);
    setFile(null);
    setForm({
      asset_type: fullAsset.asset_type || 'character',
      name: fullAsset.name || '',
      description: fullAsset.description || '',
      category: names.category,
      subcategory: names.subcategory,
      price_credits: String(fullAsset.price_credits ?? 0),
      featured: Boolean(fullAsset.featured),
      active: Boolean(fullAsset.active),
    });
    setStatus('Editing product.');
    setProgress(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  async function uploadDirect(uploadFile, uploadUrl, onProgress) {
    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', uploadFile.type || 'application/octet-stream');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => reject(new Error('R2 upload failed. Check the bucket CORS policy.'));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(true);
        else reject(new Error(`R2 upload failed (${xhr.status}).`));
      };
      xhr.send(uploadFile);
    });
  }

  async function signAndUpload(uploadFile, kind, label) {
    setStatus(label);
    setProgress(0);

    const { data: signed, error: signError } = await supabase.functions.invoke('admin-3d-r2-upload', {
      body: {
        filename: uploadFile.name,
        content_type: uploadFile.type || (kind === 'product' ? 'application/zip' : 'application/octet-stream'),
        kind,
      },
    });
    if (signError) throw signError;
    if (!signed?.upload_url || !signed?.object_key) {
      throw new Error('The upload function did not return a signed R2 URL.');
    }

    await uploadDirect(uploadFile, signed.upload_url, setProgress);
    return signed;
  }

  async function publish(event) {
    event.preventDefault();
    if (!canPublish || publishing) return;

    setError('');
    setPublishing(true);
    setProgress(0);

    try {
      let r2ObjectKey = existingR2ObjectKey;
      if (file) {
        const zipUpload = await signAndUpload(file, 'product', isEditing ? 'Replacing 3D ZIP…' : 'Uploading 3D ZIP directly to R2…');
        r2ObjectKey = zipUpload.object_key;
      }

      let previewUrl = existingCover;
      if (cover?.file) {
        const coverUpload = await signAndUpload(cover.file, 'preview', isEditing ? 'Replacing main presentation image…' : 'Uploading main presentation image…');
        if (!coverUpload.public_url) throw new Error('The R2 upload function did not return a presentation image URL.');
        previewUrl = coverUpload.public_url;
      }

      const galleryUrls = [...existingGallery];
      for (let index = 0; index < gallery.length; index += 1) {
        const item = gallery[index];
        const uploaded = await signAndUpload(
          item.file,
          'preview',
          `Uploading gallery image ${index + 1} of ${gallery.length}…`
        );
        if (uploaded.public_url) galleryUrls.push(uploaded.public_url);
      }

      setStatus(isEditing ? 'Saving changes…' : 'Saving product in the 3D catalog…');
      setProgress(100);
      const { categoryId, subcategoryId } = await resolveCategoryIds();

      const payload = {
        asset_type: form.asset_type,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        preview_url: previewUrl,
        gallery: galleryUrls,
        price_credits: Math.round(Number(form.price_credits)),
        r2_object_key: r2ObjectKey,
        active: form.active,
        featured: form.featured,
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('studio_3d_asset')
          .update(payload)
          .eq('id', editingId);
        if (updateError) throw updateError;
      } else {
        const baseSlug = slugify(form.name) || 'asset';
        const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
        const { error: insertError } = await supabase
          .from('studio_3d_asset')
          .insert({ ...payload, slug });
        if (insertError) throw insertError;
      }

      setStatus(isEditing ? 'Changes saved.' : 'Published successfully.');
      setProgress(100);
      resetForm();
      await loadAssets();
    } catch (err) {
      setError(err?.message || (isEditing ? 'Unable to save this 3D product.' : 'Unable to publish this 3D product.'));
      setStatus('');
      setProgress(0);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto text-white">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.25em] text-white/45 font-bold">AISTAGE.ONE</p>
        <h2 className="text-3xl font-black mt-1">3D Library</h2>
        <p className="text-sm text-white/55 mt-2">Upload and manage AISTAGE-owned 3D products, presentation images and gallery images.</p>
      </div>

      {isEditing && (
        <div className="mb-4 border border-white/20 bg-white/5 px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/45 font-bold">Editing product</div>
            <div className="font-black">{form.name}</div>
          </div>
          <button type="button" onClick={resetForm} className="h-9 px-4 border border-white/20 text-sm font-bold hover:bg-white/10">Cancel edit</button>
        </div>
      )}

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

          <div className="space-y-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white/55">Product images</div>
              <div className="text-xs text-white/40 mt-1">Choose or replace the main presentation image, and add/remove gallery images.</div>
            </div>

            <div className="grid md:grid-cols-[220px_minmax(0,1fr)] gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-2">Main image · required</div>
                {cover ? (
                  <div className="relative border border-white/15 bg-neutral-900 aspect-[4/3] overflow-hidden">
                    <img src={cover.preview} alt="Main product preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => chooseCover(null)} className="absolute top-2 right-2 h-8 w-8 bg-black/80 border border-white/20 flex items-center justify-center" aria-label="Remove new main image"><X size={16} /></button>
                    <div className="absolute left-2 bottom-2 bg-black/80 px-2 py-1 text-[10px] font-black uppercase tracking-wider">New cover</div>
                  </div>
                ) : existingCover ? (
                  <div className="space-y-2">
                    <div className="relative border border-white/15 bg-neutral-900 aspect-[4/3] overflow-hidden">
                      <img src={existingCover} alt="Current main product preview" className="w-full h-full object-cover" />
                      <div className="absolute left-2 bottom-2 bg-black/80 px-2 py-1 text-[10px] font-black uppercase tracking-wider">Current cover</div>
                    </div>
                    <label className="cursor-pointer block border border-white/20 px-3 py-2 text-center text-xs font-black hover:bg-white/10">
                      Replace cover
                      <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => chooseCover(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer border border-dashed border-white/25 bg-neutral-900/40 aspect-[4/3] flex flex-col items-center justify-center text-center p-4 hover:border-white/50">
                    <ImagePlus size={28} className="mb-2 text-white/60" />
                    <div className="text-sm font-black">Choose main image</div>
                    <div className="text-[11px] text-white/40 mt-1">JPG, PNG, WEBP or AVIF</div>
                    <input type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={(e) => chooseCover(e.target.files?.[0] || null)} />
                  </label>
                )}
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-white/55 mb-2">Gallery</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {existingGallery.map((url) => (
                    <div key={url} className="relative border border-white/15 bg-neutral-900 aspect-square overflow-hidden">
                      <img src={url} alt="Current gallery" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setExistingGallery((current) => current.filter((item) => item !== url))} className="absolute top-1.5 right-1.5 h-7 w-7 bg-black/80 border border-white/20 flex items-center justify-center" aria-label="Remove gallery image"><X size={14} /></button>
                    </div>
                  ))}
                  {gallery.map((item) => (
                    <div key={item.id} className="relative border border-white/15 bg-neutral-900 aspect-square overflow-hidden">
                      <img src={item.preview} alt="New gallery preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeGallery(item.id)} className="absolute top-1.5 right-1.5 h-7 w-7 bg-black/80 border border-white/20 flex items-center justify-center" aria-label="Remove new gallery image"><X size={14} /></button>
                    </div>
                  ))}
                  <label className="cursor-pointer border border-dashed border-white/25 bg-neutral-900/40 aspect-square flex flex-col items-center justify-center text-center p-3 hover:border-white/50">
                    <ImagePlus size={23} className="mb-2 text-white/60" />
                    <div className="text-xs font-black">Add images</div>
                    <input type="file" accept={IMAGE_ACCEPT} multiple className="hidden" onChange={(e) => { addGallery(e.target.files); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} /> Published</label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.featured} onChange={(e) => update('featured', e.target.checked)} /> Featured</label>
          </div>
        </div>

        <aside className="border border-white/15 bg-neutral-950 p-5">
          <div className="min-h-44 border border-dashed border-white/25 flex items-center justify-center text-center p-5">
            <label className="cursor-pointer w-full">
              <Upload size={30} className="mx-auto mb-3 text-white/60" />
              <div className="font-black">{file ? file.name : isEditing && existingR2ObjectKey ? 'Keep current 3D ZIP' : 'Choose 3D ZIP'}</div>
              <div className="text-xs text-white/45 mt-2">
                {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : isEditing && existingR2ObjectKey ? 'Choose a new ZIP only if you want to replace the current model.' : 'The ZIP uploads directly from this browser to R2.'}
              </div>
              <input type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          {(status || progress > 0) && (
            <div className="mt-4 border border-white/10 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {!publishing && progress === 100 ? <CheckCircle2 size={16} /> : <RefreshCw size={16} className={publishing ? 'animate-spin' : ''} />}
                {status}
              </div>
              <div className="mt-3 h-2 bg-white/10 overflow-hidden"><div className="h-full bg-white" style={{ width: `${progress}%` }} /></div>
              <div className="text-right text-xs text-white/45 mt-1">{progress}%</div>
            </div>
          )}

          {error && <div className="mt-4 border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200 flex gap-2"><AlertCircle size={17} className="shrink-0" />{error}</div>}

          <button type="submit" disabled={!canPublish || publishing} className="mt-4 w-full h-12 bg-white text-black font-black uppercase tracking-wider disabled:opacity-40">
            {publishing ? (isEditing ? 'Saving…' : 'Uploading…') : (isEditing ? 'Save changes' : 'Upload & publish')}
          </button>
          {!hasCover && <div className="mt-2 text-[11px] text-white/35 text-center">A main presentation image is required.</div>}
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
              <div key={asset.id} className="px-4 py-3 grid grid-cols-[56px_1fr_auto_auto_auto] gap-4 items-center text-sm">
                <div className="w-14 h-14 border border-white/10 bg-neutral-900 overflow-hidden flex items-center justify-center">
                  {asset.preview_url ? <img src={asset.preview_url} alt="" className="w-full h-full object-cover" /> : <Box size={19} className="text-white/25" />}
                </div>
                <div><div className="font-bold">{asset.name}</div><div className="text-white/40 text-xs">{asset.asset_type} · {asset.gallery?.length || 0} gallery image{asset.gallery?.length === 1 ? '' : 's'}</div></div>
                <div className="font-bold">{asset.price_credits} cr</div>
                <div className={asset.active ? 'text-emerald-300 text-xs font-bold' : 'text-white/35 text-xs font-bold'}>{asset.active ? 'LIVE' : 'HIDDEN'}</div>
                <button type="button" onClick={() => startEdit(asset)} className="h-9 px-3 border border-white/20 flex items-center gap-2 text-xs font-black hover:bg-white/10" aria-label={`Edit ${asset.name}`}>
                  <Pencil size={14} /> Edit
                </button>
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
