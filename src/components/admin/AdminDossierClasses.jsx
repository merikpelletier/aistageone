import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';

const DEFAULT_CLASSES = ['Videos', 'Story', 'Assets', 'Kits', 'Merchandise'];

export default function AdminDossierClasses() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [ordered, setOrdered] = useState([]);

  const { data: classes = [] } = useQuery({
    queryKey: ['dossierClasses'],
    queryFn: () => base44.entities.DossierClass.list('order'),
  });

  useEffect(() => setOrdered(classes), [classes]);

  const createMutation = useMutation({
    mutationFn: ({ name, order }) => base44.entities.DossierClass.create({ name, order }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossierClasses'] });
      setNewName('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }) => base44.entities.DossierClass.update(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossierClasses'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DossierClass.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dossierClasses'] }),
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(ordered);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setOrdered(reordered);
    await Promise.all(
      reordered.map((item, idx) => base44.entities.DossierClass.update(item.id, { order: idx }))
    );
    qc.invalidateQueries({ queryKey: ['dossierClasses'] });
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate({ name: trimmed, order: ordered.length });
  };

  const initializeDefaults = async () => {
    await Promise.all(
      DEFAULT_CLASSES.map((name, order) => base44.entities.DossierClass.create({ name, order }))
    );
    qc.invalidateQueries({ queryKey: ['dossierClasses'] });
  };

  const confirmEdit = () => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    updateMutation.mutate({ id: editingId, name: trimmed });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-white text-sm font-medium tracking-wide">Dossier Classes</h3>
        {ordered.length === 0 && (
          <button
            onClick={initializeDefaults}
            className="px-3 py-1.5 border border-white/20 text-white text-xs hover:border-white/50"
          >
            Load default classes
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="New class name..."
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

      {ordered.length === 0 && (
        <p className="text-white/50 text-sm text-center py-6">No classes yet.</p>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dossier-classes">
          {(provided) => (
            <div className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
              {ordered.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg ${snapshot.isDragging ? 'opacity-80 border-white/30' : ''}`}
                    >
                      <div
                        {...provided.dragHandleProps}
                        className="text-white/20 hover:text-white cursor-grab active:cursor-grabbing mr-1"
                      >
                        <GripVertical size={14} />
                      </div>
                      {editingId === item.id ? (
                        <>
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') confirmEdit();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-sm focus:outline-none focus:border-white/40"
                          />
                          <button
                            onClick={confirmEdit}
                            disabled={updateMutation.isPending}
                            className="text-green-400 hover:text-green-300"
                          >
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-white">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-white text-sm">{item.name}</span>
                          <button
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingName(item.name);
                            }}
                            className="text-white"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="text-white hover:text-red-400"
                          >
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
