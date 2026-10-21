import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Input } from "@/components/ui/input";
import { Send, Users, Lock, Image as ImageIcon, Eye, Heart, MessageCircle, Share2, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ProfileViewer from '@/components/ProfileViewer';
import UserGridDrawer from '@/components/UserGridDrawer';

export default function ChatRoom({ salon, salonStatus, userIdentifier, sessionId, onRequestIdentifier, onOpenPrivateChat }) {
  const [gridOpen, setGridOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [viewingProfile, setViewingProfile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [openComments, setOpenComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [copiedPostId, setCopiedPostId] = useState(null);
  const [likeErrors, setLikeErrors] = useState({});
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: messages = [] } = useQuery({
    queryKey: ['chatMessages', salon],
    queryFn: () => base44.entities.ChatMessage.filter({ salon }, 'created_date', 50),
    refetchInterval: 3000,
    enabled: salonStatus?.is_open !== false
  });

  const { data: likes = [] } = useQuery({
    queryKey: ['chatMessageLikes', salon],
    queryFn: () => base44.entities.ChatMessageLike.filter({ salon }, 'created_date', 500),
    refetchInterval: 3000,
    enabled: salonStatus?.is_open !== false
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['chatMessageComments', salon],
    queryFn: () => base44.entities.ChatMessageComment.filter({ salon }, 'created_date', 500),
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

  const likeMutation = useMutation({
    mutationFn: ({ messageId }) => base44.entities.ChatMessageLike.create({
      salon,
      message_id: messageId,
      user_identifier: userIdentifier,
      session_id: sessionId
    }),
    onMutate: async ({ messageId }) => {
      setLikeErrors((current) => ({ ...current, [messageId]: null }));
      await queryClient.cancelQueries({ queryKey: ['chatMessageLikes', salon] });
      const previousLikes = queryClient.getQueryData(['chatMessageLikes', salon]) || [];
      queryClient.setQueryData(['chatMessageLikes', salon], [
        ...previousLikes,
        {
          id: `optimistic-${messageId}-${userIdentifier}`,
          salon,
          message_id: messageId,
          user_identifier: userIdentifier,
          session_id: sessionId,
          __optimistic: true
        }
      ]);
      return { previousLikes, messageId };
    },
    onError: (error, variables, context) => {
      if (context?.previousLikes) {
        queryClient.setQueryData(['chatMessageLikes', salon], context.previousLikes);
      }
      setLikeErrors((current) => ({
        ...current,
        [variables.messageId]: error?.message || 'Like could not be saved.'
      }));
      console.error('Error liking Chat Room post:', error);
    },
    onSuccess: (_, variables) => {
      setLikeErrors((current) => ({ ...current, [variables.messageId]: null }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chatMessageLikes', salon] });
    }
  });

  const commentMutation = useMutation({
    mutationFn: ({ messageId, content }) => base44.entities.ChatMessageComment.create({
      salon,
      message_id: messageId,
      author_identifier: userIdentifier,
      session_id: sessionId,
      content
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chatMessageComments', salon] });
      setCommentDrafts((current) => ({ ...current, [variables.messageId]: '' }));
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

  const handleLike = (messageId) => {
    if (!userIdentifier) {
      onRequestIdentifier();
      return;
    }

    const alreadyLiked = likes.some(
      (like) => like.message_id === messageId && like.user_identifier === userIdentifier
    );

    if (!alreadyLiked && !likeMutation.isPending) {
      likeMutation.mutate({ messageId });
    }
  };

  const handleCommentSubmit = (messageId) => {
    const content = (commentDrafts[messageId] || '').trim();
    if (!content) return;
    if (!userIdentifier) {
      onRequestIdentifier();
      return;
    }

    commentMutation.mutate({ messageId, content });
  };

  const handleShare = async (msg) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#chat-post-${msg.id}`;
    const shareText = msg.content === '📷 Photo' ? 'Photo from AISTAGE.ONE Chat Rooms' : msg.content;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'AISTAGE.ONE Chat Rooms',
          text: shareText,
          url: shareUrl
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setCopiedPostId(msg.id);
      window.setTimeout(() => setCopiedPostId(null), 1800);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Error sharing post:', error);
      }
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
      <div className="flex-1 overflow-y-auto p-6 space-y-10">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const messageLikes = likes.filter((like) => like.message_id === msg.id);
            const messageComments = comments.filter((comment) => comment.message_id === msg.id);
            const isLiked = messageLikes.some((like) => like.user_identifier === userIdentifier);
            const commentsOpen = !!openComments[msg.id];
            const likeError = likeErrors[msg.id];

            return (
              <motion.article
                id={`chat-post-${msg.id}`}
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[640px] mx-auto bg-black/80 backdrop-blur-sm border border-white/20 shadow-2xl text-white overflow-hidden"
              >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
                  <button
                    onClick={() => !msg.is_admin && handleViewProfile(msg.sender_identifier)}
                    className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm border ${
                      msg.is_admin
                        ? 'bg-red-600 border-red-500 text-white cursor-default'
                        : 'bg-white/10 border-white/20 text-white hover:bg-white/20 cursor-pointer'
                    } transition-colors`}
                    aria-label={`View ${msg.sender_identifier} profile`}
                  >
                    {(msg.sender_identifier || '?').charAt(0).toUpperCase()}
                  </button>

                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => !msg.is_admin && handleViewProfile(msg.sender_identifier)}
                      className={`block max-w-full truncate text-sm font-bold ${
                        msg.is_admin ? 'text-red-400 cursor-default' : 'text-white hover:text-white/80 cursor-pointer'
                      } transition-colors`}
                    >
                      {msg.sender_identifier}
                      {msg.is_admin && ' • Admin'}
                    </button>
                    {msg.created_date && (
                      <div className="text-xs text-white/50 mt-0.5">
                        {new Date(msg.created_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4">
                  {msg.photo_url && (
                    <img
                      src={msg.photo_url}
                      alt=""
                      className="block w-auto max-w-full max-h-[450px] object-contain mx-auto cursor-pointer border border-white/10"
                      onClick={() => window.open(msg.photo_url, '_blank')}
                    />
                  )}

                  {(!msg.photo_url || msg.content !== '📷 Photo') && (
                    <p className={`text-base font-medium whitespace-pre-wrap ${msg.photo_url ? 'mt-4' : ''}`}>
                      {msg.content.split('\n').map((line, i) => {
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
                  )}
                </div>

                <div className="grid grid-cols-3 border-t border-white/15 bg-black/30">
                  <button
                    onClick={() => handleLike(msg.id)}
                    disabled={likeMutation.isPending && !isLiked}
                    className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
                      isLiked ? 'text-red-400 bg-white/5' : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                    <span>{isLiked ? 'Liked' : 'Like'}{messageLikes.length > 0 ? ` ${messageLikes.length}` : ''}</span>
                  </button>

                  <button
                    onClick={() => setOpenComments((current) => ({ ...current, [msg.id]: !current[msg.id] }))}
                    className={`flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors border-l border-white/10 ${
                      commentsOpen ? 'text-white bg-white/5' : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <MessageCircle size={18} />
                    <span>Comment{messageComments.length > 0 ? ` ${messageComments.length}` : ''}</span>
                  </button>

                  <button
                    onClick={() => handleShare(msg)}
                    className="flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors border-l border-white/10"
                  >
                    {copiedPostId === msg.id ? <Check size={18} /> : <Share2 size={18} />}
                    <span>{copiedPostId === msg.id ? 'Copied' : 'Share'}</span>
                  </button>
                </div>

                {likeError && (
                  <div className="px-5 py-2 border-t border-red-500/30 bg-red-950/40 text-red-300 text-xs">
                    Like error: {likeError}
                  </div>
                )}

                {commentsOpen && (
                  <div className="border-t border-white/10 px-5 py-4 space-y-4">
                    {messageComments.length > 0 && (
                      <div className="space-y-3">
                        {messageComments.map((comment) => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 shrink-0 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-xs font-bold">
                              {(comment.author_identifier || '?').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1 bg-white/5 px-3 py-2">
                              <div className="text-xs font-bold text-white mb-1">{comment.author_identifier}</div>
                              <div className="text-sm text-white/85 whitespace-pre-wrap">{comment.content}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Input
                        value={commentDrafts[msg.id] || ''}
                        onChange={(e) => setCommentDrafts((current) => ({ ...current, [msg.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCommentSubmit(msg.id);
                          }
                        }}
                        placeholder="Write a comment..."
                        className="flex-1 bg-white text-black placeholder:text-black/50 border-white/20"
                      />
                      <button
                        onClick={() => handleCommentSubmit(msg.id)}
                        disabled={!(commentDrafts[msg.id] || '').trim() || commentMutation.isPending}
                        className="w-11 h-10 flex items-center justify-center bg-white text-black hover:bg-white/90 disabled:opacity-40 transition-colors"
                        aria-label="Send comment"
                      >
                        <Send size={17} />
                      </button>
                    </div>
                  </div>
                )}
              </motion.article>
            );
          })}
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
