import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { base44, supabase } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatRoom from '@/components/ChatRoom';
import { useStudioTranslation } from '@/lib/useStudioTranslation';
import IdentifierModal from '@/components/IdentifierModal';
import ProfileEditor from '@/components/ProfileEditor';
import PrivateConversations from '@/components/PrivateConversations';
import PrivateChat from '@/components/PrivateChat';
import { Settings, Mail, Heart, Users, BriefcaseBusiness, Clapperboard } from 'lucide-react';

export default function Salons() {
  const t = useStudioTranslation();
  const location = useLocation();
  const deepLink = new URLSearchParams(location.search);
  const [activeSalon, setActiveSalon] = useState(() => deepLink.get('section') === 'aipilots' ? 'aipilots' : 'contact');
  const [selectedPilotId, setSelectedPilotId] = useState(() => deepLink.get('section') === 'aipilots' ? (deepLink.get('pilotId') || '') : '');
  const [selectedPilotRoom, setSelectedPilotRoom] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('section') !== 'aipilots') return;
    setActiveSalon('aipilots');
    setSelectedPilotId(params.get('pilotId') || '');
    setSelectedPilotRoom('');
  }, [location.search]);
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
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const { data: aiPilots = [] } = useQuery({
    queryKey: ['socialPublishedAiPilots'],
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.from('ai_pilots').select('id,name').eq('status', 'published').order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const selectedPilot = aiPilots.find(p => p.id === selectedPilotId) || aiPilots[0];
  const pilotRoomPrefix = selectedPilot ? `aipilot:${selectedPilot.id}:` : '';
  const pilotRooms = selectedPilot ? [
    { salon_id: `${pilotRoomPrefix}general`, name: t('social.pilots.general', 'General') },
    ...salonLabels.filter(l => l.salon_id?.startsWith(pilotRoomPrefix) && l.salon_id !== `${pilotRoomPrefix}general`)
  ] : [];
  const activePilotRoom = pilotRooms.some(room => room.salon_id === selectedPilotRoom)
    ? selectedPilotRoom : pilotRooms[0]?.salon_id;

  const getSalonLabel = (salonId) => {
    const name = salonLabels.find(l => l?.salon_id === salonId)?.name || '';
    return name ? t(`social.room.label.${name}`, name) : '';
  };

  const pageBackground = (() => {
    const record = salonLabels.find(l => l?.salon_id === '_page_background');
    if (!record?.description) return null;
    try {
      const parsed = JSON.parse(record.description);
      return parsed?.image_url ? parsed : null;
    } catch {
      return null;
    }
  })();

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

  const socialContentClass = "h-full mt-0 lg:[&>div>div:first-child]:absolute lg:[&>div>div:first-child]:top-[-34px] lg:[&>div>div:first-child]:right-[38.5%] lg:[&>div>div:first-child]:z-30 lg:[&>div>div:first-child]:p-0 lg:[&>div>div:first-child]:border-0 lg:[&>div>div:first-child_span]:hidden lg:[&>div>div:nth-child(3)]:!w-[37%] lg:[&>div>div:nth-child(3)]:!right-2 lg:[&>div>div:nth-child(3)]:!-top-[34px]";

  return (
    <div className="relative min-h-screen bg-black pb-24">
      {pageBackground && (
        <>
          <div
            className="fixed inset-0 z-0 pointer-events-none"
            style={{
              backgroundImage: `url(${pageBackground.image_url})`,
              backgroundSize: pageBackground.fit === 'contain' ? 'contain' : 'cover',
              backgroundPosition: pageBackground.position === 'top' ? 'top center' : pageBackground.position === 'bottom' ? 'bottom center' : 'center center',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <div
            className="fixed inset-0 z-0 pointer-events-none bg-black"
            style={{ opacity: pageBackground.overlay ?? 0.5 }}
          />
        </>
      )}
      <div className="relative z-10">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-white text-xl font-extralight tracking-widest">{t("social.rooms.title", "CHAT ROOMS")}</h1>
        
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
      <Tabs value={activeSalon} onValueChange={setActiveSalon} className="h-[calc(100vh-11rem)] lg:relative">
        <TabsList className="w-full bg-transparent border-b border-white/10 rounded-none h-auto p-0 overflow-x-auto flex-nowrap text-white lg:w-[60%] lg:max-w-[60%] lg:h-9 lg:min-h-9 lg:overflow-hidden">
          <TabsTrigger
            value="messages"
            title={t('social.nav.messages', 'Messages')}
            aria-label={t('social.nav.messages', 'Messages')}
            className="flex-1 min-w-0 relative flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap lg:h-9 lg:py-1"
          >
            <Mail size={18} className="shrink-0 lg:w-4 lg:h-4" />
            <span className="hidden sm:inline truncate">{t('social.nav.messages', 'Messages')}</span>
            {unreadCount > 0 && activeSalon !== 'messages' && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="contact"
            title={t('social.nav.fans', 'Fans')}
            aria-label={t('social.nav.fans', 'Fans')}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap lg:h-9 lg:py-1"
          >
            <Heart size={18} className="shrink-0 lg:w-4 lg:h-4" />
            <span className="hidden sm:inline truncate">{t('social.nav.fans', 'Fans')}</span>
          </TabsTrigger>
          {isRegistered && (
            <TabsTrigger
              value="cochon"
              title={t('social.nav.creators', 'Creators')}
              aria-label={t('social.nav.creators', 'Creators')}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap lg:h-9 lg:py-1"
            >
              <Users size={18} className="shrink-0 lg:w-4 lg:h-4" />
              <span className="hidden sm:inline truncate">{t('social.nav.creators', 'Creators')}</span>
            </TabsTrigger>
          )}
          <TabsTrigger
            value="commercial"
            title={t('social.nav.brands', 'Brands')}
            aria-label={t('social.nav.brands', 'Brands')}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap lg:h-9 lg:py-1"
          >
            <BriefcaseBusiness size={18} className="shrink-0 lg:w-4 lg:h-4" />
            <span className="hidden sm:inline truncate">{t('social.nav.brands', 'Brands')}</span>
          </TabsTrigger>
          <TabsTrigger
            value="aipilots"
            title={t('social.nav.aipilots', 'AI PILOTS')}
            aria-label={t('social.nav.aipilots', 'AI PILOTS')}
            className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-red-600 rounded-none text-white whitespace-nowrap lg:h-9 lg:py-1"
          >
            <Clapperboard size={18} className="shrink-0 lg:w-4 lg:h-4" />
            <span className="hidden sm:inline truncate">{t('social.nav.aipilots', 'AI PILOTS')}</span>
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
                    {t("social.rooms.identifierPrivate", "Get an identifier to view your private messages")}
                  </p>
                  <button
                    onClick={handleRequestIdentifier}
                    className="bg-white text-black hover:bg-white/90 font-light tracking-wider px-4 py-2 rounded-md transition-colors"
                  >
                    {t("social.rooms.getIdentifier", "GET AN IDENTIFIER")}
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

        <TabsContent value="contact" className={socialContentClass}>
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
          <TabsContent value="cochon" className={socialContentClass}>
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

        <TabsContent value="commercial" className={socialContentClass}>
          <ChatRoom
            salon="commercial"
            salonStatus={getSalonStatus('commercial')}
            userIdentifier={sessionData?.identifier}
            sessionId={sessionData?.sessionId}
            onRequestIdentifier={handleRequestIdentifier}
            onOpenPrivateChat={setPrivateChatWith}
          />
        </TabsContent>
          <TabsContent value="aipilots" className="h-full mt-0">
            {selectedPilot ? (
              <div className="h-full flex flex-col">
                <div className="flex flex-wrap gap-2 border-b border-white/10 p-2 text-white relative z-10 bg-black/75">
                  <select
                    aria-label={t('social.pilots.selectTitle', 'Select AI Pilot')}
                    value={selectedPilot.id}
                    onChange={e => { setSelectedPilotId(e.target.value); setSelectedPilotRoom(''); }}
                    className="min-w-[160px] flex-1 max-w-full h-9 bg-neutral-950 border border-white/20 px-3 py-1 text-sm"
                  >
                    {aiPilots.map(pilot => <option key={pilot.id} value={pilot.id}>{pilot.name}</option>)}
                  </select>
                  <select
                    aria-label={t('social.pilots.selectRoom', 'Select room')}
                    value={activePilotRoom || ''}
                    onChange={e => setSelectedPilotRoom(e.target.value)}
                    className="min-w-[140px] flex-1 max-w-full h-9 bg-neutral-950 border border-white/20 px-3 py-1 text-sm"
                  >
                    {pilotRooms.map(room => <option key={room.salon_id} value={room.salon_id}>{room.name}</option>)}
                  </select>
                </div>
                {activePilotRoom && (
                  <div className="relative flex-1 min-h-0">
                    <ChatRoom
                      key={activePilotRoom}
                      embedded
                      salon={activePilotRoom}
                      salonStatus={getSalonStatus(activePilotRoom)}
                      userIdentifier={sessionData?.identifier}
                      sessionId={sessionData?.sessionId}
                      onRequestIdentifier={handleRequestIdentifier}
                      onOpenPrivateChat={setPrivateChatWith}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="p-6 text-sm text-white/70">{t('social.pilots.noTitles', 'No AI Pilots available.')}</p>
            )}
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
    </div>
  );
}
