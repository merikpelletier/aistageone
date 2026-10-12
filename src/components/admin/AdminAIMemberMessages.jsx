import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inbox, Loader2, Mail, Send } from 'lucide-react';

const formatDate = value => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleString();
};

const safeReplySubject = subject => {
  const value = String(subject || '').trim();
  if (!value) return 'Reply from AI Stage One';
  return /^re:/i.test(value) ? value : `Re: ${value}`;
};

export default function AdminAIMemberMessages({ members = [] }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['ai-member-messages'],
    queryFn: () => base44.entities.AIMemberMessage.list('-created_date', 500),
  });

  const refreshMessages = () => qc.invalidateQueries({ queryKey: ['ai-member-messages'] });

  const selectedMessage = useMemo(
    () => messages.find(message => message.id === selectedId) || null,
    [messages, selectedId],
  );

  const selectedThread = useMemo(() => {
    if (!selectedMessage) return [];
    return messages
      .filter(message => message.thread_id === selectedMessage.thread_id)
      .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
  }, [messages, selectedMessage]);

  const incomingMessages = useMemo(
    () => messages.filter(message => message.direction === 'incoming'),
    [messages],
  );

  const markRead = useMutation({
    mutationFn: id => base44.entities.AIMemberMessage.update(id, {
      status: 'read',
      read_at: new Date().toISOString(),
    }),
    onSuccess: refreshMessages,
  });

  const selectMessage = message => {
    setSelectedId(message.id);
    setReplyText('');
    setReplyError('');
    if (message.status === 'unread') markRead.mutate(message.id);
  };

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!selectedMessage || !replyText.trim()) return;
      const member = members.find(item => item.id === selectedMessage.ai_member_id);
      const recipient = String(selectedMessage.sender_email || '').trim();
      if (!recipient) throw new Error('This conversation has no reply email address.');

      const subject = safeReplySubject(selectedMessage.subject);
      const content = replyText.trim();
      const signature = member?.display_name || 'AI Stage One';

      await base44.integrations.Core.SendEmail({
        to: recipient,
        subject,
        body: `<p>${content.replace(/\n/g, '<br>')}</p><p>— ${signature}</p>`,
      });

      await base44.entities.AIMemberMessage.create({
        ai_member_id: selectedMessage.ai_member_id,
        thread_id: selectedMessage.thread_id,
        direction: 'outgoing',
        sender_name: signature,
        sender_email: recipient,
        subject,
        content,
        status: 'sent',
        reply_to_id: selectedMessage.id,
        sent_by: 'admin',
      });
    },
    onSuccess: () => {
      setReplyText('');
      setReplyError('');
      refreshMessages();
    },
    onError: error => setReplyError(error.message || 'Reply failed.'),
  });

  const memberName = id => members.find(member => member.id === id)?.display_name || 'Unknown AI Member';
  const unreadCount = incomingMessages.filter(message => message.status === 'unread').length;

  return (
    <div className="space-y-4">
      <div className="border border-white/15 bg-neutral-950 p-4 flex items-center gap-3">
        <div className="w-10 h-10 border border-white/15 flex items-center justify-center">
          <Inbox size={18} />
        </div>
        <div>
          <h3 className="text-sm font-medium">AI Member Inbox</h3>
          <p className="text-xs text-white/45">Messages sent from AI Member public profiles. {unreadCount} unread.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.65fr)] gap-4 min-h-[520px]">
        <div className="border border-white/10 bg-neutral-950 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 text-xs uppercase tracking-wider text-white/45">Conversations</div>
          {isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 size={18} className="animate-spin text-white/40" /></div>
          ) : incomingMessages.length === 0 ? (
            <div className="p-6 text-center text-sm text-white/40">No AI Member messages yet.</div>
          ) : (
            <div className="max-h-[650px] overflow-y-auto">
              {incomingMessages.map(message => (
                <button
                  key={message.id}
                  onClick={() => selectMessage(message)}
                  className={`w-full text-left p-4 border-b border-white/10 transition-colors ${selectedId === message.id ? 'bg-white text-black' : 'hover:bg-white/5'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] uppercase tracking-wider ${selectedId === message.id ? 'text-black/60' : 'text-teal-300'}`}>{memberName(message.ai_member_id)}</span>
                    {message.status === 'unread' && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                  </div>
                  <p className="font-medium text-sm mt-1 truncate">{message.sender_name || message.sender_email || 'Visitor'}</p>
                  <p className={`text-xs mt-1 truncate ${selectedId === message.id ? 'text-black/65' : 'text-white/55'}`}>{message.subject}</p>
                  <p className={`text-[11px] mt-2 ${selectedId === message.id ? 'text-black/45' : 'text-white/30'}`}>{formatDate(message.created_date)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border border-white/10 bg-neutral-950 flex flex-col min-h-[520px]">
          {!selectedMessage ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div><Mail size={28} className="mx-auto text-white/20 mb-3" /><p className="text-sm text-white/40">Select a conversation.</p></div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-white/10">
                <p className="text-xs uppercase tracking-wider text-teal-300">{memberName(selectedMessage.ai_member_id)}</p>
                <h3 className="text-lg font-medium mt-1">{selectedMessage.subject}</h3>
                <p className="text-xs text-white/45 mt-1">{selectedMessage.sender_name} · {selectedMessage.sender_email}</p>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[420px]">
                {selectedThread.map(message => (
                  <div key={message.id} className={`flex ${message.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 border ${message.direction === 'outgoing' ? 'bg-teal-400/10 border-teal-400/30' : 'bg-white/5 border-white/10'}`}>
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40 mb-1">
                        <span>{message.direction === 'outgoing' ? memberName(message.ai_member_id) : (message.sender_name || 'Visitor')}</span>
                        <span>·</span>
                        <span>{message.sent_by}</span>
                      </div>
                      <p className="text-sm text-white/80 whitespace-pre-wrap">{message.content}</p>
                      <p className="text-[10px] text-white/30 mt-2">{formatDate(message.created_date)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t border-white/10 space-y-2">
                <textarea
                  value={replyText}
                  onChange={event => setReplyText(event.target.value)}
                  rows={4}
                  placeholder={`Reply as ${memberName(selectedMessage.ai_member_id)}...`}
                  className="input-ai w-full resize-none"
                />
                {replyError && <p className="text-xs text-red-300">{replyError}</p>}
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-white/35">Manual admin reply. AI replies remain off until configured.</p>
                  <button
                    onClick={() => sendReply.mutate()}
                    disabled={!replyText.trim() || sendReply.isPending}
                    className="px-4 py-2 bg-white text-black text-sm flex items-center gap-2 disabled:opacity-40"
                  >
                    <Send size={14} /> {sendReply.isPending ? 'Sending...' : 'Send reply'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
