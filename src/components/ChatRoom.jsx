import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Input } from "@/components/ui/input";
import { Send, Users, Lock, Image as ImageIcon, Eye } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ProfileViewer from '@/components/ProfileViewer';
import UserGridDrawer from '@/components/UserGridDrawer';

export default function ChatRoom({ salon, salonStatus, userIdentifier, sessionId, onRequestIdentifier, onOpenPrivateChat }) {
  const [gridOpen, setGridOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [viewingProfile, setViewingProfile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['chatMessages', salon],
    queryFn: () => base44.entities.ChatMessage.filter({ salon }, 'created_date', 50),
    refetchInterval: 3000,
    enabled: salonStatus?.is_open !== false
  });

  const sendMessageMutation = useMutation({
    mutationFn: (data) => base44.entities.ChatMessage.create({
      salon,
      sender_identifier: userIdentifier,
      session_id: sessionId,
      ...data
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', salon] });
      setMessage('');
    }
  });

  const handleViewProfile = async (identifier) => {
    if (identifier === userIdentifier) return; // Don't show own profile
    try {
      const users = await base44.entities.TemporaryUser.filter({ identifier, is_active: true });
      if (users && users.length > 0) {
        setViewingProfile(users[0]);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    if (!userIdentifier) {
      onRequestIdentifier();
      return;
    }
    sendMessageMutation.mutate({ content: message.trim() });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!userIdentifier) {
      onRequestIdentifier();
      return;
    }

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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (salonStatus?.is_open === false) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-black/60">
        <div className="w-20 h-20 bg-black/10 rounded-3xl flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-black" />
        </div>
        <h3 className="text-black text-xl font-bold mb-3">Room Closed</h3>
        <p className="text-black text-base">
          {salonStatus.closed_message || "This room is temporarily closed."}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Header */}
      <div className="px-6 py-4 border-b border-black/10 flex items-center justify-end">
        <button 
          onClick={() => setGridOpen(true)}
          className="flex items-center gap-2 text-black hover:text-black font-medium text-sm transition-colors"
        >
          <Eye size={18} className="text-black" />
          <span>See who is online</span>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${
                msg.sender_identifier === userIdentifier ? 'items-end' : 'items-start'
              }`}
            >
              <button
                onClick={() => !msg.is_admin && handleViewProfile(msg.sender_identifier)}
                className={`text-xs mb-2 font-bold ${
                  msg.is_admin ? 'text-red-600 cursor-default' : 'text-black hover:text-black cursor-pointer'
                } transition-colors`}
              >
                {msg.sender_identifier}
                {msg.is_admin && ' • Admin'}
              </button>
              <div className={`max-w-[85%] px-5 py-3 rounded-2xl shadow-lg ${
                msg.sender_identifier === userIdentifier
                  ? 'bg-black text-yellow-400'
                  : msg.is_admin 
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-black'
              }`}>
                {msg.photo_url && (
                  <img
                    src={msg.photo_url}
                    alt=""
                    className="max-w-full rounded-xl mb-3 cursor-pointer border-2 border-black/10"
                    onClick={() => window.open(msg.photo_url, '_blank')}
                  />
                )}
                <p className="text-base font-medium whitespace-pre-wrap">
                  {msg.content.split('\n').map((line, i) => {
                    // Check if line contains a URL
                    const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                    if (urlMatch) {
                      const parts = line.split(urlMatch[0]);
                      return (
                        <span key={i}>
                          {parts[0]}
                          <a
                            href={urlMatch[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-400 hover:text-red-300 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {urlMatch[0]}
                          </a>
                          {parts[1]}
                          {i < msg.content.split('\n').length - 1 && <br />}
                        </span>
                      );
                    }
                    return (
                      <span key={i}>
                        {line}
                        {i < msg.content.split('\n').length - 1 && <br />}
                      </span>
                    );
                  })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 border-t border-white/10 bg-black/40">
        {!userIdentifier ? (
          <button
            onClick={onRequestIdentifier}
            className="w-full bg-black text-yellow-400 hover:bg-black/90 font-bold tracking-wide px-6 py-4 rounded-2xl transition-colors shadow-lg"
          >
            GET AN IDENTIFIER TO PARTICIPATE
          </button>
        ) : (
          <div className="flex gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="w-16 h-16 bg-black text-yellow-400 hover:bg-black/90 rounded-2xl disabled:opacity-50 transition-colors shadow-xl flex items-center justify-center border-2 border-black/20"
            >
              {uploadingPhoto ? <div className="w-6 h-6 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" /> : <ImageIcon size={24} strokeWidth={2.5} />}
            </button>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Your message..."
              className="flex-1 bg-white border-black/10 text-black placeholder:text-black text-base font-medium rounded-2xl px-5"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="w-16 h-16 bg-black text-yellow-400 hover:bg-black/90 rounded-2xl disabled:opacity-50 transition-colors shadow-xl flex items-center justify-center border-2 border-black/20"
            >
              <Send size={24} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {/* Profile Viewer */}
      <ProfileViewer
        isOpen={!!viewingProfile}
        onClose={() => setViewingProfile(null)}
        profile={viewingProfile}
        onSendMessage={onOpenPrivateChat}
      />

      {/* User Grid Drawer */}
      <UserGridDrawer
        salon={salon}
        isOpen={gridOpen}
        onClose={() => setGridOpen(false)}
      />
    </div>
  );
}