import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Users, ShoppingBag, FolderOpen, Layers, Sparkles, Upload, Image as ImageIcon, Type, Grid3X3, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, Search, Tag, Download, ShoppingCart, X, Images } from 'lucide-react';
import { supabase } from '@/api/base44Client';

const MODES = [
  { key: 'generate_3d', label: 'Generate 3D', icon: Sparkles },
  { key: 'three_d_shop', label: '3D Shop', icon: ShoppingBag },
  { key: 'my_3d_assets', label: 'My 3D Assets', icon: FolderOpen },
];

const GENERATION_TYPES = [
  { key: 'text', label: 'Text', icon: Type, hint: 'Describe the object, character or set.' },
  { key: 'image', label: 'Image', icon: ImageIcon, hint: 'Use one reference image.' },
  { key: 'multi', label: 'Multi-view', icon: Grid3X3, hint: 'Front, back, left and right references.' },
];

function LibraryCatalog({ title, description, icon: Icon, assetTypes }) {
  const [assets, setAssets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [purchases, setPurchases] = useState(new Set());
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [sort, setSort] = useState('featured');
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [galleryAsset, setGalleryAsset] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErrorText('');
      const [{ data: assetRows, error: assetError }, { data: categoryRows }, { data: subcategoryRows }, { data: purchaseRows }] = await Promise.all([
        supabase.from('studio_3d_asset').select('id,asset_type,category_id,subcategory_id,name,slug,description,preview_url,gallery,badges,price_credits,featured,sort_order,created_at').in('asset_type', assetTypes).eq('active', true),
        supabase.from('studio_3d_category').select('id,asset_type,name,slug,sort_order').in('asset_type', assetTypes).eq('active', true).order('sort_order').order('name'),
        supabase.from('studio_3d_subcategory').select('id,category_id,name,slug,sort_order').eq('active', true).order('sort_order').order('name'),
        supabase.from('studio_3d_purchase').select('asset_id'),
      ]);
      if (!mounted) return;
      if (assetError) {
        setAssets([]);
        setErrorText(assetError.message || 'Unable to load 3D library.');
      } else {
        setAssets(assetRows || []);
      }
      setCategories(categoryRows || []);
      setSubcategories(subcategoryRows || []);
      setPurchases(new Set((purchaseRows || []).map((row) => row.asset_id)));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [assetTypes.join('|')]);

  useEffect(() => {
    setSubcategoryId('');
  }, [categoryId]);

  const galleryImages = useMemo(() => {
    if (!galleryAsset) return [];
    return [galleryAsset.preview_url, ...(Array.isArray(galleryAsset.gallery) ? galleryAsset.gallery : [])].filter(Boolean);
  }, [galleryAsset]);

  useEffect(() => {
    if (!galleryAsset) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setGalleryAsset(null);
      if (event.key === 'ArrowLeft' && galleryImages.length > 1) setGalleryIndex((index) => (index - 1 + galleryImages.length) % galleryImages.length);
      if (event.key === 'ArrowRight' && galleryImages.length > 1) setGalleryIndex((index) => (index + 1) % galleryImages.length);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [galleryAsset, galleryImages.length]);

  function openGallery(asset, index = 0) {
    setGalleryAsset(asset);
    setGalleryIndex(index);
  }

  const availableSubcategories = useMemo(() => subcategories.filter((item) => !categoryId || item.category_id === categoryId), [subcategories, categoryId]);

  const filteredAssets = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = assets.filter((asset) => {
      if (categoryId && asset.category_id !== categoryId) return false;
      if (subcategoryId && asset.subcategory_id !== subcategoryId) return false;
      if (needle && ![asset.name, asset.description, ...(asset.badges || [])].filter(Boolean).join(' ').toLowerCase().includes(needle)) return false;
      return true;
    });
    return [...rows].sort((a, b) => {
      if (sort === 'price_low') return (a.price_credits || 0) - (b.price_credits || 0);
      if (sort === 'price_high') return (b.price_credits || 0) - (a.price_credits || 0);
      if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sort === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }, [assets, search, categoryId, subcategoryId, sort]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#202328] p-4 text-white md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex items-start gap-3 border-b border-white/10 pb-5">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be]"><Icon size={22} /></div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#23c7be]">AISTAGE.ONE · 3D Library</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">{title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/45">{description}</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 rounded-[4px] border border-white/10 bg-[#17191d] p-3 lg:grid-cols-[minmax(0,1fr)_210px_210px_170px]">
          <label className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search 3D assets…" className="h-11 w-full rounded-[3px] border border-white/15 bg-black/25 pl-10 pr-3 font-semibold text-white outline-none placeholder:text-white/25 focus:border-[#23c7be]" />
          </label>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-11 rounded-[3px] border border-white/15 bg-black/25 px-3 font-bold text-white outline-none focus:border-[#23c7be]"><option value="">All categories</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)} disabled={!availableSubcategories.length} className="h-11 rounded-[3px] border border-white/15 bg-black/25 px-3 font-bold text-white outline-none focus:border-[#23c7be] disabled:opacity-35"><option value="">All subcategories</option>{availableSubcategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-11 rounded-[3px] border border-white/15 bg-black/25 px-3 font-bold text-white outline-none focus:border-[#23c7be]"><option value="featured">Featured</option><option value="newest">Newest</option><option value="name">Name</option><option value="price_low">Price ↑</option><option value="price_high">Price ↓</option></select>
        </div>

        {loading ? <div className="flex min-h-[360px] items-center justify-center rounded-[4px] border border-white/10 bg-[#17191d] font-bold text-white/40">Loading 3D library…</div>
        : errorText ? <div className="rounded-[4px] border border-red-400/25 bg-red-400/10 p-5 font-semibold text-red-200">{errorText}</div>
        : filteredAssets.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{filteredAssets.map((asset) => {
          const owned = purchases.has(asset.id);
          const galleryCount = Array.isArray(asset.gallery) ? asset.gallery.length : 0;
          return <article key={asset.id} className="overflow-hidden rounded-[4px] border border-white/10 bg-[#17191d] transition hover:border-[#23c7be]/45 hover:shadow-[inset_2px_0_0_#23c7be]">
            <button type="button" onClick={() => openGallery(asset, 0)} className="group relative block aspect-[4/3] w-full overflow-hidden bg-[#1d2126] text-left" aria-label={`View ${asset.name} gallery`}>
              {asset.preview_url ? <img src={asset.preview_url} alt={asset.name || ''} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" /> : <div className="absolute inset-0 flex items-center justify-center text-white/15"><Box size={52} strokeWidth={1.3} /></div>}
              {asset.featured && <span className="absolute left-2 top-2 rounded-[2px] border border-[#23c7be]/30 bg-[#17191d]/90 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#8ee9e4]">Featured</span>}
              {galleryCount > 0 && <span className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-[2px] border border-white/15 bg-black/80 px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-white"><Images size={13} /> Gallery · {galleryCount + 1}</span>}
            </button>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-lg font-black leading-tight text-white">{asset.name}</h3>{asset.description && <p className="mt-1 line-clamp-2 text-sm text-white/45">{asset.description}</p>}</div><div className="shrink-0 text-right"><div className="text-[10px] font-bold uppercase tracking-wider text-white/35">Price</div><div className="font-black text-[#8ee9e4]">{asset.price_credits} cr</div></div></div>
              {(asset.badges || []).length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{(asset.badges || []).map((badge) => <span key={badge} className="rounded-[2px] border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/55"><Tag size={10} className="mr-1 inline" />{badge}</span>)}</div>}
              {galleryCount > 0 && <button type="button" onClick={() => openGallery(asset, 0)} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[3px] border border-white/15 bg-white/[0.03] text-[11px] font-black uppercase tracking-[0.1em] text-white hover:bg-white/[0.08]"><Images size={14} /> View gallery · {galleryCount + 1} images</button>}
              <button type="button" className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[3px] text-xs font-black uppercase tracking-[0.12em] ${owned ? 'border border-white/10 bg-white/[0.05] text-white' : 'bg-[#23c7be] text-[#071211] hover:bg-[#35d8cf]'}`}>{owned ? <><Download size={15} /> Download</> : <><ShoppingCart size={15} /> Buy · {asset.price_credits} credits</>}</button>
            </div>
          </article>;
        })}</div>
        : <div className="flex min-h-[360px] items-center justify-center rounded-[4px] border border-dashed border-white/15 bg-[#17191d]"><div className="max-w-xl px-8 text-center"><Icon size={42} className="mx-auto mb-4 text-[#23c7be]/45" /><p className="text-lg font-black text-white">{assets.length ? 'No assets match these filters' : 'No 3D assets published yet'}</p><p className="mt-2 text-sm text-white/40">{assets.length ? 'Change the search, category or subcategory.' : 'Published 3D products from the AI Stage One library will appear here.'}</p></div></div>}
      </div>

      {galleryAsset && galleryImages.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 top-14 z-[7000] flex items-center justify-center bg-black/90 p-3 md:p-5" onClick={() => setGalleryAsset(null)}>
          <div className="relative flex h-full max-h-[calc(100vh-5rem)] w-full max-w-[1100px] flex-col overflow-hidden rounded-[4px] border border-white/15 bg-[#17191d]" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/10 px-4">
              <div className="min-w-0"><div className="truncate font-black text-white">{galleryAsset.name}</div><div className="text-[11px] text-white/40">Image {galleryIndex + 1} of {galleryImages.length}</div></div>
              <button type="button" onClick={() => setGalleryAsset(null)} className="flex h-9 w-9 items-center justify-center border border-white/15 bg-white/[0.03] text-white hover:bg-white/10" aria-label="Close gallery"><X size={19} /></button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[#101214] p-4 md:p-6 lg:p-8">
              <img src={galleryImages[galleryIndex]} alt={`${galleryAsset.name || '3D asset'} ${galleryIndex + 1}`} className="block max-h-full max-w-full object-contain" />
              {galleryImages.length > 1 && <>
                <button type="button" onClick={() => setGalleryIndex((index) => (index - 1 + galleryImages.length) % galleryImages.length)} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/70 text-white hover:bg-black" aria-label="Previous image"><ChevronLeft size={25} /></button>
                <button type="button" onClick={() => setGalleryIndex((index) => (index + 1) % galleryImages.length)} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/70 text-white hover:bg-black" aria-label="Next image"><ChevronRight size={25} /></button>
              </>}
            </div>

            {galleryImages.length > 1 && <div className="flex flex-shrink-0 gap-2 overflow-x-auto border-t border-white/10 bg-[#17191d] p-3">{galleryImages.map((url, index) => <button key={`${url}-${index}`} type="button" onClick={() => setGalleryIndex(index)} className={`h-16 w-20 flex-shrink-0 overflow-hidden border ${index === galleryIndex ? 'border-[#23c7be]' : 'border-white/10 opacity-65 hover:opacity-100'}`} aria-label={`Open image ${index + 1}`}><img src={url} alt="" className="h-full w-full object-cover" /></button>)}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function ThreeDModelPreview({ url }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = canvasRef.current;
    if (!element || !url) return undefined;
    let disposed = false;
    let renderer;
    let frame;
    let controls;
    let resize;
    let scene;
    (async () => {
      try {
        const THREE = await import('three');
        const [{ GLTFLoader }, { OrbitControls }] = await Promise.all([
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/controls/OrbitControls.js'),
        ]);
        if (disposed) return;
        scene = new THREE.Scene();
        scene.background = new THREE.Color('#1d2126');
        const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        element.appendChild(renderer.domElement);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        scene.add(new THREE.HemisphereLight('#ffffff', '#666666', 2.5));
        const key = new THREE.DirectionalLight('#ffffff', 3);
        key.position.set(3, 5, 4);
        scene.add(key);
        new GLTFLoader().load(url, (gltf) => {
          if (disposed) return;
          scene.add(gltf.scene);
          const bounds = new THREE.Box3().setFromObject(gltf.scene);
          if (bounds.isEmpty()) { setError('The model has no renderable geometry.'); return; }
          const size = bounds.getSize(new THREE.Vector3());
          const center = bounds.getCenter(new THREE.Vector3());
          const max = Math.max(size.x, size.y, size.z, 0.1);
          controls.target.copy(center);
          camera.position.copy(center.clone().add(new THREE.Vector3(max * 1.5, max * 1.1, max * 2.2)));
          camera.near = max / 1000;
          camera.far = max * 1000;
          camera.updateProjectionMatrix();
          controls.update();
        }, undefined, (loadError) => {
          if (!disposed) setError(loadError?.message || 'Unable to load the GLB preview. Download the file instead.');
        });
        resize = () => {
          if (!renderer || !element) return;
          const width = element.clientWidth || 640, height = element.clientHeight || 480;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        resize();
        window.addEventListener('resize', resize);
        const draw = () => {
          if (disposed) return;
          controls.update();
          renderer.render(scene, camera);
          frame = requestAnimationFrame(draw);
        };
        draw();
      } catch (failure) {
        if (!disposed) setError(failure?.message || '3D viewer could not start.');
      }
    })();
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      if (resize) window.removeEventListener('resize', resize);
      controls?.dispose();
      if (scene) scene.traverse((item) => {
        item.geometry?.dispose?.();
        if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach((material) => material.dispose?.());
      });
      renderer?.dispose();
      renderer?.domElement?.remove();
    };
  }, [url]);
  return <div className="relative h-full min-h-[420px] w-full">
    <div ref={canvasRef} className="absolute inset-0" />
    {error && <p role="alert" className="absolute bottom-3 left-3 right-3 rounded bg-black/80 p-3 text-xs text-red-200">{error}</p>}
  </div>;
}

function Generate3D() {
  const [generationType, setGenerationType] = useState('text');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelError, setModelError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState([null, null, null, null]);
  const [progress, setProgress] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [glbUrl, setGlbUrl] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingModels(true);
      setModelError('');
      const { data, error } = await supabase.rpc('studio_enabled_3d_models');
      if (!mounted) return;
      if (error) {
        setModels([]);
        setSelectedModel('');
        setModelError(error.message || 'Unable to load 3D models.');
      } else {
        const rows = data || [];
        setModels(rows);
        const preferred = rows.find((row) => row.recommended) || rows[0];
        setSelectedModel(preferred?.model_key || '');
      }
      setLoadingModels(false);
    })();
    return () => { mounted = false; };
  }, []);

  const mode = useMemo(() => GENERATION_TYPES.find((item) => item.key === generationType), [generationType]);
  const selected = useMemo(() => models.find((item) => item.model_key === selectedModel) || null, [models, selectedModel]);
  const enabledForMode = useMemo(() => models.filter((item) => {
    const inputs = item.capabilities?.inputs || [];
    if (generationType === 'text') return inputs.includes('text');
    if (generationType === 'image') return inputs.includes('image');
    if (generationType === 'multi') return inputs.includes('multi_image');
    return true;
  }), [models, generationType]);

  useEffect(() => {
    if (!enabledForMode.some((item) => item.model_key === selectedModel)) {
      const preferred = enabledForMode.find((item) => item.recommended) || enabledForMode[0];
      setSelectedModel(preferred?.model_key || '');
    }
  }, [generationType, enabledForMode, selectedModel]);

  const addImage = (index, file) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3_750_000) {
      setGenerationError('Use PNG, JPG or WebP images smaller than 3.75 MB.');
      return;
    }
    setGenerationError('');
    const reader = new FileReader();
    reader.onload = () => setImages((old) => old.map((item, position) => position === index ? reader.result : item));
    reader.onerror = () => setGenerationError('Unable to read reference image.');
    reader.readAsDataURL(file);
  };

  const generate = async () => {
    if (!selected || generating) return;
    setGenerating(true);
    setGenerationError('');
    setGlbUrl('');
    setProgress('Submitting generation…');
    try {
      const { data: started, error: startError } = await supabase.functions.invoke('generate-3d', {
        body: {
          action: 'start',
          mode: generationType,
          model_key: selectedModel,
          prompt,
          images: generationType === 'multi' ? images : generationType === 'image' ? [images[0]] : [],
        },
      });
      if (startError || started?.error || !started?.job) {
        const details = startError?.context?.json ? await startError.context.json().catch(() => null) : null;
        throw new Error(started?.error || details?.error || startError?.message || '3D generation failed to start.');
      }
      for (let attempt = 0; attempt < 180; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const { data: result, error } = await supabase.functions.invoke('generate-3d', {
          body: { action: 'status', job: started.job },
        });
        if (error || result?.error) {
          const details = error?.context?.json ? await error.context.json().catch(() => null) : null;
          throw new Error(result?.error || details?.error || error?.message);
        }
        setProgress(result?.status === 'starting' ? 'Waiting for the 3D model…' : 'Generating 3D model…');
        if (result?.status === 'succeeded') {
          if (!result.glb_url) throw new Error('The provider completed without a GLB file. No preview is available.');
          setGlbUrl(result.glb_url);
          setProgress('3D model generated');
          return;
        }
        if (['failed', 'canceled'].includes(result?.status)) throw new Error('Generation ' + result.status);
      }
      throw new Error('Generation is still running. Please retry later.');
    } catch (error) {
      setGenerationError(error?.message || 'Generation failed.');
      setProgress('');
    } finally {
      setGenerating(false);
    }
  };

  const ready = !!selected && !generating && (
    generationType === 'text' ? !!prompt.trim() : !!images[0]
  );

  const imageBox = (label, index) => <div key={label} className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[3px] border border-dashed border-white/15 bg-black/20 text-center xl:aspect-auto xl:h-[90px]">
    {images[index] && <img src={images[index]} alt={label + ' reference'} className="absolute inset-0 h-full w-full object-contain" />}
    <label className={`relative z-10 flex h-full w-full cursor-pointer flex-col items-center justify-center ${images[index] ? 'bg-black/35 text-white' : ''}`}>
      <Upload size={18} className="mb-1 text-[#23c7be]" />
      <span className="text-xs font-bold">{images[index] ? label + ' · Change' : label}</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { addImage(index, event.target.files?.[0]); event.target.value = ''; }} />
    </label>
    {images[index] && <button type="button" aria-label={'Remove ' + label} onClick={() => setImages((old) => old.map((item, position) => position === index ? null : item))} className="absolute right-1 top-1 z-20 rounded bg-black/85 p-1 text-white"><X size={14} /></button>}
  </div>;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#202328] pb-24 text-white xl:pb-4">
      <div className="mx-auto flex max-w-[1600px] flex-col p-3 md:p-4 xl:max-w-none xl:p-3">
        <div className="mb-4 flex flex-shrink-0 items-start gap-3 border-b border-white/10 pb-4 xl:mb-2 xl:items-center xl:gap-2 xl:pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be] xl:h-8 xl:w-8"><Box size={20} /></div>
          <div><p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#23c7be]">AISTAGE.ONE · 3D Studio</p><h1 className="text-2xl font-black tracking-tight md:text-3xl xl:text-lg">Generate 3D</h1><p className="mt-1 text-xs text-white/45 md:text-sm xl:mt-0 xl:text-[11px]">One workspace for every 3D engine you enable in Admin.</p></div>
        </div>

        <div className="grid grid-cols-1 rounded-[4px] border border-white/10 bg-[#17191d] xl:grid-cols-[225px_minmax(0,1fr)_225px]">
          <aside className="border-b border-white/10 bg-[#17191d] p-3 xl:border-b-0 xl:border-r xl:p-2">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Input</p>
            <div className="space-y-2 xl:space-y-1">
              {GENERATION_TYPES.map((item) => {
                const Icon = item.icon;
                const active = item.key === generationType;
                return <button key={item.key} type="button" onClick={() => setGenerationType(item.key)} className={`flex min-h-[52px] w-full items-center gap-3 rounded-[3px] border px-3 text-left transition-colors xl:min-h-[38px] xl:gap-2 xl:px-2 ${active ? 'border-[#23c7be]/40 bg-[#23c7be]/12 text-[#8ee9e4]' : 'border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.07]'}`}><Icon size={18} /><div><div className="text-sm font-bold xl:text-xs">{item.label}</div><div className={`mt-0.5 text-[10px] xl:hidden ${active ? 'text-[#8ee9e4]/70' : 'text-white/40'}`}>{item.hint}</div></div></button>;
              })}
            </div>

            <div className="mt-4 border-t border-white/10 pt-4 xl:mt-2 xl:pt-2">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-white/40">AI model</label>
              {loadingModels ? <div className="rounded-[3px] border border-white/10 bg-black/25 px-3 py-3 text-sm text-white/50">Loading enabled 3D models…</div>
              : enabledForMode.length ? <div className="relative"><select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="w-full appearance-none rounded-[3px] border border-white/15 bg-black/25 px-3 py-3 pr-9 text-sm font-semibold text-white outline-none focus:border-[#23c7be] xl:px-2 xl:py-2 xl:pr-7 xl:text-xs">{enabledForMode.map((item) => <option key={item.model_key} value={item.model_key}>{item.recommended ? 'Recommended · ' : ''}{item.name}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/45" /></div>
              : <div className="rounded-[3px] border border-white/10 bg-black/25 px-3 py-3"><div className="text-sm font-semibold">No enabled model for this input</div><div className="mt-1 text-[11px] text-white/40">Activate a compatible 3D model in Admin.</div></div>}
              {selected && <div className="mt-2 text-[11px] text-white/40 xl:mt-1 xl:text-[10px] xl:leading-tight">{selected.description}</div>}
              {modelError && <div className="mt-2 text-[11px] text-red-300">{modelError}</div>}
            </div>

            <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="mt-4 flex min-h-[42px] w-full items-center justify-between rounded-[3px] border border-white/10 bg-white/[0.03] px-3 text-sm font-semibold text-white/70 hover:bg-white/[0.06] xl:mt-2 xl:min-h-[34px] xl:px-2 xl:text-xs"><span className="flex items-center gap-2"><SlidersHorizontal size={16} /> Advanced settings</span><span>{showAdvanced ? '−' : '+'}</span></button>
            {showAdvanced && <div className="mt-3 space-y-2 text-xs">{(selected?.capabilities?.features || []).length ? (selected.capabilities.features || []).map((feature) => <div key={feature} className="rounded-[3px] border border-white/10 bg-white/[0.02] p-3"><div className="mb-1 text-white/35">Capability</div><div className="font-semibold">{String(feature).replaceAll('_', ' ')}</div></div>) : <div className="rounded-[3px] border border-white/10 p-3 text-white/45">Model-specific controls will appear here.</div>}</div>}
          </aside>

          <section className="flex min-w-0 flex-col bg-[#202328] p-3 md:p-4 xl:p-2">
            <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[4px] border border-white/10 bg-[#1d2126] md:min-h-[520px] xl:min-h-[360px] xl:h-[min(58vh,520px)]">
              {glbUrl ? <ThreeDModelPreview url={glbUrl} /> : <>
                <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
                <div className="relative px-8 text-center"><div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[3px] border border-[#23c7be]/30 bg-[#23c7be]/10 text-[#23c7be] xl:mb-2 xl:h-12 xl:w-12"><Box size={28} strokeWidth={1.4} /></div><p className="text-lg font-black text-white xl:text-sm">3D Preview Workspace</p><p className="mx-auto mt-2 max-w-md text-sm text-white/40 xl:mt-1 xl:max-w-xs xl:text-xs">{progress || 'Generated GLB models will appear here with orbit, zoom and inspection controls.'}</p></div>
              </>}
            </div>
            {glbUrl && <a href={glbUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 self-start rounded border border-[#23c7be]/40 px-3 py-2 text-xs font-bold text-[#23c7be]"><Download size={16} /> Download generated GLB</a>}

            <div className="mt-3 rounded-[4px] border border-white/10 bg-[#17191d] p-3 xl:mt-2 xl:p-2">
              {generationType === 'text' && <><label className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Prompt</label><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-2 min-h-[86px] w-full rounded-[3px] border border-white/15 bg-black/25 p-3 text-white outline-none placeholder:text-white/25 focus:border-[#23c7be] xl:mt-1 xl:min-h-[56px] xl:p-2 xl:text-xs" placeholder="Describe the 3D character, accessory, prop or environment…" /></>}
              {generationType === 'image' && imageBox('Add reference image', 0)}
              {generationType === 'multi' && <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:gap-2">{['Front', 'Back', 'Left', 'Right'].map((side, index) => imageBox(side, index))}</div>}
            </div>
          </section>

          <aside className="border-t border-white/10 bg-[#17191d] p-3 xl:border-l xl:border-t-0 xl:p-2">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/40 xl:mb-2">Output</p>
            <div className="space-y-2">
              {[['AI model', selected?.name || 'None enabled'], ['Input mode', mode?.label], ['Primary working format', 'GLB'], ['Storage destination', 'Download GLB'], ['Price', selected?.credit_cost != null ? `${selected.credit_cost} credits` : 'Calculated from Admin model settings']].map(([label, value]) => <div key={label} className="rounded-[3px] border border-white/10 bg-black/20 p-3 xl:px-2 xl:py-1.5"><div className="text-[11px] text-white/35">{label}</div><div className="mt-1 text-sm font-bold text-white xl:mt-0 xl:text-xs">{value}</div></div>)}
            </div>
            <button type="button" disabled={!ready} onClick={generate} className="mt-4 min-h-[48px] w-full rounded-[3px] bg-[#23c7be] text-xs font-black uppercase tracking-[0.12em] text-[#071211] hover:bg-[#35d8cf] disabled:bg-white/[0.05] disabled:text-white/30 disabled:cursor-not-allowed xl:mt-2 xl:min-h-[38px] xl:text-[11px]">{generating ? 'Generating 3D…' : 'Generate 3D'}</button>
            {progress && <p role="status" className="mt-2 text-xs text-[#23c7be]">{progress}</p>}
            {generationError && <p role="alert" className="mt-2 text-xs text-red-300">{generationError}</p>}
            {!selected && <p className="mt-2 text-[11px] text-white/35">Generation activates when you enable at least one compatible 3D model in Admin.</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function ThreeDStudio({ mode = 'generate_3d' }) {
  if (mode === 'generate_3d') return <Generate3D />;
  if (mode === 'three_d_shop') return <LibraryCatalog title="3D Shop" description="Browse all 3D characters, clothing, accessories, props and sets in one catalog." icon={ShoppingBag} assetTypes={['character', 'clothing', 'accessory', 'prop', 'set']} />;
  return <LibraryCatalog title="My 3D Assets" description="3D products already purchased by this member." icon={FolderOpen} assetTypes={['character', 'clothing', 'accessory', 'prop', 'set']} />;
}