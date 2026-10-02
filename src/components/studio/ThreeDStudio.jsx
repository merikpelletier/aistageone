import React, { useEffect, useMemo, useState } from 'react';
import { Box, Users, ShoppingBag, FolderOpen, Layers, Sparkles, Upload, Image as ImageIcon, Type, Grid3X3, SlidersHorizontal, ChevronDown, Search, Tag, Download, ShoppingCart } from 'lucide-react';
import { supabase } from '@/api/base44Client';

const MODES = [
  { key: 'generate_3d', label: 'Generate 3D', icon: Sparkles },
  { key: 'characters_3d', label: 'Characters', icon: Users },
  { key: 'clothing_3d', label: 'Clothing & Accessories', icon: ShoppingBag },
  { key: 'props_3d', label: 'Props & Sets', icon: Layers },
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErrorText('');
      const [{ data: assetRows, error: assetError }, { data: categoryRows }, { data: subcategoryRows }, { data: purchaseRows }] = await Promise.all([
        supabase.from('studio_3d_asset').select('id,asset_type,category_id,subcategory_id,name,slug,description,preview_url,badges,price_credits,featured,sort_order,created_at').in('asset_type', assetTypes).eq('active', true),
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

  const availableSubcategories = useMemo(
    () => subcategories.filter((item) => !categoryId || item.category_id === categoryId),
    [subcategories, categoryId]
  );

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
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#d8d8d3] text-black p-4 md:p-6 lg:p-8">
      <div className="max-w-[1500px] mx-auto">
        <div className="mb-6">
          <div className="w-11 h-11 bg-black text-[#d5a928] flex items-center justify-center mb-4"><Icon size={22} /></div>
          <p className="text-[10px] uppercase tracking-[0.28em] font-bold text-black/45">AISTAGE.ONE · 3D Library</p>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2">{title}</h1>
          <p className="text-black/55 mt-3 max-w-3xl">{description}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_210px_210px_170px] gap-3 mb-5">
          <label className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/45 pointer-events-none" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search 3D assets…"
              className="w-full h-12 border border-black/20 bg-white/80 pl-10 pr-3 font-semibold outline-none focus:border-black"
            />
          </label>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="h-12 border border-black/20 bg-white/80 px-3 font-bold outline-none focus:border-black"
          >
            <option value="">All categories</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select
            value={subcategoryId}
            onChange={(event) => setSubcategoryId(event.target.value)}
            disabled={!availableSubcategories.length}
            className="h-12 border border-black/20 bg-white/80 px-3 font-bold outline-none focus:border-black disabled:opacity-45"
          >
            <option value="">All subcategories</option>
            {availableSubcategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-12 border border-black/20 bg-white/80 px-3 font-bold outline-none focus:border-black"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="name">Name</option>
            <option value="price_low">Price ↑</option>
            <option value="price_high">Price ↓</option>
          </select>
        </div>

        {loading ? (
          <div className="border border-black/15 bg-white/55 min-h-[360px] flex items-center justify-center font-bold text-black/50">Loading 3D library…</div>
        ) : errorText ? (
          <div className="border border-red-300 bg-red-50 p-5 font-semibold text-red-800">{errorText}</div>
        ) : filteredAssets.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredAssets.map((asset) => {
              const owned = purchases.has(asset.id);
              return (
                <article key={asset.id} className="border border-black/15 bg-white/75 overflow-hidden">
                  <div className="aspect-[4/3] bg-[#cfd0cb] relative overflow-hidden">
                    {asset.preview_url ? (
                      <img src={asset.preview_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-black/20"><Box size={52} strokeWidth={1.3} /></div>
                    )}
                    {asset.featured && <span className="absolute left-2 top-2 bg-black text-[#d5a928] px-2 py-1 text-[10px] font-black uppercase tracking-wider">Featured</span>}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-lg leading-tight">{asset.name}</h3>
                        {asset.description && <p className="mt-1 text-sm text-black/55 line-clamp-2">{asset.description}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] uppercase tracking-wider text-black/45 font-bold">Price</div>
                        <div className="font-black">{asset.price_credits} cr</div>
                      </div>
                    </div>
                    {(asset.badges || []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(asset.badges || []).map((badge) => <span key={badge} className="border border-black/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide"><Tag size={10} className="inline mr-1" />{badge}</span>)}
                      </div>
                    )}
                    <button
                      type="button"
                      className="mt-4 w-full h-11 bg-black text-white font-black text-xs uppercase tracking-[0.12em] flex items-center justify-center gap-2"
                    >
                      {owned ? <><Download size={15} /> Download</> : <><ShoppingCart size={15} /> Buy · {asset.price_credits} credits</>}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="border border-black/15 bg-white/55 min-h-[360px] flex items-center justify-center">
            <div className="text-center px-8 max-w-xl">
              <Icon size={42} className="mx-auto text-black/25 mb-4" />
              <p className="font-black text-lg">{assets.length ? 'No assets match these filters' : 'No 3D assets published yet'}</p>
              <p className="text-sm text-black/50 mt-2">{assets.length ? 'Change the search, category or subcategory.' : 'Published AISTAGE-owned 3D products will appear here.'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Generate3D() {
  const [generationType, setGenerationType] = useState('text');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelError, setModelError] = useState('');

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
  const enabledForMode = useMemo(() => {
    return models.filter((item) => {
      const inputs = item.capabilities?.inputs || [];
      if (generationType === 'text') return inputs.includes('text');
      if (generationType === 'image') return inputs.includes('image');
      if (generationType === 'multi') return inputs.includes('multi_image');
      return true;
    });
  }, [models, generationType]);

  useEffect(() => {
    if (!enabledForMode.some((item) => item.model_key === selectedModel)) {
      const preferred = enabledForMode.find((item) => item.recommended) || enabledForMode[0];
      setSelectedModel(preferred?.model_key || '');
    }
  }, [generationType, enabledForMode, selectedModel]);

  return (
    <div className="h-[calc(100vh-3.5rem)] min-h-0 bg-[#d8d8d3] text-black overflow-y-auto pb-24">
      <div className="h-full min-h-0 max-w-[1600px] mx-auto p-3 md:p-4 lg:p-5 flex flex-col">
        <div className="mb-3 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 bg-black text-[#d5a928] flex items-center justify-center"><Box size={20} /></div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.28em] font-bold text-black/45">AISTAGE.ONE · 3D Studio</p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Generate 3D</h1>
            </div>
          </div>
          <p className="text-black/55 text-xs md:text-sm">One workspace for every 3D engine you enable in Admin.</p>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_300px] border border-black/20 bg-[#eeeeea] overflow-hidden">
          <aside className="min-h-0 overflow-y-auto border-b xl:border-b-0 xl:border-r border-black/15 p-3 bg-[#1d2024] text-white">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/45 mb-2">Input</p>
            <div className="space-y-2">
              {GENERATION_TYPES.map((item) => {
                const Icon = item.icon;
                const active = item.key === generationType;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setGenerationType(item.key)}
                    className={`w-full text-left min-h-[52px] px-3 border flex items-center gap-3 transition-colors ${active ? 'border-[#d5a928] bg-[#d5a928] text-black' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'}`}
                  >
                    <Icon size={18} />
                    <div>
                      <div className="font-bold text-sm">{item.label}</div>
                      <div className={`text-[10px] mt-0.5 ${active ? 'text-black/60' : 'text-white/45'}`}>{item.hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10">
              <label className="block text-[10px] uppercase tracking-[0.2em] font-bold text-white/45 mb-2">AI model</label>
              {loadingModels ? (
                <div className="border border-white/15 bg-black/25 px-3 py-3 text-sm text-white/60">Loading enabled 3D models…</div>
              ) : enabledForMode.length ? (
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full appearance-none border border-white/15 bg-black/35 px-3 py-3 pr-9 text-sm font-semibold text-white outline-none focus:border-[#d5a928]"
                  >
                    {enabledForMode.map((item) => (
                      <option key={item.model_key} value={item.model_key}>
                        {item.recommended ? 'Recommended · ' : ''}{item.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/55" />
                </div>
              ) : (
                <div className="border border-white/15 bg-black/25 px-3 py-3">
                  <div className="font-semibold text-sm">No enabled model for this input</div>
                  <div className="text-[11px] text-white/45 mt-1">Activate a compatible 3D model in Admin.</div>
                </div>
              )}
              {selected && <div className="mt-2 text-[11px] text-white/45">{selected.description}</div>}
              {modelError && <div className="mt-2 text-[11px] text-red-300">{modelError}</div>}
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="mt-4 w-full min-h-[42px] border border-white/15 px-3 flex items-center justify-between text-sm font-semibold hover:bg-white/[0.06]"
            >
              <span className="flex items-center gap-2"><SlidersHorizontal size={16} /> Advanced settings</span>
              <span>{showAdvanced ? '−' : '+'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-2 text-xs">
                {(selected?.capabilities?.features || []).length ? (
                  (selected.capabilities.features || []).map((feature) => (
                    <div key={feature} className="border border-white/10 p-3">
                      <div className="text-white/45 mb-1">Capability</div>
                      <div className="font-semibold">{String(feature).replaceAll('_', ' ')}</div>
                    </div>
                  ))
                ) : (
                  <div className="border border-white/10 p-3 text-white/55">Model-specific controls will appear here.</div>
                )}
              </div>
            )}
          </aside>

          <section className="min-w-0 min-h-0 p-3 md:p-4 flex flex-col overflow-y-auto">
            <div className="flex-1 min-h-[320px] border border-black/15 bg-[#cfd0cb] relative flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
              <div className="relative text-center px-8">
                <div className="w-20 h-20 border border-black/20 bg-black text-[#d5a928] flex items-center justify-center mx-auto mb-4">
                  <Box size={40} strokeWidth={1.4} />
                </div>
                <p className="text-lg font-black">3D Preview Workspace</p>
                <p className="text-sm text-black/50 mt-2 max-w-md">Generated GLB models will appear here with orbit, zoom and inspection controls.</p>
              </div>
            </div>

            <div className="mt-3 border border-black/15 bg-white/60 p-3 flex-shrink-0">
              {generationType === 'text' && (
                <>
                  <label className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/50">Prompt</label>
                  <textarea className="mt-2 w-full min-h-[86px] border border-black/20 bg-white p-3 outline-none focus:border-black" placeholder="Describe the 3D character, accessory, prop or environment…" />
                </>
              )}
              {generationType === 'image' && (
                <div className="min-h-[96px] border border-dashed border-black/25 flex items-center justify-center text-center p-4">
                  <div><Upload size={24} className="mx-auto mb-2" /><div className="font-bold">Add reference image</div><div className="text-xs text-black/45 mt-1">The active engine determines supported image formats.</div></div>
                </div>
              )}
              {generationType === 'multi' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {['Front', 'Back', 'Left', 'Right'].map((side) => (
                    <div key={side} className="aspect-[4/3] border border-dashed border-black/25 flex items-center justify-center text-center">
                      <div><Upload size={18} className="mx-auto mb-1" /><div className="text-xs font-bold">{side}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="min-h-0 overflow-y-auto border-t xl:border-t-0 xl:border-l border-black/15 bg-white/65 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-black/45 mb-3">Output</p>
            <div className="space-y-2">
              <div className="border border-black/15 p-3">
                <div className="text-[11px] text-black/45">AI model</div>
                <div className="font-bold text-sm mt-1">{selected?.name || 'None enabled'}</div>
              </div>
              <div className="border border-black/15 p-3">
                <div className="text-[11px] text-black/45">Input mode</div>
                <div className="font-bold text-sm mt-1">{mode?.label}</div>
              </div>
              <div className="border border-black/15 p-3">
                <div className="text-[11px] text-black/45">Primary working format</div>
                <div className="font-bold text-sm mt-1">GLB</div>
              </div>
              <div className="border border-black/15 p-3">
                <div className="text-[11px] text-black/45">Storage destination</div>
                <div className="font-bold text-sm mt-1">My 3D Assets</div>
              </div>
              <div className="border border-black/15 p-3">
                <div className="text-[11px] text-black/45">Price</div>
                <div className="font-bold text-sm mt-1">
                  {selected?.credit_cost != null ? `${selected.credit_cost} credits` : 'Calculated from Admin model settings'}
                </div>
              </div>
            </div>
            <button disabled={!selected} className="mt-4 w-full min-h-[48px] bg-black text-white font-black uppercase tracking-[0.12em] text-xs disabled:opacity-45 disabled:cursor-not-allowed">
              Generate 3D
            </button>
            {!selected && <p className="text-[11px] text-black/45 mt-2">Generation activates when you enable at least one compatible 3D model in Admin.</p>}
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function ThreeDStudio({ mode = 'generate_3d' }) {
  if (mode === 'generate_3d') return <Generate3D />;
  if (mode === 'characters_3d') return <LibraryCatalog title="Characters" description="AISTAGE-owned premium 3D characters, prepared for Studio workflows." icon={Users} assetTypes={['character']} />;
  if (mode === 'clothing_3d') return <LibraryCatalog title="Clothing & Accessories" description="Wardrobe and accessories sold directly by AISTAGE.ONE." icon={ShoppingBag} assetTypes={['clothing', 'accessory']} />;
  if (mode === 'props_3d') return <LibraryCatalog title="Props & Sets" description="Props, furniture, environments and set pieces from the AISTAGE 3D library." icon={Layers} assetTypes={['prop', 'set']} />;
  return <LibraryCatalog title="My 3D Assets" description="3D products already purchased by this member." icon={FolderOpen} assetTypes={['character', 'clothing', 'accessory', 'prop', 'set']} />;
}
