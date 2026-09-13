import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, Image as ImageIcon } from 'lucide-react';

export default function AdminPlaceholders() {
  const queryClient = useQueryClient();
  const [editDialog, setEditDialog] = useState(false);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: placeholders = [] } = useQuery({
    queryKey: ['profilePlaceholders'],
    queryFn: () => base44.entities.ProfilePlaceholder.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProfilePlaceholder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profilePlaceholders'] });
      setEditDialog(false);
      setCurrentPlaceholder(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProfilePlaceholder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profilePlaceholders'] });
      setEditDialog(false);
      setCurrentPlaceholder(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProfilePlaceholder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profilePlaceholders'] });
    }
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCurrentPlaceholder({ ...currentPlaceholder, icon_url: file_url });
    } catch (error) {
      alert('Upload error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!currentPlaceholder?.name || !currentPlaceholder?.icon_url) {
      alert('Please fill in all fields');
      return;
    }

    if (currentPlaceholder.id) {
      updateMutation.mutate({
        id: currentPlaceholder.id,
        data: currentPlaceholder
      });
    } else {
      createMutation.mutate(currentPlaceholder);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white text-lg font-light">Default profile icons</h3>
        <Button
          onClick={() => {
            setCurrentPlaceholder({ name: '', icon_url: '', is_active: true });
            setEditDialog(true);
          }}
          size="sm"
        >
          <Plus size={16} className="mr-2" />
          Add
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {placeholders.map((placeholder) => (
          <div
            key={placeholder.id}
            className="bg-neutral-900 border border-white/10 rounded-lg p-4 space-y-3"
          >
            <div className="aspect-square rounded-lg overflow-hidden bg-neutral-800 flex items-center justify-center">
              {placeholder.icon_url ? (
                <img
                  src={placeholder.icon_url}
                  alt={placeholder.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ImageIcon size={32} className="text-white/20" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-white text-sm truncate">{placeholder.name}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setCurrentPlaceholder(placeholder);
                    setEditDialog(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => {
                    if (confirm('Delete this icon?')) {
                      deleteMutation.mutate(placeholder.id);
                    }
                  }}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {placeholders.length === 0 && (
        <div className="text-center py-8 text-white text-sm">
          No profile icons configured
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="bg-neutral-950 border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">
              {currentPlaceholder?.id ? 'Edit' : 'Add'} icon
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-white text-sm mb-2 block">Name</label>
              <Input
                value={currentPlaceholder?.name || ''}
                onChange={(e) => setCurrentPlaceholder({
                  ...currentPlaceholder,
                  name: e.target.value
                })}
                placeholder="E.g. Pink Pig"
                className="bg-neutral-900 border-white/20"
              />
            </div>

            <div>
              <label className="text-white text-sm mb-2 block">Image</label>
              {currentPlaceholder?.icon_url && (
                <div className="mb-3 w-24 h-24 rounded-lg overflow-hidden bg-neutral-800">
                  <img
                    src={currentPlaceholder.icon_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="text-white text-sm"
              />
              {uploading && <p className="text-white text-xs mt-1">Uploading...</p>}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setEditDialog(false);
                  setCurrentPlaceholder(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1"
                disabled={!currentPlaceholder?.name || !currentPlaceholder?.icon_url}
              >
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}