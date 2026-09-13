import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatRoom from '@/components/ChatRoom';
import IdentifierModal from '@/components/IdentifierModal';
import ProfileEditor from '@/components/ProfileEditor';
import PrivateConversations from '@/components/PrivateConversations';
import PrivateChat from '@/components/PrivateChat';
import { User, Settings, Heart, MessageCircle, User as UserIcon, FileText } from 'lucide-react';

export default function Salons() {
  const [activeSalon, setActiveSalon] = useState('contact');
  const [showIdentifierModal, setShowIdentifierModal] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [privateChatWith, setPrivateChatWith] = useState(null);
  const [sessionData, setSessionData] = useState(() => {
    // Utiliser un identifiant unique par appareil pour éviter les conflits
    const deviceId = localStorage.getItem('cochon_device_id') || `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('cochon_device_id', deviceId);
    
    const stored = sessionStorage.getItem(`cochon_session_${deviceId}`);
    return stored ? JSON.parse(stored) : null;
  });

  const queryClient = useQueryClient();

  const { data: salonStatuses = [] } = useQuery({
    queryKey: ['salonStatuses'],
    queryFn: () => base44.entities.SalonStatus.list(),
  });

  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredUser, setRegisteredUser] = useState(null);

  const { data: userMembership } = useQuery({
    queryKey: ['userMembership'],
    queryFn: async () => {
      const isAuth = await base44.auth.isAuthenticated();
      if (!isAuth) return null;
      const user = await base44.auth.me();
      setIsRegistered(true);
      setRegisteredUser(user);
      // Set session data from member identity (no TemporaryUser needed)
      const memberSession = {
        identifier: user.full_name || user.email,
        sessionId: `member_${user.email}`,
        userId: null, // no TemporaryUser record
        isMember: true,
      };
      const deviceId = localStorage.getItem('cochon_device_id');
      setSessionData(memberSession);
      sessionStorage.setItem(`cochon_session_${deviceId}`, JSON.stringify(memberSession));
      const membership = await base44.entities.Membership.filter({ 
        user_email: user.email,
        status: 'approved'
      });
      return membership?.[0] || null;
    },
  });

  const { data: salonLabels = [] } = useQuery({
    queryKey: ['salonLabels'],
    queryFn: () => base44.entities.SalonLabel.list(),
    refetchInterval: 2000,
  });

  const getSalonLabel = (salonId) => {
    return salonLabels.find(l => l?.salon_id === salonId)?.name || '';
  };

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', sessionData?.sessionId],
    queryFn: () => sessionData?.userId 
      ? base44.entities.TemporaryUser.filter({ id: sessionData.userId })
      : Promise.resolve([]),
    enabled: !!sessionData?.userId,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadMessages', sessionData?.sessionId],
    queryFn: async () => {
      if (!sessionData?.sessionId) return 0;
      const messages = await base44.entities.PrivateMessage.filter({
        to_session_id: sessionData.sessionId,
        read: false
      });
      return messages.length;
    },
    refetchInterval: 3000,
    enabled: !!sessionData?.sessionId
  });

  const createIdentifierMutation = useMutation({
    mutationFn: async () => {
      // Only for guests — registered members use their member identity
      const activeUsers = await base44.entities.TemporaryUser.filter({ is_active: true });
      const usedNumbers = activeUsers.map(u => u.identifier_number);
      let nextNumber = 1;
      while (usedNumbers.includes(nextNumber)) {
        nextNumber++;
      }

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const identifier = `Guest ${String(nextNumber).padStart(3, '0')}`;

      const user = await base44.entities.TemporaryUser.create({
        identifier,
        identifier_number: nextNumber,
        session_id: sessionId,
        is_active: true,
        last_activity: new Date().toISOString()
      });

      return { identifier, sessionId, userId: user.id };
    },
    onSuccess: (data) => {
      const deviceId = localStorage.getItem('cochon_device_id');
      setSessionData(data);
      sessionStorage.setItem(`cochon_session_${deviceId}`, JSON.stringify(data));
      setShowIdentifierModal(false);
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: (profileData) => 
      base44.entities.TemporaryUser.update(sessionData.userId, profileData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    }
  });

  const { data: rulesContent } = useQuery({
    queryKey: ['rulesContent'],
    queryFn: () => base44.entities.EditableContent.list(),
  });

  const getSalonStatus = (salon) => {
    return salonStatuses.find(s => s?.salon === salon) || { is_open: true };
  };

  const getRulesText = () => {
    return rulesContent?.find(c => c?.key === 'rules')?.content || '';
  };

  const handleRequestIdentifier = () => {
    setShowIdentifierModal(true);
  };

  const handleConfirmIdentifier = () => {
    createIdentifierMutation.mutate();
  };



  // Désactiver après 30 minutes d'inactivité
  useEffect(() => {
    const cleanupInactive = async () => {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const allUsers = await base44.entities.TemporaryUser.list();
      
      allUsers.forEach(user => {
        if (user.last_activity < thirtyMinutesAgo && user.is_active) {
          base44.entities.TemporaryUser.update(user.id, { is_active: false });
        }
      });
    };

    // Vérifier toutes les 5 minutes
    const interval = setInterval(cleanupInactive, 5 * 60 * 1000);
    cleanupInactive(); // Vérification initiale

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionData?.userId && !sessionData?.isMember) {
        base44.entities.TemporaryUser.update(sessionData.userId, { is_active: false });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionData]);

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-white text-xl font-extralight tracking-widest">CHAT ROOMS</h1>
        
        {sessionData && (
          <div className="flex items-center gap-3">
            <span className="text-white text-sm">{sessionData.identifier}</span>
            {!sessionData.isMember && (
              <button
                onClick={() => setShowProfileEditor(true)}
                className="p-2 text-white hover:text-white transition-colors"
              >
                <Settings size={18} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Salon Tabs */}
      <Tabs value={activeSalon} onValueChange={setActiveSalon} className="h-[calc(100vh-11rem)]">
        <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-auto p-0 overflow-x-auto flex-nowrap text-white">
          <TabsTrigger
            value="messages"
            className="flex-shrink-0 py-3 px-4 text-sm tracking-widest data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white relative whitespace-nowrap flex items-center gap-2"
          >
            <Heart size={24} className="text-white" strokeWidth={2} />
            <span className="hidden sm:inline">PRIVATE</span>
            {unreadCount > 0 && activeSalon !== 'messages' && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="contact"
            className="flex-shrink-0 py-3 px-4 text-sm tracking-widest data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap flex items-center gap-2"
          >
            <MessageCircle size={24} className="text-white" strokeWidth={2} />
            <span className="hidden sm:inline">{getSalonLabel('contact') || 'CONTACT'}</span>
          </TabsTrigger>
          {isRegistered && (
            <TabsTrigger
              value="cochon"
              className="flex-shrink-0 py-3 px-4 text-sm tracking-widest data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap flex items-center gap-2"
            >
              <UserIcon size={24} className="text-white" strokeWidth={2} />
              <span className="hidden sm:inline">{getSalonLabel('cochon') || 'CREATOR CHATS'}</span>
            </TabsTrigger>
          )}
          <TabsTrigger
            value="commercial"
            className="flex-shrink-0 py-3 px-4 text-sm tracking-widest data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap flex items-center gap-2"
          >
            <FileText size={24} className="text-white" strokeWidth={2} />
            <span className="hidden sm:inline">{getSalonLabel('commercial') || 'INFO'}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="h-full mt-0">
          {!sessionData ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              {isRegistered ? (
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <p className="text-white text-sm mb-4">
                    Get an identifier to view your private messages
                  </p>
                  <button
                    onClick={handleRequestIdentifier}
                    className="bg-white text-black hover:bg-white/90 font-light tracking-wider px-4 py-2 rounded-md transition-colors"
                  >
                    GET AN IDENTIFIER
                  </button>
                </>
              )}
            </div>
          ) : (
            <PrivateConversations 
              currentUser={{
                identifier: sessionData.identifier,
                session_id: sessionData.sessionId
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="contact" className="h-full mt-0">
          <ChatRoom
            salon="contact"
            salonStatus={getSalonStatus('contact')}
            userIdentifier={sessionData?.identifier}
            sessionId={sessionData?.sessionId}
            onRequestIdentifier={handleRequestIdentifier}
            onOpenPrivateChat={setPrivateChatWith}
          />
        </TabsContent>

        {isRegistered && (
          <TabsContent value="cochon" className="h-full mt-0">
            <ChatRoom
              salon="cochon"
              salonStatus={getSalonStatus('cochon')}
              userIdentifier={sessionData?.identifier}
              sessionId={sessionData?.sessionId}
              onRequestIdentifier={handleRequestIdentifier}
              onOpenPrivateChat={setPrivateChatWith}
            />
          </TabsContent>
        )}

        <TabsContent value="commercial" className="h-full mt-0">
          <ChatRoom
            salon="commercial"
            salonStatus={getSalonStatus('commercial')}
            userIdentifier={sessionData?.identifier}
            sessionId={sessionData?.sessionId}
            onRequestIdentifier={handleRequestIdentifier}
            onOpenPrivateChat={setPrivateChatWith}
          />
        </TabsContent>
        </Tabs>

        {/* Private Chat */}
        {privateChatWith && sessionData && (
        <PrivateChat
          isOpen={!!privateChatWith}
          onClose={() => setPrivateChatWith(null)}
          otherUser={privateChatWith}
          currentUser={{
            identifier: sessionData.identifier,
            session_id: sessionData.sessionId
          }}
        />
        )}

      {/* Identifier Modal */}
      <IdentifierModal
        isOpen={showIdentifierModal}
        onClose={() => setShowIdentifierModal(false)}
        onConfirm={handleConfirmIdentifier}
        rules={getRulesText()}
      />

      {/* Profile Editor */}
      <ProfileEditor
        isOpen={showProfileEditor}
        onClose={() => setShowProfileEditor(false)}
        profile={userProfile?.[0]}
        onSave={(data) => updateProfileMutation.mutate(data)}
      />
    </div>
  );
}