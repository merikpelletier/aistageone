import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Mail, MailOpen, Reply } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminMessages() {
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['contactMessages'],
    queryFn: () => base44.entities.ContactMessage.list('-created_date'),
  });

  const updateMessageMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ContactMessage.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactMessages'] })
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id) => base44.entities.ContactMessage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactMessages'] })
  });

  const markAsRead = (message) => {
    if (message.status === 'unread') {
      updateMessageMutation.mutate({ id: message.id, data: { status: 'read' } });
    }
  };

  const markAsReplied = (message) => {
    updateMessageMutation.mutate({ id: message.id, data: { status: 'replied' } });
  };

  const statusColors = {
    unread: 'bg-red-900/50 text-red-400',
    read: 'bg-yellow-900/50 text-yellow-400',
    replied: 'bg-green-900/50 text-green-400'
  };

  const statusLabels = {
    unread: 'Non lu',
    read: 'Lu',
    replied: 'Répondu'
  };

  const unreadCount = messages.filter(m => m.status === 'unread').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-white text-lg font-light">Messages Reçus</h2>
          {unreadCount > 0 && (
            <Badge className="bg-red-600">{unreadCount} non lu{unreadCount > 1 ? 's' : ''}</Badge>
          )}
        </div>
      </div>

      {/* Messages List */}
      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`bg-neutral-950 border border-white/10 rounded-sm p-4 ${
              message.status === 'unread' ? 'border-l-2 border-l-red-600' : ''
            }`}
            onClick={() => markAsRead(message)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {message.status === 'unread' ? (
                  <Mail size={18} className="text-red-400" />
                ) : (
                  <MailOpen size={18} className="text-white" />
                )}
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[message.status]}`}>
                    {statusLabels[message.status]}
                  </span>
                  <span className="text-white text-xs ml-3">
                    {message.created_date && format(new Date(message.created_date), 'dd MMM yyyy HH:mm', { locale: fr })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {message.email && message.status !== 'replied' && (
                  <a href={`mailto:${message.email}`} onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsReplied(message)}
                      className="text-white hover:text-white"
                    >
                      <Reply size={14} className="mr-2" />
                      Répondre
                    </Button>
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMessageMutation.mutate(message.id);
                  }}
                  className="h-8 w-8 text-white hover:text-red-500"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
            
            <div className="pl-8">
              <p className="text-white/80 whitespace-pre-wrap">{message.message}</p>
              {message.email && (
                <p className="text-white text-sm mt-3">
                  Email de réponse : {message.email}
                </p>
              )}
            </div>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="text-center py-12">
            <Mail size={48} className="text-white/10 mx-auto mb-4" />
            <p className="text-white">Aucun message</p>
          </div>
        )}
      </div>
    </div>
  );
}