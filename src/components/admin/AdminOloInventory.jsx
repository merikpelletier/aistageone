import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Boxes,
  CheckCircle2,
  Edit2,
  Eye,
  FolderTree,
  Loader2,
  PackagePlus,
  Search,
  ShieldCheck,
  Star,
  Upload,
} from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AdminOloTaxonomyManager from '@/components/admin/AdminOloTaxonomyManager';

const EMPTY_ASSET = {
  title: '',
  creator_name: '',
  description: '',
  original_language: 'fr',
  category_id: null,
  subcategory_id: null,
  tags: [],
  preview_images: [],
  featured_image: '',
  download_price: null,
  credit_cost: null,
  credit_cost_influencer: null,
  credit_cost_production: null,
  credit_cost_brands: null,
  required_tier: '',
  status: 'draft',
  license_code: '',
  admin_comments: '',
  is_featured: false,
  rights_confirmed: false,
};

const STATUS_LABELS = {
  draft: 'Brouillon',
  review: 'À réviser',
  published: 'Publié',
  archived: 'Archivé',
  rejected: 'Refusé',
};

const STATUS_STYLES = {
  draft: 'border-zinc-600 bg-zinc-800 text-zinc-200',
  review: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  published: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  archived: 'border-zinc-700 bg-zinc-900 text-zinc-400',
  rejected: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
};

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value) {
  return String(value || '')
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function displayPrice(asset) {
  if (asset.credit_cost !== null && asset.credit_cost !== undefined) return `${asset.credit_cost} crédits`;
  if (asset.download_price !== null && asset.download_price !== undefined) return `${asset.download_price} $`;
  return 'Prix non défini';
}

function StatCard({ icon: Icon, label, value, tone = 'text-white' }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</span>
        <Icon size={17} className={tone} />
      </div>
      <div className={`mt-3 text-3xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

export default function AdminOloInventory() {
  const queryClient = useQueryClient();
  const [editingAsset, setEditingAsset] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(null);
  const [showTaxonomyManager, setShowTaxonomyManager] = useState(false);

  const { data: assets = [], isLoading, error } = useQuery({
    queryKey: ['admin-olo-inventory'],
    queryFn: async () => {
      const { data, error: inventoryError } = await supabase
        .from('catalog_asset')
        .select('*')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(1000);
      if (inventoryError) throw inventoryError;
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-olo-categories'],
    queryFn: async () => {
      const { data, error: categoryError } = await supabase
        .from('asset_category')
        .select('*')
        .order('display_order', { ascending: true });
      if (categoryError) throw categoryError;
      return data || [];
    },
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ['admin-olo-subcategories'],
    queryFn: async () => {
      const { data, error: subcategoryError } = await supabase
        .from('asset_subcategory')
        .select('*')
        .order('display_order', { ascending: true });
      if (subcategoryError) throw subcategoryError;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (asset) => {
      const payload = {
        title: asset.title.trim(),
        creator_name: asset.creator_name?.trim() || null,
        description: asset.description?.trim() || null,
        original_language: asset.original_language || 'fr',
        category_id: asset.category_id || null,
        subcategory_id: asset.subcategory_id || null,
        tags: Array.isArray(asset.tags) ? asset.tags : splitList(asset.tags),
        preview_images: Array.isArray(asset.preview_images) ? asset.preview_images : splitList(asset.preview_images),
        featured_image: asset.featured_image?.trim() || null,
        download_price: nullableNumber(asset.download_price),
        credit_cost: nullableNumber(asset.credit_cost),
        credit_cost_influencer: nullableNumber(asset.credit_cost_influencer),
        credit_cost_production: nullableNumber(asset.credit_cost_production),
        credit_cost_brands: nullableNumber(asset.credit_cost_brands),
        required_tier: asset.required_tier || null,
        status: asset.status || 'draft',
        license_code: asset.license_code?.trim() || null,
        admin_comments: asset.admin_comments?.trim() || null,
        is_featured: Boolean(asset.is_featured),
        rights_confirmed: Boolean(asset.rights_confirmed),
        updated_at: new Date().toISOString(),
      };

      if (!payload.title) throw new Error('Le titre est obligatoire.');
      if (payload.status === 'published' && !payload.rights_confirmed) {
        throw new Error('Les droits doivent être confirmés avant la publication.');
      }

      const query = asset.id
        ? supabase.from('catalog_asset').update(payload).eq('id', asset.id)
        : supabase.from('catalog_asset').insert(payload);
      const { data, error: saveError } = await query.select('*').single();
      if (saveError) throw saveError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-olo-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['olo-catalog-assets'] });
      setEditingAsset(null);
      setErrorMessage('');
    },
    onError: (mutationError) => setErrorMessage(mutationError.message || 'Impossible d’enregistrer cet actif.'),
  });

  const archiveMutation = useMutation({
    mutationFn: async (asset) => {
      const { error: archiveError } = await supabase
        .from('catalog_asset')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', asset.id);
      if (archiveError) throw archiveError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-olo-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['olo-catalog-assets'] });
    },
    onError: (mutationError) => setErrorMessage(mutationError.message || 'Impossible d’archiver cet actif.'),
  });

  const filteredAssets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (statusFilter !== 'all' && asset.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && asset.category_id !== categoryFilter) return false;
      if (!term) return true;
      return [asset.title, asset.creator_name, asset.description, ...(Array.isArray(asset.tags) ? asset.tags : [])]
        .some((value) => String(value || '').toLowerCase().includes(term));
    });
  }, [assets, categoryFilter, search, statusFilter]);

  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item])), [categories]);
  const availableSubcategories = subcategories.filter((item) => !editingAsset?.category_id || item.category_id === editingAsset.category_id);
  const publishedCount = assets.filter((asset) => asset.status === 'published').length;
  const reviewCount = assets.filter((asset) => asset.status === 'review').length;
  const incompleteCount = assets.filter((asset) => !asset.category_id || (!asset.credit_cost && !asset.download_price)).length;

  const openEditor = (asset = EMPTY_ASSET) => {
    setErrorMessage('');
    setEditingAsset({
      ...EMPTY_ASSET,
      ...asset,
      tags: Array.isArray(asset.tags) ? asset.tags.join(', ') : '',
      preview_images: Array.isArray(asset.preview_images) ? asset.preview_images.join('\n') : '',
    });
  };

  const uploadImages = async (event, destination) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setErrorMessage('');
    setUploadingImage(destination);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError || new Error('Connexion administrateur requise.');

      const uploadedUrls = [];
      for (const file of files) {
        const extension = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
        const objectPath = `${authData.user.id}/oloshop/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(objectPath, file, {
          cacheControl: '3600',
          contentType: file.type || undefined,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from('media').getPublicUrl(objectPath);
        uploadedUrls.push(publicData.publicUrl);
      }

      setEditingAsset((current) => {
        if (!current) return current;
        if (destination === 'featured') return { ...current, featured_image: uploadedUrls[0] };
        const existing = splitList(current.preview_images);
        return { ...current, preview_images: [...existing, ...uploadedUrls].join('\n') };
      });
    } catch (uploadError) {
      setErrorMessage(uploadError.message || 'Impossible de téléverser cette image.');
    } finally {
      setUploadingImage(null);
    }
  };

  return (
    <div className="text-white">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            <Boxes size={16} /> OLOSHOP
          </div>
          <h2 className="text-3xl font-black tracking-tight">Gestionnaire d’inventaire</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">Gérez les actifs visibles dans OLOSHOP, leur classement, leur prix et leur état de publication.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowTaxonomyManager(true)} className="border-cyan-400/30 bg-cyan-400/10 font-black text-cyan-100 hover:bg-cyan-400/20">
            <FolderTree size={17} className="mr-2" /> Catégories
          </Button>
          <Button onClick={() => openEditor()} className="bg-cyan-400 font-black text-black hover:bg-cyan-300">
            <PackagePlus size={17} className="mr-2" /> Nouvel actif
          </Button>
        </div>
      </div>

      <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Boxes} label="Actifs" value={assets.length} tone="text-cyan-300" />
        <StatCard icon={CheckCircle2} label="Publiés" value={publishedCount} tone="text-emerald-300" />
        <StatCard icon={Eye} label="À réviser" value={reviewCount} tone="text-amber-300" />
        <StatCard icon={ShieldCheck} label="À compléter" value={incompleteCount} tone="text-rose-300" />
      </div>

      <div className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-zinc-950 p-4 md:grid-cols-[minmax(0,1fr)_220px_240px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={17} />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un actif, un créateur ou un tag" className="border-white/10 bg-zinc-900 pl-10 text-white" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="border-white/10 bg-zinc-900 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les états</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="border-white/10 bg-zinc-900 text-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.label_fr || category.label_en}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {(error || errorMessage) && <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{errorMessage || error.message}</div>}

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-300" size={34} /></div>
      ) : filteredAssets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 py-20 text-center text-zinc-500">Aucun actif ne correspond aux filtres.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="hidden grid-cols-[72px_minmax(220px,1.4fr)_minmax(140px,.8fr)_130px_120px_120px] gap-4 bg-zinc-900 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 lg:grid">
            <span>Aperçu</span><span>Actif</span><span>Catégorie</span><span>Prix</span><span>État</span><span>Actions</span>
          </div>
          <div className="divide-y divide-white/10">
            {filteredAssets.map((asset) => {
              const category = categoryMap.get(asset.category_id);
              const image = asset.featured_image || asset.preview_images?.[0];
              return (
                <div key={asset.id} className="grid gap-4 bg-zinc-950 p-4 transition hover:bg-zinc-900/80 lg:grid-cols-[72px_minmax(220px,1.4fr)_minmax(140px,.8fr)_130px_120px_120px] lg:items-center">
                  <div className="h-16 w-16 overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
                    {image ? <img src={image} alt="" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center"><Boxes size={22} className="text-zinc-700" /></div>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-bold">{asset.title}</h3>
                      {asset.is_featured && <Star size={14} className="shrink-0 fill-amber-300 text-amber-300" />}
                    </div>
                    <p className="mt-1 truncate text-sm text-zinc-500">{asset.creator_name || 'Créateur non indiqué'}</p>
                  </div>
                  <div className="text-sm text-zinc-300">{category?.label_fr || category?.label_en || 'Non classé'}</div>
                  <div className="text-sm font-bold text-cyan-200">{displayPrice(asset)}</div>
                  <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[asset.status] || STATUS_STYLES.draft}`}>{STATUS_LABELS[asset.status] || asset.status}</span></div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditor(asset)} className="text-zinc-300 hover:text-white"><Edit2 size={17} /></Button>
                    {asset.status !== 'archived' && <Button variant="ghost" size="icon" onClick={() => archiveMutation.mutate(asset)} disabled={archiveMutation.isPending} className="text-zinc-500 hover:text-amber-300"><Archive size={17} /></Button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={Boolean(editingAsset)} onOpenChange={(open) => { if (!open) setEditingAsset(null); }}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-white/10 bg-zinc-950 text-white">
          <DialogHeader><DialogTitle>{editingAsset?.id ? 'Modifier l’actif' : 'Ajouter un actif à OLOSHOP'}</DialogTitle></DialogHeader>
          {editingAsset && (
            <div className="mt-3 space-y-6">
              <section className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Titre *</label><Input value={editingAsset.title} onChange={(event) => setEditingAsset({ ...editingAsset, title: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Créateur</label><Input value={editingAsset.creator_name || ''} onChange={(event) => setEditingAsset({ ...editingAsset, creator_name: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Langue originale</label><Input value={editingAsset.original_language || 'fr'} onChange={(event) => setEditingAsset({ ...editingAsset, original_language: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div className="md:col-span-2"><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Description</label><Textarea rows={4} value={editingAsset.description || ''} onChange={(event) => setEditingAsset({ ...editingAsset, description: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Catégorie</label><Select value={editingAsset.category_id || 'none'} onValueChange={(value) => setEditingAsset({ ...editingAsset, category_id: value === 'none' ? null : value, subcategory_id: null })}><SelectTrigger className="border-white/10 bg-zinc-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Non classé</SelectItem>{categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.label_fr || item.label_en}</SelectItem>)}</SelectContent></Select></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Sous-catégorie</label><Select value={editingAsset.subcategory_id || 'none'} onValueChange={(value) => setEditingAsset({ ...editingAsset, subcategory_id: value === 'none' ? null : value })}><SelectTrigger className="border-white/10 bg-zinc-900"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Aucune</SelectItem>{availableSubcategories.map((item) => <SelectItem key={item.id} value={item.id}>{item.label_fr || item.label_en}</SelectItem>)}</SelectContent></Select></div>
                <div className="md:col-span-2"><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Tags, séparés par des virgules</label><Input value={editingAsset.tags || ''} onChange={(event) => setEditingAsset({ ...editingAsset, tags: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
              </section>

              <section className="grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Image principale</label>
                  <Input value={editingAsset.featured_image || ''} onChange={(event) => setEditingAsset({ ...editingAsset, featured_image: event.target.value })} placeholder="https://…" className="border-white/10 bg-zinc-900" />
                  <label className="mt-2 block">
                    <input type="file" accept="image/*" onChange={(event) => uploadImages(event, 'featured')} className="hidden" disabled={Boolean(uploadingImage)} />
                    <Button type="button" variant="outline" className="w-full border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20" disabled={Boolean(uploadingImage)} asChild>
                      <span>{uploadingImage === 'featured' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />} Téléverser l’image principale</span>
                    </Button>
                  </label>
                  {editingAsset.featured_image && <img src={editingAsset.featured_image} alt="Aperçu principal" className="mt-3 h-32 w-full rounded-lg border border-white/10 bg-black object-contain" />}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Images d’aperçu, une URL par ligne</label>
                  <Textarea rows={3} value={editingAsset.preview_images || ''} onChange={(event) => setEditingAsset({ ...editingAsset, preview_images: event.target.value })} className="border-white/10 bg-zinc-900" />
                  <label className="mt-2 block">
                    <input type="file" accept="image/*" multiple onChange={(event) => uploadImages(event, 'previews')} className="hidden" disabled={Boolean(uploadingImage)} />
                    <Button type="button" variant="outline" className="w-full border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20" disabled={Boolean(uploadingImage)} asChild>
                      <span>{uploadingImage === 'previews' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />} Ajouter des images d’aperçu</span>
                    </Button>
                  </label>
                  {splitList(editingAsset.preview_images).length > 0 && <div className="mt-3 grid grid-cols-4 gap-2">{splitList(editingAsset.preview_images).slice(0, 8).map((url) => <img key={url} src={url} alt="" className="h-16 w-full rounded border border-white/10 bg-black object-contain" />)}</div>}
                </div>
              </section>

              <section className="grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2 lg:grid-cols-3">
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Crédits généraux</label><Input type="number" min="0" value={editingAsset.credit_cost ?? ''} onChange={(event) => setEditingAsset({ ...editingAsset, credit_cost: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Prix téléchargement ($)</label><Input type="number" min="0" step="0.01" value={editingAsset.download_price ?? ''} onChange={(event) => setEditingAsset({ ...editingAsset, download_price: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Niveau requis</label><Input value={editingAsset.required_tier || ''} onChange={(event) => setEditingAsset({ ...editingAsset, required_tier: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Crédits influenceur</label><Input type="number" min="0" value={editingAsset.credit_cost_influencer ?? ''} onChange={(event) => setEditingAsset({ ...editingAsset, credit_cost_influencer: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Crédits production</label><Input type="number" min="0" value={editingAsset.credit_cost_production ?? ''} onChange={(event) => setEditingAsset({ ...editingAsset, credit_cost_production: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Crédits marques</label><Input type="number" min="0" value={editingAsset.credit_cost_brands ?? ''} onChange={(event) => setEditingAsset({ ...editingAsset, credit_cost_brands: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
              </section>

              <section className="grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">État</label><Select value={editingAsset.status || 'draft'} onValueChange={(value) => setEditingAsset({ ...editingAsset, status: value })}><SelectTrigger className="border-white/10 bg-zinc-900"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Code de licence</label><Input value={editingAsset.license_code || ''} onChange={(event) => setEditingAsset({ ...editingAsset, license_code: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900 p-4"><div><div className="font-bold">Droits confirmés</div><div className="text-xs text-zinc-500">Obligatoire pour publier</div></div><Switch checked={Boolean(editingAsset.rights_confirmed)} onCheckedChange={(checked) => setEditingAsset({ ...editingAsset, rights_confirmed: checked })} /></div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900 p-4"><div><div className="font-bold">Mis en vedette</div><div className="text-xs text-zinc-500">Accent visuel dans OLOSHOP</div></div><Switch checked={Boolean(editingAsset.is_featured)} onCheckedChange={(checked) => setEditingAsset({ ...editingAsset, is_featured: checked })} /></div>
                <div className="md:col-span-2"><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">Notes administratives</label><Textarea rows={3} value={editingAsset.admin_comments || ''} onChange={(event) => setEditingAsset({ ...editingAsset, admin_comments: event.target.value })} className="border-white/10 bg-zinc-900" /></div>
              </section>

              {errorMessage && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{errorMessage}</div>}
              <div className="flex justify-end gap-3 border-t border-white/10 pt-5">
                <Button variant="outline" onClick={() => setEditingAsset(null)} className="border-white/20">Annuler</Button>
                <Button onClick={() => saveMutation.mutate(editingAsset)} disabled={saveMutation.isPending} className="bg-cyan-400 font-black text-black hover:bg-cyan-300">
                  {saveMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />} Enregistrer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AdminOloTaxonomyManager
        open={showTaxonomyManager}
        onOpenChange={setShowTaxonomyManager}
        categories={categories}
        subcategories={subcategories}
        assets={assets}
        onChanged={() => Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-olo-categories'] }),
          queryClient.invalidateQueries({ queryKey: ['admin-olo-subcategories'] }),
          queryClient.invalidateQueries({ queryKey: ['olo-asset-categories'] }),
          queryClient.invalidateQueries({ queryKey: ['olo-asset-subcategories'] }),
        ])}
      />
    </div>
  );
}
