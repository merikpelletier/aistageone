import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, FolderTree, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const slugify = (value) => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function TaxonomyRow({ item, index, total, usageCount, onSave, onMove, onToggle, onDelete }) {
  const [labelFr, setLabelFr] = useState(item.label_fr || '');
  const [labelEn, setLabelEn] = useState(item.label_en || '');

  useEffect(() => {
    setLabelFr(item.label_fr || '');
    setLabelEn(item.label_en || '');
  }, [item.id, item.label_en, item.label_fr]);

  const changed = labelFr.trim() !== item.label_fr || labelEn.trim() !== item.label_en;

  return (
    <div className="grid gap-2 rounded-lg border border-white/10 bg-zinc-900 p-3 md:grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_auto] md:items-center">
      <Input value={labelFr} onChange={(event) => setLabelFr(event.target.value)} aria-label="Nom français" placeholder="Nom français" className="border-white/10 bg-black" />
      <Input value={labelEn} onChange={(event) => setLabelEn(event.target.value)} aria-label="Nom anglais" placeholder="Nom anglais" className="border-white/10 bg-black" />
      <div className="flex flex-wrap items-center justify-end gap-1">
        <span className="mr-2 text-[10px] text-zinc-500">{usageCount} actif{usageCount === 1 ? '' : 's'}</span>
        <Button type="button" size="icon" variant="ghost" disabled={!changed || !labelFr.trim() || !labelEn.trim()} onClick={() => onSave(item, { label_fr: labelFr.trim(), label_en: labelEn.trim() })} aria-label="Enregistrer le nom"><Save size={15} /></Button>
        <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="Monter"><ArrowUp size={15} /></Button>
        <Button type="button" size="icon" variant="ghost" disabled={index === total - 1} onClick={() => onMove(index, 1)} aria-label="Descendre"><ArrowDown size={15} /></Button>
        <Switch checked={item.is_active !== false} onCheckedChange={() => onToggle(item)} aria-label={item.is_active === false ? 'Activer' : 'Désactiver'} />
        <Button type="button" size="icon" variant="ghost" onClick={() => onDelete(item, usageCount)} className="text-rose-300 hover:text-rose-200" aria-label="Supprimer"><Trash2 size={15} /></Button>
      </div>
    </div>
  );
}

