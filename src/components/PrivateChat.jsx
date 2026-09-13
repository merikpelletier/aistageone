import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, Image as ImageIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function PrivateChat({ isOpen, onClose, otherUser, currentUser }) {
  const [message, setMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['privateMessages', currentUser.session_id, otherUser.session_id],
    queryFn: async () => {
      const sent = await base44.entities.PrivateMessage.filter({
        from_session_id: currentUser.session_id,
        to_session_id: otherUser.session_id
      }, 'created_date');
      const received = await base44.entities.PrivateMessage.filter({
        from_session_id: otherUser.session_id,
        to_session_id: currentUser.session_id
      }, 'created_date');
      return [...sent, ...received].sort((a, b) => 
        new Date(a.created_date) - new Date(b.created_date)
      );
    },
    refetchInterval: 3000,
    enabled: isOpen
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data) => base44.entities.PrivateMessage.create({
      from_identifier: currentUser.identifier,
      to_identifier: otherUser.identifier,
      from_session_id: currentUser.session_id,
      to_session_id: otherUser.session_id,
      ...data
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['privateMessages'] });
      queryClient.invalidateQueries({ queryKey: ['privateConversations'] });
      setMessage('');
    }
  });

  const markAsReadMutation = useMutation({
    mutationFn: (messageId) => base44.member.markPrivateMessageRead(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['privateMessages'] });
      queryClient.invalidateQueries({ queryKey: ['privateConversations'] });
    }
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    // Mark received messages as read
    messages
      .filter(m => m.to_session_id === currentUser.session_id && !m.read)
      .forEach(m => markAsReadMutation.mutate(m.id));
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate({ content: message.trim() });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      sendMessageMutation.mutate({ content: '📷 Photo', photo_url: file_url });
    } catch (error) {
      console.error('Error uploading photo:', error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col pb-16"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
        <h2 className="text-white font-light tracking-wide">{otherUser.identifier}</h2>
        <button onClick={onClose} className="text-white hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isFromMe = msg.from_session_id === currentUser.session_id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}
              >
                <div className={`max-w-[80%] ${
                  isFromMe ? 'bg-white/10 text-white' : 'bg-neutral-900 text-white/90'
                } px-4 py-2 rounded-sm`}>
                  {msg.photo_url && (
                    <img
                      src={msg.photo_url}
                      alt=""
                      className="max-w-full rounded-sm mb-2 cursor-pointer"
                      onClick={() => window.open(msg.photo_url, '_blank')}
                    />
                  )}
                  <p className="text-sm">{msg.content}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/10 flex-shrink-0 bg-black">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            variant="outline"
            className="border-white/10 text-white hover:bg-white/10"
          >
            {uploadingPhoto ? '...' : <ImageIcon size={18} />}
          </Button>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Private message..."
            className="flex-1 bg-neutral-900 border-white/10 text-white placeholder:text-white"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="bg-white text-black hover:bg-white/90 px-4"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
