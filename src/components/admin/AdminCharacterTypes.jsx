import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, GripVertical } from 'lucide-react';

export default function AdminCharacterTypes() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');

  const { data: types = [] } = useQuery({
    queryKey: ['characterTypes'],
    queryFn: () => base44.entities.CharacterType.list('order', 100),
  });

  const createMutation = useMutation({
    mutationFn: (name) => base44.entities.CharacterType.create({ name, order: types.length + 1 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['characterTypes'] }); setNewName(''); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CharacterType.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['characterTypes'] }),
  });

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  const handleDragEnd = async (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = Array.from(types);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    // Optimistic update
    qc.setQueryData(['characterTypes'], reordered);
    // Persist new order
    await Promise.all(reordered.map((ct, i) => base44.entities.CharacterType.update(ct.id, { order: i + 1 })));
    qc.invalidateQueries({ queryKey: ['characterTypes'] });
  };

  return (
    <div className="space-y-4">
      <p className="text-white text-sm">Manage the character type options shown in all character dropdowns.</p>

      {/* Add new */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New character type..."
          className="bg-neutral-900 border-white/10 text-white flex-1"
        />
        <Button
          onClick={handleAdd}
          disabled={!newName.trim() || createMutation.isPending}
          className="bg-white text-black hover:bg-white/90 gap-1"
        >
          <Plus size={14} /> Add
        </Button>
      </div>

      {/* Draggable list */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="character-types">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {types.map((ct, index) => (
                <Draggable key={ct.id} draggableId={ct.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex items-center gap-3 px-3 py-2 bg-neutral-900 border rounded transition-colors ${snapshot.isDragging ? 'border-white/40 bg-neutral-800' : 'border-white/10'}`}
                    >
                      <span {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                        <GripVertical size={14} className="text-white flex-shrink-0" />
                      </span>
                      <span className="text-white flex-1">{ct.name}</span>
                      <button
                        onClick={() => deleteMutation.mutate(ct.id)}
                        className="text-white hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {types.length === 0 && (
                <p className="text-white/20 text-sm text-center py-6">No character types yet. Add some above.</p>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}