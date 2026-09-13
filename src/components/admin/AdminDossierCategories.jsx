import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Check, X, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function AdminDossierCategories() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [ordered, setOrdered] = useState([]);

  const { data: categories = [] } = useQuery({
    queryKey: ['dossierCategories'],
    queryFn: () => base44.entities.DossierCategory.list('order'),
  });

  useEffect(() => {
    setOrdered(categories);
  }, [categories]);

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.DossierCategory.create({ name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dossierCategories'] }); setNewName(''); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }) => base44.entities.DossierCategory.update(id, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dossierCategories'] }); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DossierCategory.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dossierCategories'] }),
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(ordered);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setOrdered(reordered);
    await Promise.all(reordered.map((cat, idx) =>
      base44.entities.DossierCategory.update(cat.id, { order: idx })
    ));
    qc.invalidateQueries({ queryKey: ['dossierCategories'] });
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const confirmEdit = () => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    updateMutation.mutate({ id: editingId, name: trimmed });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-white text-sm font-medium tracking-wide">Dossier Categories</h3>

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New category name..."
          className="flex-1 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim() || createMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:opacity-40 transition-colors"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      {/* List */}
      {ordered.length === 0 && (
        <p className="text-white text-sm text-center py-6">No categories yet.</p>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="categories">
          {(provided) => (
            <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
              {ordered.map((cat, index) => (
                <Draggable key={cat.id} draggableId={cat.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg ${snapshot.isDragging ? 'opacity-80 border-white/30' : ''}`}
                    >
                      <div {...provided.dragHandleProps} className="text-white/20 hover:text-white cursor-grab active:cursor-grabbing mr-1">
                        <GripVertical size={14} />
                      </div>
                      {editingId === cat.id ? (
                        <>
                          <input
                            autoFocus
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingId(null); }}
                            className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-white/40"
                          />
                          <button onClick={confirmEdit} disabled={updateMutation.isPending} className="text-green-400 hover:text-green-300 transition-colors">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-white hover:text-white transition-colors">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-white text-sm">{cat.name}</span>
                          <button onClick={() => startEdit(cat)} className="text-white hover:text-white transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteMutation.mutate(cat.id)} className="text-white hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}