export default function AdminOloTaxonomyManager({ open, onOpenChange, categories, subcategories, assets, onChanged }) {
  const [newCategory, setNewCategory] = useState({ label_fr: '', label_en: '', key: '' });
  const [newSubcategories, setNewSubcategories] = useState({});
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const orderedCategories = useMemo(() => [...categories].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)), [categories]);

  const run = async (work) => {
    setBusy(true);
    setErrorMessage('');
    try {
      await work();
      await onChanged();
    } catch (error) {
      setErrorMessage(error.message || 'Impossible d’effectuer cette opération.');
    } finally {
      setBusy(false);
    }
  };

  const createCategory = () => run(async () => {
    const labelFr = newCategory.label_fr.trim();
    const labelEn = newCategory.label_en.trim() || labelFr;
    const key = slugify(newCategory.key || labelEn || labelFr);
    if (!labelFr || !key) throw new Error('Le nom français est obligatoire.');
    const { error } = await supabase.from('asset_category').insert({ key, label_fr: labelFr, label_en: labelEn, display_order: orderedCategories.length, is_active: true });
    if (error) throw error;
    setNewCategory({ label_fr: '', label_en: '', key: '' });
  });

  const saveItem = (table, item, patch) => run(async () => {
    const { error } = await supabase.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', item.id);
    if (error) throw error;
  });

  const moveItem = (table, list, index, delta) => run(async () => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const first = list[index];
    const second = list[target];
    const [{ error: firstError }, { error: secondError }] = await Promise.all([
      supabase.from(table).update({ display_order: target, updated_at: new Date().toISOString() }).eq('id', first.id),
      supabase.from(table).update({ display_order: index, updated_at: new Date().toISOString() }).eq('id', second.id),
    ]);
    if (firstError || secondError) throw firstError || secondError;
  });

  const deleteItem = (table, item, usageCount, childCount = 0) => {
    const consequences = table === 'asset_category'
      ? `${usageCount} actif(s) deviendront non classés et ${childCount} sous-catégorie(s) seront supprimées.`
      : `${usageCount} actif(s) perdront cette sous-catégorie.`;
    if (!window.confirm(`Supprimer « ${item.label_fr || item.label_en} » ?\n\n${consequences}`)) return;
    run(async () => {
      const { error } = await supabase.from(table).delete().eq('id', item.id);
      if (error) throw error;
    });
  };

  const createSubcategory = (category) => run(async () => {
    const draft = newSubcategories[category.id] || {};
    const labelFr = String(draft.label_fr || '').trim();
    const labelEn = String(draft.label_en || '').trim() || labelFr;
    const list = subcategories.filter((item) => item.category_id === category.id);
    if (!labelFr) throw new Error('Le nom français de la sous-catégorie est obligatoire.');
    const { error } = await supabase.from('asset_subcategory').insert({ category_id: category.id, key: slugify(labelEn || labelFr), label_fr: labelFr, label_en: labelEn, display_order: list.length, is_active: true });
    if (error) throw error;
    setNewSubcategories((current) => ({ ...current, [category.id]: { label_fr: '', label_en: '' } }));
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-white/10 bg-zinc-950 text-white">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FolderTree size={20} className="text-cyan-300" /> Catégories OLOSHOP</DialogTitle></DialogHeader>
        <p className="text-sm text-zinc-400">Créez, renommez, ordonnez, activez ou supprimez les catégories et sous-catégories proposées dans OLOSHOP.</p>

        <section className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
          <h3 className="mb-3 text-sm font-black uppercase tracking-wider text-cyan-200">Nouvelle catégorie</h3>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_180px_auto]">
            <Input value={newCategory.label_fr} onChange={(event) => setNewCategory({ ...newCategory, label_fr: event.target.value })} placeholder="Nom français" className="border-white/10 bg-black" />
            <Input value={newCategory.label_en} onChange={(event) => setNewCategory({ ...newCategory, label_en: event.target.value })} placeholder="Nom anglais (facultatif)" className="border-white/10 bg-black" />
            <Input value={newCategory.key} onChange={(event) => setNewCategory({ ...newCategory, key: event.target.value })} placeholder="Identifiant automatique" className="border-white/10 bg-black" />
            <Button onClick={createCategory} disabled={busy || !newCategory.label_fr.trim()} className="bg-cyan-400 font-black text-black hover:bg-cyan-300"><Plus size={16} className="mr-2" /> Ajouter</Button>
          </div>
        </section>

        {errorMessage && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{errorMessage}</div>}
        {busy && <div className="flex items-center gap-2 text-xs text-cyan-200"><Loader2 size={14} className="animate-spin" /> Mise à jour…</div>}

        <div className="space-y-4">
          {orderedCategories.map((category, categoryIndex) => {
            const children = subcategories.filter((item) => item.category_id === category.id).sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
            const categoryUsage = assets.filter((asset) => asset.category_id === category.id).length;
            const draft = newSubcategories[category.id] || { label_fr: '', label_en: '' };
            return (
              <section key={category.id} className="rounded-xl border border-white/10 bg-black p-4">
                <div className="mb-2 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-zinc-500">Catégorie · {category.key}</span><span className="text-xs text-zinc-500">{children.length} sous-catégorie{children.length === 1 ? '' : 's'}</span></div>
                <TaxonomyRow item={category} index={categoryIndex} total={orderedCategories.length} usageCount={categoryUsage} onSave={(item, patch) => saveItem('asset_category', item, patch)} onMove={(index, delta) => moveItem('asset_category', orderedCategories, index, delta)} onToggle={(item) => saveItem('asset_category', item, { is_active: item.is_active === false })} onDelete={(item, usage) => deleteItem('asset_category', item, usage, children.length)} />

                <div className="ml-4 mt-3 space-y-2 border-l border-white/10 pl-4">
                  {children.map((subcategory, subcategoryIndex) => (
                    <TaxonomyRow key={subcategory.id} item={subcategory} index={subcategoryIndex} total={children.length} usageCount={assets.filter((asset) => asset.subcategory_id === subcategory.id).length} onSave={(item, patch) => saveItem('asset_subcategory', item, patch)} onMove={(index, delta) => moveItem('asset_subcategory', children, index, delta)} onToggle={(item) => saveItem('asset_subcategory', item, { is_active: item.is_active === false })} onDelete={(item, usage) => deleteItem('asset_subcategory', item, usage)} />
                  ))}
                  <div className="grid gap-2 rounded-lg border border-dashed border-white/10 p-3 md:grid-cols-[1fr_1fr_auto]">
                    <Input value={draft.label_fr} onChange={(event) => setNewSubcategories((current) => ({ ...current, [category.id]: { ...draft, label_fr: event.target.value } }))} placeholder="Nouvelle sous-catégorie FR" className="border-white/10 bg-zinc-900" />
                    <Input value={draft.label_en} onChange={(event) => setNewSubcategories((current) => ({ ...current, [category.id]: { ...draft, label_en: event.target.value } }))} placeholder="Nom anglais (facultatif)" className="border-white/10 bg-zinc-900" />
                    <Button variant="outline" onClick={() => createSubcategory(category)} disabled={busy || !draft.label_fr.trim()} className="border-cyan-400/30 text-cyan-200"><Plus size={15} className="mr-2" /> Sous-catégorie</Button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
