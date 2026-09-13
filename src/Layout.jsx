import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ConfigurableBottomNav from '@/components/ConfigurableBottomNav';
import InstallPrompt from '@/components/InstallPrompt';
import PersistentAIBar from '@/components/PersistentAIBar';
import { useAppContext } from '@/lib/AppContext';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';

export default function Layout({ children, currentPageName }) {
  const { setAppContext } = useAppContext();
  const { isAuthenticated } = useAuth();
  const [isLandscape, setIsLandscape] = useState(false);
  const { data: runtime } = useQuery({
    queryKey: ['admin-surface-runtime'],
    queryFn: async () => (await base44.functions.invoke('admin-pages-tools', { action: 'runtime' })).data,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Track user activity globally
  useEffect(() => {
    const deviceId = localStorage.getItem('cochon_device_id');
    if (!deviceId) return;

    const storedSession = sessionStorage.getItem(`cochon_session_${deviceId}`);
    if (!storedSession) return;

    let sessionData;
    try {
      sessionData = JSON.parse(storedSession);
    } catch {
      sessionStorage.removeItem(`cochon_session_${deviceId}`);
      return;
    }
    if (!sessionData?.userId) return;

    const updateActivity = () => {
      base44.entities.TemporaryUser.update(sessionData.userId, {
        last_activity: new Date().toISOString()
      }).catch(() => {});
    };

    // Update activity every 2 minutes
    const interval = setInterval(updateActivity, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Broadcast page name into app context
  useEffect(() => {
    const pageLabels = {
      Magazine: 'Magazine (dossier feed)',
      Studio: 'My Studio',
      MyProjects: 'My Projects',
      Index: 'Home / Index',
      Admin: 'Admin Dashboard',
      Membership: 'Membership',
      MemberDashboard: 'Member Dashboard',
      MemberListing: 'Member Listing',
    };
    setAppContext({ page: pageLabels[currentPageName] || currentPageName, section: null, detail: null });
  }, [currentPageName]);

  // Don't show landscape block on admin page or desktop
  const isAdminPage = currentPageName === 'Admin';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const showLandscapeBlock = isLandscape && !isAdminPage && isMobile;



  const settings = runtime?.settings || [];
  const pageSetting = settings.find((item) => item.surface_type === 'page' && item.surface_key === currentPageName);
  const agentBar = settings.find((item) => item.surface_type === 'tool' && item.surface_key === 'agent_bar');
  const bottomNavigation = settings.find((item) => item.surface_type === 'tool' && item.surface_key === 'bottom_navigation');
  const installPrompt = settings.find((item) => item.surface_type === 'tool' && item.surface_key === 'install_prompt');
  const agentPages = agentBar?.configuration?.pages || [];
  const showNav = !isAdminPage && pageSetting?.configuration?.show_navigation !== false && bottomNavigation?.visible !== false && bottomNavigation?.active !== false;
  const showInstallPrompt = showNav && installPrompt?.visible !== false && installPrompt?.active !== false;
  const showAIBar = !isAdminPage && isAuthenticated && agentBar?.visible === true && agentBar?.active === true && (agentPages.length === 0 || agentPages.includes(currentPageName));
  const agentPosition = agentBar?.configuration?.position === 'bottom' ? 'bottom' : 'top';
  const contentWidth = pageSetting?.look?.content_width;
  const pageStyle = {
    backgroundColor: pageSetting?.look?.background_color || undefined,
    '--aistage-admin-accent': pageSetting?.look?.accent_color || '#facc15',
  };
  const contentStyle = {
    paddingTop: showAIBar && agentPosition === 'top' ? 'calc(52px + env(safe-area-inset-top))' : 0,
    paddingBottom: showAIBar && agentPosition === 'bottom' ? 'calc(52px + env(safe-area-inset-bottom))' : 0,
    maxWidth: contentWidth === 'wide' ? 1440 : contentWidth === 'contained' ? 1200 : undefined,
    marginInline: contentWidth === 'wide' || contentWidth === 'contained' ? 'auto' : undefined,
  };

  return (
    <div className="min-h-screen bg-yellow-400" style={pageStyle} data-admin-spacing={pageSetting?.look?.spacing || 'default'}>
      {showLandscapeBlock && (
        <div className="fixed inset-0 bg-yellow-400 z-[9999] flex flex-col items-center justify-center">
          <div className="text-black text-center px-8">
            <div className="text-6xl mb-6">📱</div>
            <p className="text-xl font-light tracking-wide">Portrait mode only</p>
            <p className="text-black text-sm mt-2">Rotate your phone</p>
          </div>
        </div>
      )}
      <style>{`
        :root {
          --background: 51 100% 50%;
          --foreground: 0 0% 0%;
          --card: 51 100% 45%;
          --card-foreground: 0 0% 0%;
          --popover: 51 100% 45%;
          --popover-foreground: 0 0% 0%;
          --primary: 0 0% 0%;
          --primary-foreground: 51 100% 50%;
          --secondary: 51 100% 40%;
          --secondary-foreground: 0 0% 0%;
          --muted: 51 100% 40%;
          --muted-foreground: 0 0% 20%;
          --accent: 0 72% 51%;
          --accent-foreground: 0 0% 100%;
          --destructive: 0 62% 30%;
          --destructive-foreground: 0 0% 100%;
          --border: 0 0% 0%;
          --input: 51 100% 40%;
          --ring: 0 72% 51%;
        }
        
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.2) transparent;
        }
        
        *::-webkit-scrollbar {
          width: 6px;
        }
        
        *::-webkit-scrollbar-track {
          background: transparent;
        }
        
        *::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
          border-radius: 3px;
        }
        
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          -webkit-font-smoothing: antialiased;
          font-weight: 700;
        }
        
        ::selection {
          background: rgba(220, 38, 38, 0.3);
        }
      `}</style>
      
      {showAIBar && <PersistentAIBar agentName={agentBar?.configuration?.agent_name || 'production_assistant'} label={agentBar?.configuration?.label} placeholder={agentBar?.configuration?.placeholder} position={agentPosition} behavior={agentBar?.configuration?.prompt} permissions={agentBar?.configuration?.permissions} actions={agentBar?.configuration?.actions} model={agentBar?.configuration?.model} />}
      <div style={contentStyle}>
        {children}
      </div>
      
      {showNav && (
        <>
          <ConfigurableBottomNav settings={settings} />
          {showInstallPrompt && <InstallPrompt />}
        </>
      )}
    </div>
  );
}
