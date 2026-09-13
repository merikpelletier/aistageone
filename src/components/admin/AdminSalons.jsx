import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageSquare, Trash2, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SALON_IDS = [
  { id: 'cochon', defaultName: '🐷 Salon Cochon', defaultDescription: 'Discussions pour adultes' },
  { id: 'contact', defaultName: '💬 Salon Contact', defaultDescription: 'Conversations non-sexuelles' },
  { id: 'commercial', defaultName: '🛍️ Salon Commercial', defaultDescription: 'Annonces officielles' },
];

export default function AdminSalons() {
  const [editingSalon, setEditingSalon] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: salonStatuses = [] } = useQuery({
    queryKey: ['salonStatuses'],
    queryFn: () => base44.entities.SalonStatus.list(),
  });

  const { data: salonLabels = [] } = useQuery({
    queryKey: ['salonLabels'],
    queryFn: () => base44.entities.SalonLabel.list(),
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['allChatMessages'],
    queryFn: () => base44.entities.ChatMessage.list('-created_date', 100),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ salon, is_open, closed_message }) => {
      const existing = salonStatuses.find(s => s.salon === salon);
      if (existing) {
        return base44.entities.SalonStatus.update(existing.id, { is_open, closed_message });
      } else {
        return base44.entities.SalonStatus.create({ salon, is_open, closed_message });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salonStatuses'] })
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id) => base44.entities.ChatMessage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allChatMessages'] })
  });

  const clearSalonMutation = useMutation({
    mutationFn: async (salon) => {
      const salonMessages = messages.filter(m => m.salon === salon);
      for (const msg of salonMessages) {
        await base44.entities.ChatMessage.delete(msg.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['allChatMessages'] })
  });

  const updateSalonLabelMutation = useMutation({
    mutationFn: async ({ salonId, name, description }) => {
      const existing = salonLabels.find(s => s.salon_id === salonId);
      if (existing) {
        return base44.entities.SalonLabel.update(existing.id, { name, description });
      } else {
        return base44.entities.SalonLabel.create({ salon_id: salonId, name, description });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salonLabels'] });
      setEditDialogOpen(false);
    }
  });

  const getSalonStatus = (salon) => salonStatuses.find(s => s.salon === salon) || { is_open: true, closed_message: '' };

  const getSalonInfo = (salonId) => {
    const label = salonLabels.find(s => s.salon_id === salonId);
    const defaults = SALON_IDS.find(s => s.id === salonId);
    return {
      name: label?.name || defaults?.defaultName || '',
      description: label?.description || defaults?.defaultDescription || ''
    };
  };

  const openEditDialog = (salonId) => {
    const info = getSalonInfo(salonId);
    setEditingSalon(salonId);
    setEditingName(info.name);
    setEditingDesc(info.description);
    setEditDialogOpen(true);
  };

  const handleSaveLabel = () => {
    if (editingSalon) {
      updateSalonLabelMutation.mutate({
        salonId: editingSalon,
        name: editingName,
        description: editingDesc
      });
    }
  };

  return (
    <div>
      <h2 className="text-white text-lg font-light mb-6">Salon Management</h2>

      {/* Salon Controls */}
      <div className="space-y-4 mb-8">
        {SALON_IDS.map((salonDef) => {
          const status = getSalonStatus(salonDef.id);
          const info = getSalonInfo(salonDef.id);
          return (
            <div
              key={salonDef.id}
              className="bg-neutral-950 border border-white/10 rounded-sm p-4"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-light">{info.name}</h3>
                  <p className="text-white text-sm">{info.description}</p>
                  <p className="text-white text-xs mt-1">
                    {messages.filter(m => m.salon === salonDef.id).length} messages
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(salonDef.id)}
                    className="h-7 w-7 text-white hover:text-white"
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Label htmlFor={`open-${salonDef.id}`} className="text-white text-sm">
                    {status.is_open ? 'Open' : 'Closed'}
                  </Label>
                  <Switch
                    id={`open-${salonDef.id}`}
                    checked={status.is_open !== false}
                    onCheckedChange={(checked) => 
                      updateStatusMutation.mutate({ 
                        salon: salonDef.id, 
                        is_open: checked, 
                        closed_message: status.closed_message 
                      })
                    }
                  />
                </div>
              </div>
              
              {!status.is_open && (
                <Input
                  value={status.closed_message || ''}
                  onChange={(e) => 
                    updateStatusMutation.mutate({ 
                      salon: salonDef.id, 
                      is_open: false, 
                      closed_message: e.target.value 
                    })
                  }
                  placeholder="Closure message..."
                  className="bg-neutral-900 border-white/10 text-white mb-4"
                />
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => clearSalonMutation.mutate(salonDef.id)}
                className="border-red-900/50 text-red-400 hover:bg-red-900/20"
              >
                <Trash2 size={14} className="mr-2" />
                Clear salon
              </Button>
            </div>
          );
        })}
      </div>

      {/* Recent Messages */}
      <div>
        <h3 className="text-white text-sm mb-4">Recent messages</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.slice(0, 50).map((msg) => (
            <div
              key={msg.id}
              className="flex items-start justify-between p-3 bg-neutral-900 rounded-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-xs">
                      {getSalonInfo(msg.salon)?.name || msg.salon}
                    </span>
                  <span className={`text-xs ${msg.is_admin ? 'text-red-400' : 'text-white'}`}>
                    {msg.sender_identifier}
                  </span>
                </div>
                <p className="text-white/80 text-sm truncate">{msg.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteMessageMutation.mutate(msg.id)}
                className="h-8 w-8 text-white hover:text-red-500 flex-shrink-0"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Salon Label Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => !open && setEditDialogOpen(false)}>
        <DialogContent className="bg-neutral-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="font-light">Edit Salon Info</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-white text-sm mb-2 block">Salon Name</Label>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="e.g. 🐷 Salon Cochon"
                className="bg-neutral-900 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-white text-sm mb-2 block">Description</Label>
              <Input
                value={editingDesc}
                onChange={(e) => setEditingDesc(e.target.value)}
                placeholder="e.g. Discussions pour adultes"
                className="bg-neutral-900 border-white/10 text-white"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="border-white/20 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveLabel}
                className="bg-white text-black hover:bg-white/90"
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