import React, { useState } from 'react';
import { base44, supabase } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Inbox, Send, MessageSquare, Loader2, FileText, ShieldAlert } from 'lucide-react';

export default function MemberInboxSection({ userEmail }) {
  const [tab, setTab] = useState('received');

  const { data, isLoading } = useQuery({
    queryKey: ['memberMessages', userEmail],
    queryFn: async () => {
      const [regularRes, systemRes] = await Promise.all([
        base44.functions.invoke('getMemberMessages', { memberEmail: userEmail }),
        supabase.from('member_system_message').select('id,subject,message,created_at,read_at,message_type').eq('member_email', userEmail).order('created_at', { ascending: false }),
      ]);
      if (systemRes.error) throw systemRes.error;
      const regular = regularRes.data || {};
      const systemMessages = (systemRes.data || []).map(item => ({
        id: `system:${item.id}`, user_name: 'AI Stage One Administration', user_email: '', content: item.message,
        source_title: item.subject, source_type: 'system', date: item.created_at, read: !!item.read_at,
        status: item.read_at ? 'read' : 'unread', is_system_message: true, message_type: item.message_type,
      }));
      const received = [...systemMessages, ...(regular.received || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      return { ...regular, received, unreadCount: (regular.unreadCount || 0) + systemMessages.filter(item => !item.read).length };
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
    <div className="bg-black border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl lg:rounded-[1vw] lg:p-[2%] lg:space-y-[1.5%]">
      <div className="flex items-center justify-between gap-3 lg:gap-[2%]">
        <div className="flex items-center gap-3 lg:gap-[2%] min-w-0">
          <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center relative lg:w-[6%] lg:aspect-square lg:h-auto lg:rounded-[20%]">
            <Inbox className="text-black w-1/2 h-1/2" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center lg:w-[45%] lg:aspect-square lg:h-auto lg:text-[0.55vw]">{unreadCount}</span>}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xl font-bold uppercase tracking-wider lg:text-[1.15vw] truncate">Messages & Comments</p>
            <p className="text-white/50 text-xs font-medium lg:text-[0.68vw]">Activity on your content and yours</p>
          </div>
        </div>

        <div className="flex gap-2 lg:gap-[0.5vw] lg:w-[30%]">
          <button onClick={() => setTab('received')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors lg:gap-[4%] lg:py-[3%] lg:text-[0.64vw] lg:rounded-[0.5vw] ${tab === 'received' ? 'bg-white text-black' : 'bg-white/5 text-white/50 hover:text-white'}`}>
            <Inbox className="w-[0.75vw] h-[0.75vw]" />Received
          </button>
          <button onClick={() => setTab('sent')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors lg:gap-[4%] lg:py-[3%] lg:text-[0.64vw] lg:rounded-[0.5vw] ${tab === 'sent' ? 'bg-white text-black' : 'bg-white/5 text-white/50 hover:text-white'}`}>
            <Send className="w-[0.75vw] h-[0.75vw]" />Sent
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8 lg:py-[2%]"><Loader2 className="animate-spin text-white/30 w-[1vw] h-[1vw]" /></div>
      ) : list.length === 0 ? (
        <div className="flex items-center gap-3 border-t border-white/10 pt-4 lg:gap-[1.5%] lg:pt-[1.5%]">
          <MessageSquare className="text-white/20 w-[1vw] h-[1vw]" />
          <p className="text-white/40 text-sm lg:text-[0.72vw]">{tab === 'received' ? 'No messages or comments received yet.' : 'You haven\'t commented on anything yet.'}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 lg:space-y-[0.7%] lg:max-h-[18vw] lg:pr-[0.5%]">
          {list.map((item, idx) => {
            const isReceived = tab === 'received';
            const authorName = isReceived ? (item.user_name || item.author_name || 'Someone') : (item.user_name || item.author_name || 'You');
            const authorEmail = isReceived ? (item.user_email || item.author_email || '') : (item.user_email || item.author_email || userEmail);
            const content = item.content || item.message || '';
            const sourceLink = item.source_type === 'dossier' ? `/Magazine?dossier=${item.source_id}` : null;

            return (
              <motion.div key={item.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className={`flex gap-3 p-3 rounded-xl border lg:grid lg:grid-cols-[5%_1fr_auto] lg:items-start lg:gap-[1.5%] lg:p-[1.2%] lg:rounded-[0.6vw] ${item.is_system_message ? 'bg-red-500/5 border-red-500/25' : isReceived && !item.read && item.status !== 'read' ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-white/5 border-white/10'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 lg:w-full lg:aspect-square lg:h-auto ${item.is_system_message ? 'bg-red-500/15' : 'bg-white/10'}`}>
                  {item.is_system_message ? <ShieldAlert className="text-red-300 w-2/5 h-2/5" /> : <span className="text-white/60 text-sm font-bold uppercase lg:text-[0.72vw]">{authorName.charAt(0)}</span>}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap lg:gap-[1%]">
                    <p className="text-white text-sm font-bold truncate lg:text-[0.74vw]">{authorName}</p>
                    {item.is_system_message && <span className="text-[10px] uppercase tracking-wider text-red-300 border border-red-500/30 px-1.5 py-0.5 lg:text-[0.5vw] lg:px-[1%]">Administrative</span>}
                    {isReceived && !item.read && item.status !== 'read' && <span className="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0 lg:w-[0.4vw] lg:h-[0.4vw]" />}
                  </div>
                  {authorEmail && authorEmail !== userEmail && <p className="text-white/30 text-xs truncate lg:text-[0.6vw]">{authorEmail}</p>}
                  <p className="text-white/70 text-sm mt-1 line-clamp-2 lg:text-[0.68vw] lg:mt-[0.5%]">{content}</p>
                  <div className="flex items-center gap-2 mt-1.5 lg:gap-[1%] lg:mt-[0.7%]">
                    {sourceLink ? (
                      <Link to={sourceLink} className="flex items-center gap-1 text-yellow-400/80 text-xs hover:text-yellow-400 transition-colors lg:text-[0.58vw]"><FileText className="w-[0.6vw] h-[0.6vw]" /><span className="truncate max-w-[180px] lg:max-w-none">{item.source_title}</span></Link>
                    ) : <span className="text-white/30 text-xs truncate max-w-[220px] lg:text-[0.58vw] lg:max-w-none">{item.source_title}</span>}
                  </div>
                </div>

                <span className="text-white/30 text-xs lg:text-[0.58vw] whitespace-nowrap">{formatDate(item.date)}</span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
