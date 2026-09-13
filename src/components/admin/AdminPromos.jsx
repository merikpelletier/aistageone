import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Trash2, Send, Clock, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminPromos() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    salon: 'contact',
    content: '',
    link_url: '',
    link_text: '',
    scheduled_time: ''
  });

  const queryClient = useQueryClient();

  const { data: promos = [] } = useQuery({
    queryKey: ['scheduledPromos'],
    queryFn: () => base44.entities.ScheduledPromo.list('-scheduled_time'),
  });

  const createPromoMutation = useMutation({
    mutationFn: (data) => base44.entities.ScheduledPromo.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledPromos'] });
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const deletePromoMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduledPromo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledPromos'] });
    }
  });

  const sendNowMutation = useMutation({
    mutationFn: async (promo) => {
      // Create the chat message with link if present
      let messageContent = promo.content;
      if (promo.link_url) {
        messageContent += `\n\n🔗 ${promo.link_text || 'Link'}: ${promo.link_url}`;
      }
      
      await base44.entities.ChatMessage.create({
        salon: promo.salon,
        sender_identifier: 'Admin',
        session_id: 'admin',
        content: messageContent,
        is_admin: true
      });
      // Mark as sent
      await base44.entities.ScheduledPromo.update(promo.id, {
        sent: true,
        sent_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledPromos'] });
      queryClient.invalidateQueries({ queryKey: ['chatMessages'] });
    }
  });

  const resetForm = () => {
    setFormData({
      salon: 'contact',
      content: '',
      link_url: '',
      link_text: '',
      scheduled_time: ''
    });
  };

  const handleSubmit = () => {
    createPromoMutation.mutate(formData);
  };

  const salonNames = {
    cochon: '🐷 Cochon',
    contact: '💬 Contact',
    commercial: '🛍️ Info'
  };

  // Check for promos that should be sent
  React.useEffect(() => {
    const checkPromos = async () => {
      const now = new Date().toISOString();
      const pendingPromos = promos.filter(p => !p.sent && p.scheduled_time <= now);
      
      for (const promo of pendingPromos) {
        await sendNowMutation.mutateAsync(promo);
      }
    };

    const interval = setInterval(checkPromos, 30000); // Check every 30 seconds
    checkPromos(); // Initial check

    return () => clearInterval(interval);
  }, [promos]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-light text-white tracking-wide">Promotional Messages</h2>
          <p className="text-white text-sm mt-1">Schedule promo messages in the salons</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-white text-black hover:bg-white/90">
              <Calendar size={16} className="mr-2" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-950 border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Create a promo message</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-white mb-2 block">Salon</label>
                <Select value={formData.salon} onValueChange={(value) => setFormData({...formData, salon: value})}>
                  <SelectTrigger className="bg-neutral-900 border-white/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contact">💬 Contact</SelectItem>
                    <SelectItem value="cochon">🐷 Cochon</SelectItem>
                    <SelectItem value="commercial">🛍️ Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm text-white mb-2 block">Message</label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className="bg-neutral-900 border-white/10 text-white"
                  rows={3}
                  placeholder="Your promotional message..."
                />
              </div>

              <div>
                <label className="text-sm text-white mb-2 block">Link (optional)</label>
                <Input
                  value={formData.link_url}
                  onChange={(e) => setFormData({...formData, link_url: e.target.value})}
                  className="bg-neutral-900 border-white/10 text-white"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="text-sm text-white mb-2 block">Link text</label>
                <Input
                  value={formData.link_text}
                  onChange={(e) => setFormData({...formData, link_text: e.target.value})}
                  className="bg-neutral-900 border-white/10 text-white"
                  placeholder="Learn more"
                />
              </div>

              <div>
                <label className="text-sm text-white mb-2 block">Send date and time</label>
                <Input
                  type="datetime-local"
                  value={formData.scheduled_time ? formData.scheduled_time.slice(0, 16) : ''}
                  onChange={(e) => setFormData({...formData, scheduled_time: e.target.value ? new Date(e.target.value).toISOString() : ''})}
                  className="bg-neutral-900 border-white/10 text-white"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!formData.content || !formData.scheduled_time}
                className="w-full bg-white text-black hover:bg-white/90"
              >
                Schedule
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Promos List */}
      <div className="space-y-3">
        {promos.map((promo) => (
          <div
            key={promo.id}
            className="bg-neutral-900 border border-white/10 rounded-sm p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm">{salonNames[promo.salon]}</span>
                {promo.sent ? (
                  <span className="flex items-center gap-1 text-green-500 text-xs">
                    <CheckCircle2 size={14} />
                    Sent
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-500 text-xs">
                    <Clock size={14} />
                    Scheduled
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {!promo.sent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => sendNowMutation.mutate(promo)}
                    className="text-white hover:text-white"
                  >
                    <Send size={14} />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deletePromoMutation.mutate(promo.id)}
                  className="text-white hover:text-red-500"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <p className="text-white text-sm mb-2">{promo.content}</p>
            
            {promo.link_url && (
              <a
                href={promo.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-500 text-xs hover:underline"
              >
                {promo.link_text || promo.link_url}
              </a>
            )}

            <div className="text-white text-xs mt-3">
              {promo.sent ? (
                <>Sent on {format(new Date(promo.sent_at), 'MMM d, yyyy HH:mm')}</>
              ) : (
                <>Scheduled for {format(new Date(promo.scheduled_time), 'MMM d, yyyy HH:mm')}</>
              )}
            </div>
          </div>
        ))}

        {promos.length === 0 && (
          <div className="text-center py-12 text-white text-sm">
            No scheduled messages
          </div>
        )}
      </div>
    </div>
  );
}