import React, { useState, useEffect } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageSquare, Trash2, Edit2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SALON_IDS = [
  { id: 'cochon', defaultName: '🐷 Salon Cochon', defaultDescription: 'Discussions pour adultes' },
  { id: 'contact', defaultName: '💬 Salon Contact', defaultDescription: 'Conversations non-sexuelles' },
  { id: 'commercial', defaultName: '🛍️ Salon Commercial', defaultDescription: 'Annonces officielles' },
];

const PAGE_BACKGROUND_KEY = '_page_background';

export default function AdminSalons() {
  const t = useStudioTranslation();
  const [editingSalon, setEditingSalon] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingDesc, setEditingDesc] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [pilotRoomTitleId, setPilotRoomTitleId] = useState('');
  const [newPilotRoomName, setNewPilotRoomName] = useState('');
  const [pilotRoomError, setPilotRoomError] = useState('');
  const queryClient = useQueryClient();

  const { data: aiPilots = [] } = useQuery({
    queryKey: ['adminSocialAiPilots'],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_pilots').select('id,name,status').order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: salonStatuses = [] } = useQuery({
    queryKey: ['salonStatuses'],
    queryFn: () => base44.entities.SalonStatus.list(),
  });

  const { data: salonLabels = [] } = useQuery({
    queryKey: ['salonLabels'],
    queryFn: () => base44.entities.SalonLabel.list(),
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
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

  const selectedPilot = aiPilots.find(p => p.id === pilotRoomTitleId) || aiPilots.find(p => p.status === 'published') || aiPilots[0];
  const pilotPrefix = selectedPilot ? `aipilot:${selectedPilot.id}:` : '';
  const pilotRooms = selectedPilot ? [
    { salon_id: `${pilotPrefix}general`, name: t('social.pilots.general', 'General') },
    ...salonLabels.filter(label => label.salon_id?.startsWith(pilotPrefix) && label.salon_id !== `${pilotPrefix}general`)
  ] : [];

  const createPilotRoomMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPilot || !newPilotRoomName.trim()) return;
      const salonId = `${pilotPrefix}${crypto.randomUUID()}`;
      await base44.entities.SalonLabel.create({ salon_id: salonId, name: newPilotRoomName.trim(), description: '' });
    },
    onSuccess: () => {
      setNewPilotRoomName('');
      setPilotRoomError('');
      queryClient.invalidateQueries({ queryKey: ['salonLabels'] });
    },
    onError: error => setPilotRoomError(error?.message || 'Unable to create room.')
  });

  const backgroundRecord = salonLabels.find(s => s.salon_id === PAGE_BACKGROUND_KEY);
  const backgroundSettings = (() => {
    try {
      return backgroundRecord?.description ? JSON.parse(backgroundRecord.description) : {};
    } catch {
      return {};
    }
  })();

  const saveBackgroundMutation = useMutation({
    mutationFn: async (settings) => {
      const description = JSON.stringify(settings);
      if (backgroundRecord) {
        return base44.entities.SalonLabel.update(backgroundRecord.id, { name: 'Page Background', description });
      } else {
        return base44.entities.SalonLabel.create({ salon_id: PAGE_BACKGROUND_KEY, name: 'Page Background', description });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['salonLabels'] })
  });

  const handleBackgroundUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      saveBackgroundMutation.mutate({ ...backgroundSettings, image_url: file_url });
    } catch (err) {
      console.error('Error uploading background:', err);
    } finally {
      setUploadingBg(false);
    }
  };

  const handleRemoveBackground = () => {
    saveBackgroundMutation.mutate({ ...backgroundSettings, image_url: '' });
  };

  const handleOverlayChange = (value) => {
    saveBackgroundMutation.mutate({ ...backgroundSettings, overlay: value });
  };

  const handlePositionChange = (value) => {
    saveBackgroundMutation.mutate({ ...backgroundSettings, position: value });
  };

  const handleFitChange = (value) => {
    saveBackgroundMutation.mutate({ ...backgroundSettings, fit: value });
  };

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
      <h2 className="text-white text-lg font-light mb-6">{t('social.admin.management', 'Salon Management')}</h2>

      {/* Page Background */}
      <div className="bg-neutral-950 border border-white/10 rounded-sm p-4 mb-8">
        <h3 className="text-white font-light mb-4">{t('social.admin.pageBackground', 'Chat Rooms Page Background')}</h3>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0">
            <div className="w-48 h-28 bg-neutral-900 border border-white/10 rounded-sm overflow-hidden flex items-center justify-center">
              {backgroundSettings.image_url ? (
                <img src={backgroundSettings.image_url} alt="Background preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white/40 text-xs">{t('social.admin.noBackground', 'No background set')}</span>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={handleBackgroundUpload} className="hidden" />
                <span className="inline-block bg-white text-black hover:bg-white/90 text-xs font-light px-3 py-2 rounded-md">
                  {uploadingBg ? t('social.admin.uploading', 'Uploading...') : t('social.admin.uploadImage', 'Upload image')}
                </span>
              </label>
              {backgroundSettings.image_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveBackground}
                  className="border-red-900/50 text-red-400 hover:bg-red-900/20"
                >
                  {t('social.admin.remove', 'Remove')}
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <Label className="text-white text-sm mb-2 block">{t('social.admin.overlayDarkness', 'Overlay darkness')} ({Math.round((backgroundSettings.overlay ?? 0.5) * 100)}%)</Label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={backgroundSettings.overlay ?? 0.5}
                onChange={(e) => handleOverlayChange(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white text-sm mb-2 block">{t('social.admin.position', 'Position')}</Label>
                <select
                  value={backgroundSettings.position || 'center'}
                  onChange={(e) => handlePositionChange(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/10 text-white text-sm rounded-md px-3 py-2"
                >
                  <option value="center">{t('social.admin.center', 'Center')}</option>
                  <option value="top">{t('social.admin.top', 'Top')}</option>
                  <option value="bottom">{t('social.admin.bottom', 'Bottom')}</option>
                </select>
              </div>
              <div>
                <Label className="text-white text-sm mb-2 block">{t('social.admin.fit', 'Fit')}</Label>
                <select
                  value={backgroundSettings.fit || 'cover'}
                  onChange={(e) => handleFitChange(e.target.value)}
                  className="w-full bg-neutral-900 border border-white/10 text-white text-sm rounded-md px-3 py-2"
                >
                  <option value="cover">{t('social.admin.cover', 'Cover')}</option>
                  <option value="contain">{t('social.admin.contain', 'Contain')}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

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
                    {messages.filter(m => m.salon === salonDef.id).length} {t('social.admin.messages', 'messages')}
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
                    {status.is_open ? t('social.admin.open', 'Open') : t('social.admin.closed', 'Closed')}
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
                  placeholder={t('social.admin.closureMessage', 'Closure message...')}
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
                {t('social.admin.clearSalon', 'Clear salon')}
              </Button>
            </div>
          );
        })}
      </div>

      {/* AI Pilot rooms: titles are drawn from the existing AI Pilots catalog. */}
      <div className="bg-neutral-950 border border-white/10 p-4 mb-8 space-y-4">
        <h3 className="text-white text-sm font-semibold">{t('social.nav.aipilots', 'AI PILOTS')}</h3>
        <select
          aria-label={t('social.pilots.selectTitle', 'Select AI Pilot')}
          value={selectedPilot?.id || ''}
          onChange={event => setPilotRoomTitleId(event.target.value)}
          className="w-full bg-neutral-900 border border-white/20 text-white px-3 py-2 text-sm"
        >
          {aiPilots.map(pilot => (
            <option key={pilot.id} value={pilot.id}>{pilot.name}{pilot.status !== 'published' ? ' (draft)' : ''}</option>
          ))}
        </select>
        {selectedPilot && (
          <>
            <div className="space-y-2">
              {pilotRooms.map(room => {
                const status = getSalonStatus(room.salon_id);
                return (
                  <div key={room.salon_id} className="flex gap-3 items-center justify-between border border-white/10 px-3 py-2">
                    <span className="text-white text-sm truncate">{room.name}</span>
                    <div className="flex gap-2 items-center shrink-0">
                      {room.salon_id !== `${pilotPrefix}general` && (
                        <button type="button" aria-label={t('social.admin.editInfo', 'Edit Salon Info')} onClick={() => openEditDialog(room.salon_id)} className="text-white p-1"><Edit2 size={15}/></button>
                      )}
                      <span className="text-xs text-white/70">{status.is_open === false ? t('social.admin.closed', 'Closed') : t('social.admin.open', 'Open')}</span>
                      <Switch
                        checked={status.is_open !== false}
                        onCheckedChange={checked => updateStatusMutation.mutate({ salon: room.salon_id, is_open: checked, closed_message: status.closed_message })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                value={newPilotRoomName}
                onChange={event => setNewPilotRoomName(event.target.value)}
                placeholder={t('social.pilots.newRoom', 'New room name')}
                className="bg-neutral-900 border-white/20 text-white"
              />
              <Button
                disabled={!newPilotRoomName.trim() || createPilotRoomMutation.isPending}
                onClick={() => createPilotRoomMutation.mutate()}
                className="bg-white text-black hover:bg-white/90 shrink-0"
              ><Plus size={16} className="mr-1"/>{t('social.pilots.createRoom', 'Create room')}</Button>
            </div>
            {pilotRoomError && <p role="alert" className="text-red-400 text-xs">{pilotRoomError}</p>}
          </>
        )}
      </div>

      {/* Recent Messages */}
      <div>
        <h3 className="text-white text-sm mb-4">{t('social.admin.recentMessages', 'Recent messages')}</h3>
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
            <DialogTitle className="font-light">{t('social.admin.editInfo', 'Edit Salon Info')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-white text-sm mb-2 block">{t('social.admin.salonName', 'Salon Name')}</Label>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="e.g. 🐷 Salon Cochon"
                className="bg-neutral-900 border-white/10 text-white"
              />
            </div>
            <div>
              <Label className="text-white text-sm mb-2 block">{t('social.admin.description', 'Description')}</Label>
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
                {t('social.admin.cancel', 'Cancel')}
              </Button>
              <Button
                onClick={handleSaveLabel}
                className="bg-white text-black hover:bg-white/90"
              >
                {t('social.admin.save', 'Save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}