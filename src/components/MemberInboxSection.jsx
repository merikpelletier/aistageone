import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Inbox, Send, MessageSquare, Loader2, FileText } from 'lucide-react';

export default function MemberInboxSection({ userEmail }) {
  const [tab, setTab] = useState('received');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['memberMessages', userEmail],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMemberMessages', { memberEmail: userEmail });
      return res.data;
    },
    enabled: !!userEmail,
  });

  const received = data?.received || [];
  const sent = data?.sent || [];
  const unreadCount = data?.unreadCount || 0;
  const list = tab === 'received' ? received : sent;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center relative">
          <Inbox size={20} className="text-black" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
        <div>
          <p className="text-white text-xl font-bold uppercase tracking-wider">Messages & Comments</p>
          <p className="text-white/50 text-xs font-medium">Activity on your content and yours</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('received')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors ${
            tab === 'received' ? 'bg-white text-black' : 'bg-white/5 text-white/50 hover:text-white'
          }`}
        >
          <Inbox size={14} />
          Received
          {unreadCount > 0 && (
            <span className={`text-xs px-1.5 rounded-full ${tab === 'received' ? 'bg-black/20' : 'bg-red-500 text-white'}`}>
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors ${
            tab === 'sent' ? 'bg-white text-black' : 'bg-white/5 text-white/50 hover:text-white'
          }`}
        >
          <Send size={14} />
          Sent
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-white/30" />
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare size={32} className="text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">
            {tab === 'received' ? 'No messages or comments received yet.' : 'You haven\'t commented on anything yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {list.map((item, idx) => {
            const isReceived = tab === 'received';
            const authorName = isReceived
              ? (item.user_name || item.author_name || 'Someone')
              : (item.user_name || item.author_name || 'You');
            const authorEmail = isReceived
              ? (item.user_email || item.author_email || '')
              : (item.user_email || item.author_email || userEmail);
            const content = item.content || item.message || '';
            const sourceLink = item.source_type === 'dossier'
              ? `/Magazine?dossier=${item.source_id}`
              : null;

            return (
              <motion.div
                key={item.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`flex gap-3 p-3 rounded-xl border ${
                  isReceived && !item.read && item.status !== 'read'
                    ? 'bg-yellow-400/5 border-yellow-400/20'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-white/60 text-sm font-bold uppercase">
                    {authorName.charAt(0)}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-bold truncate">{authorName}</p>
                    {isReceived && !item.read && item.status !== 'read' && (
                      <span className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  {authorEmail && authorEmail !== userEmail && (
                    <p className="text-white/30 text-xs truncate">{authorEmail}</p>
                  )}
                  <p className="text-white/70 text-sm mt-1 line-clamp-3">{content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {sourceLink ? (
                      <Link to={sourceLink} className="flex items-center gap-1 text-yellow-400/80 text-xs hover:text-yellow-400 transition-colors">
                        <FileText size={10} />
                        <span className="truncate max-w-[140px]">{item.source_title}</span>
                      </Link>
                    ) : (
                      <span className="text-white/30 text-xs truncate max-w-[140px]">{item.source_title}</span>
                    )}
                    <span className="text-white/20 text-xs">·</span>
                    <span className="text-white/30 text-xs">{formatDate(item.date)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}