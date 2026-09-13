import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MessageCircle, User } from 'lucide-react';
import PrivateChat from '@/components/PrivateChat';

export default function PrivateConversations({ currentUser }) {
  const [selectedConversation, setSelectedConversation] = useState(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['privateConversations', currentUser.session_id],
    queryFn: async () => {
      const sent = await base44.entities.PrivateMessage.filter({
        from_session_id: currentUser.session_id
      }, '-created_date', 100);
      const received = await base44.entities.PrivateMessage.filter({
        to_session_id: currentUser.session_id
      }, '-created_date', 100);
      return [...sent, ...received];
    },
    refetchInterval: 5000
  });

  // Group messages by conversation partner
  const conversations = {};
  messages.forEach(msg => {
    const partnerId = msg.from_session_id === currentUser.session_id 
      ? msg.to_session_id 
      : msg.from_session_id;
    const partnerIdentifier = msg.from_session_id === currentUser.session_id 
      ? msg.to_identifier 
      : msg.from_identifier;
    
    if (!conversations[partnerId]) {
      conversations[partnerId] = {
        session_id: partnerId,
        identifier: partnerIdentifier,
        lastMessage: msg,
        unreadCount: 0
      };
    }
    
    // Update last message if more recent
    if (new Date(msg.created_date) > new Date(conversations[partnerId].lastMessage.created_date)) {
      conversations[partnerId].lastMessage = msg;
    }
    
    // Count unread
    if (msg.to_session_id === currentUser.session_id && !msg.read) {
      conversations[partnerId].unreadCount++;
    }
  });

  const conversationList = Object.values(conversations).sort((a, b) => 
    new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date)
  );

  const handleOpenChat = async (conversation) => {
    try {
      const users = await base44.entities.TemporaryUser.filter({ 
        session_id: conversation.session_id,
        is_active: true 
      });
      if (users && users.length > 0) {
        setSelectedConversation(users[0]);
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (conversationList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <MessageCircle className="w-12 h-12 text-white mb-4" />
        <p className="text-white text-sm">No conversations</p>
        <p className="text-white text-xs mt-2">
          Click on a profile to start a conversation
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-y-auto">
        {conversationList.map((conv) => (
          <motion.button
            key={conv.session_id}
            onClick={() => handleOpenChat(conv)}
            className="w-full px-4 py-4 border-b border-white/10 hover:bg-white/5 transition-colors text-left"
            whileHover={{ x: 4 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <User size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-light">
                    {conv.identifier}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-white text-xs truncate">
                  {conv.lastMessage.photo_url ? '📷 Photo' : conv.lastMessage.content}
                </p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {selectedConversation && (
        <PrivateChat
          isOpen={!!selectedConversation}
          onClose={() => setSelectedConversation(null)}
          otherUser={selectedConversation}
          currentUser={currentUser}
        />
      )}
    </>
  );
}