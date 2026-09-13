import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2 } from 'lucide-react';
import AdminProductionKitEditor from './AdminProductionKitEditor';

// Adapter: ProductionKit stores its cover as `cover_image`, while the shared
// AdminProductionKitEditor works against a page-shaped object using `media_url`.
const kitToPage = (kit) => ({ ...kit, media_url: kit.cover_image || '' });
const pageToKit = (page) => {
  const { media_url, ...rest } = page;
  return { ...rest, cover_image: media_url };
};

export default function AdminProductionKits() {
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();
  const qk = ['adminProductionKits'];

  const { data: kits = [] } = useQuery({
    queryKey: qk,
    queryFn: () => base44.entities.ProductionKit.list('order'),
  });

  const createM = useMutation({
    mutationFn: (data) => base44.entities.ProductionKit.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk }); setEditing(null); }
  });
  const updateM = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionKit.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk }); setEditing(null); }
  });
  const deleteM = useMutation({
    mutationFn: (id) => base44.entities.ProductionKit.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk })
  });

  const handleSave = () => {
    if (!editing.title?.trim()) { alert('Title is required'); return; }
    const kit = pageToKit(editing);
    if (kit.id) updateM.mutate({ id: kit.id, data: kit });
    else createM.mutate(kit);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-sm font-light tracking-wide">Production Kits ({kits.length})</h2>
        <Button
          onClick={() => setEditing({
            title: '', subtitle: '', status: 'draft', order: kits.length + 1,
            kit_characters: [], kit_sets: [], kit_costumes: [], kit_reference_media: []
          })}
          className="bg-white text-black hover:bg-white/90"
        >
          <Plus size={16} className="mr-2" /> New Kit
        </Button>
      </div>

      <div className="space-y-3">
        {kits.length === 0 && (
          <p className="text-white text-sm">No production kits yet. Production kits are independent of dossiers.</p>
        )}
        {kits.map(kit => (
          <div key={kit.id} className="bg-neutral-950 border border-white/10 rounded p-4 flex items-center gap-3">
            {kit.cover_image ? (
              kit.cover_image.match(/\.(mp4|webm|ogg)$/i) ? (
                <video src={kit.cover_image} className="w-16 h-16 object-cover rounded" />
              ) : (
                <img src={kit.cover_image} alt="" className="w-16 h-16 object-cover rounded" />
              )
            ) : (
              <div className="w-16 h-16 bg-white/5 rounded flex items-center justify-center text-white/30">🎬</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-light truncate">{kit.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${kit.status === 'published' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                  {kit.status}
                </span>
                <span className="text-white/40 text-xs">{(kit.kit_characters || []).length} actors · {(kit.kit_sets || []).length} sets · {(kit.kit_costumes || []).length} costumes</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditing(kitToPage(kit))} className="text-white hover:text-white">
              <Edit2 size={16} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete this production kit?')) deleteM.mutate(kit.id); }} className="text-white hover:text-red-500">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-light tracking-wide">{editing?.id ? 'Edit' : 'New'} Production Kit</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 mt-4">
              <Input
                value={editing.title || ''}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Kit title"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Input
                value={editing.subtitle || ''}
                onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                placeholder="Subtitle"
                className="bg-neutral-900 border-white/10 text-white"
              />
              <Select
                value={editing.status || 'draft'}
                onValueChange={(value) => setEditing({ ...editing, status: value })}
              >
                <SelectTrigger className="bg-neutral-900 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
              <div>
                <label className="block text-white text-sm mb-2">Display Order (Position)</label>
                <Input
                  type="number"
                  value={editing.order ?? 0}
                  onChange={(e) => setEditing({ ...editing, order: parseInt(e.target.value) || 0 })}
                  className="bg-neutral-900 border-white/10 text-white"
                />
              </div>
              <div className="p-3 bg-neutral-800/50 border border-white/10 rounded">
                <p className="text-white text-sm font-medium mb-3">🎬 Kit content</p>
                <AdminProductionKitEditor page={editing} onChange={setEditing} />
              </div>
              <Button onClick={handleSave} className="w-full bg-white text-black hover:bg-white/90">
                Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}