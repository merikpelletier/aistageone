import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, Loader2, Upload, Image as ImageIcon, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminStyleReferences() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('covers');
  const [uploading, setUploading] = useState(false);

  const CATEGORIES = [
    { key: 'covers', label: 'Covers' },
    { key: 'clothes', label: 'Clothes' },
    { key: 'characters', label: 'Characters' },
    { key: 'merchandise', label: 'Merchandise' },
  ];

  const { data: refs = [], isLoading } = useQuery({
    queryKey: ['styleReferences'],
    queryFn: () => base44.entities.StyleReference.list('order'),
  });

  const onUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUrl(file_url);
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const create = async () => {
    if (!url.trim()) { toast.error('Add an image first'); return; }
    await base44.entities.StyleReference.create({
      name: name.trim() || 'Reference',
      url: url.trim(),
      category,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      order: refs.length,
    });
    setName(''); setUrl(''); setTags(''); setCategory('covers');
    setShowAdd(false);
    qc.invalidateQueries({ queryKey: ['styleReferences'] });
    toast.success('Reference added');
  };

  const toggleActive = async (ref) => {
    await base44.entities.StyleReference.update(ref.id, { is_active: !ref.is_active });
    qc.invalidateQueries({ queryKey: ['styleReferences'] });
  };

  const setRefCategory = async (ref, category) => {
    await base44.entities.StyleReference.update(ref.id, { category });
    qc.invalidateQueries({ queryKey: ['styleReferences'] });
    toast.success(`Category set to ${category}`);
  };

  const remove = async (id) => {
    await base44.entities.StyleReference.delete(id);
    qc.invalidateQueries({ queryKey: ['styleReferences'] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white text-lg font-light tracking-wide">Style References</h2>
          <p className="text-white/50 text-xs mt-1">Shared pool used by all users in the Atelier Generate modal.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-bold">
          <Plus size={16} /> Add
        </button>
      </div>

      {showAdd && (
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white font-bold text-sm">New reference</p>
            <button onClick={() => setShowAdd(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-bold">Image</label>
            <div className="mt-2 flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-semibold cursor-pointer">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={e => onUpload(e.target.files?.[0])} />
              </label>
              {url && (
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="or paste image URL"
                className="flex-1 bg-black border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-bold">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Noir portrait" className="mt-2 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white" />
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-bold">Category</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {CATEGORIES.map(c => (
                <button key={c.key} type="button" onClick={() => setCategory(c.key)} className={`py-2 rounded-lg text-xs font-bold capitalize ${category === c.key ? 'bg-white text-black' : 'bg-white/10 text-white border border-white/15'}`}>{c.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-bold">Tags</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="noir, cinematic, editorial" className="mt-2 w-full bg-black border border-white/15 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white" />
          </div>

          <button onClick={create} className="w-full py-2.5 bg-white text-black rounded-lg font-bold text-sm">Save reference</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-white/40" /></div>
      ) : refs.length === 0 ? (
        <div className="py-12 text-center">
          <ImageIcon size={28} className="text-white/30 mx-auto mb-3" />
          <p className="text-white/50 text-sm">No references yet. Add the style images users will pick from.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {refs.map(ref => (
            <div key={ref.id} className="relative rounded-lg overflow-hidden bg-neutral-900 border border-white/10 group" style={{ aspectRatio: '3/4' }}>
              <img src={ref.url} alt={ref.name || ''} className="w-full h-full object-cover" />
              {ref.name && (
                <span className="absolute bottom-7 left-1.5 right-1.5 text-[10px] text-white font-semibold bg-black/70 rounded px-1.5 py-1 truncate">{ref.name}</span>
              )}
              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1">
                <select
                  value={ref.category || 'covers'}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setRefCategory(ref, e.target.value)}
                  className="flex-1 bg-black/80 text-yellow-400 text-[9px] font-bold uppercase tracking-wider rounded px-1 py-1 border border-white/15 focus:outline-none cursor-pointer"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.key} value={c.key} className="bg-neutral-900 text-white normal-case">{c.label}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => toggleActive(ref)} className={`absolute top-1.5 left-1.5 w-7 h-7 rounded-full flex items-center justify-center ${ref.is_active ? 'bg-yellow-400 text-black' : 'bg-black/70 text-white/60'}`} title={ref.is_active ? 'Active — shown in picker' : 'Hidden'}>
                <Star size={13} fill={ref.is_active ? 'currentColor' : 'none'} />
              </button>
              <button onClick={() => remove(ref.id)} className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center">
                <Trash2 size={13} className="text-white" />
              </button>
              {!ref.is_active && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold uppercase tracking-wider">Hidden</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}