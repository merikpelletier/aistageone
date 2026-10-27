import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import StudioRecorderLauncher from '@/components/studio/StudioRecorderLauncher'
import StudioAIAssistant from '@/components/studio/StudioAIAssistant'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Circle, Sparkles } from 'lucide-react';
import PageNotFound from './lib/PageNotFound';
import MembershipPage from './pages/Membership';
import SoumettreePage from './pages/Soumettre';
import MemberDashboardPage from './pages/MemberDashboardResponsive';
import SponsorRequestPage from './pages/SponsorRequest';
import MemberListingPage from './pages/MemberListing';
import StudioPage from './pages/Studio';
import MyProjectsPage from './pages/MyProjects';
import CampaignSubscribePage from './pages/CampaignSubscribe';
import LoginPage from './pages/Login';
import ResetPasswordPage from './pages/ResetPassword';
import PitchDeckSharePage from './pages/PitchDeckShare';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { AppContextProvider } from '@/lib/AppContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import PrelaunchLanding from './pages/PrelaunchLanding';

const { Pages, Layout } = pagesConfig;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const StudioMobileUtilities = () => {
  const location = useLocation();
  if (location.pathname.toLowerCase() !== '/studio') return null;

  const openLauncher = (ariaLabel) => {
    const trigger = document.querySelector(`button[aria-label="${ariaLabel}"]`);
    trigger?.click();
  };

  return (
    <div className="lg:hidden fixed z-[6250] left-3 right-3 bottom-[74px] flex items-center justify-between pointer-events-none">
      <button
        type="button"
        onClick={() => openLauncher('Open AI Assistant')}
        className="pointer-events-auto h-11 px-3 bg-teal-500 text-black font-bold text-xs flex items-center gap-2 shadow-lg"
        aria-label="Open AI Assistant on mobile"
      >
        <Sparkles size={14} /> AI Assistant
      </button>
      <button
        type="button"
        onClick={() => openLauncher('Open Studio Recorder')}
        className="pointer-events-auto h-11 px-3 bg-red-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
        aria-label="Open Studio Recorder on mobile"
      >
        <Circle size={11} fill="currentColor" /> Studio Recorder
      </button>
    </div>
  );
};

const PrivateRoute = ({ children }) => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  if (isLoadingAuth) return <div className="fixed inset-0 flex items-center justify-center bg-black"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>;
  if (!isAuthenticated) return <Navigate to={`/Login?returnTo=${encodeURIComponent(location.pathname + location.search + location.hash)}`} replace />;
  if (!['admin', 'guest'].includes(user?.role)) return <Navigate to="/" replace />;
  return children;
};

const HomeRoute = () => {
  const { user, isAuthenticated } = useAuth();

  if (isAuthenticated && ['admin', 'guest'].includes(user?.role)) {
    return <Navigate to="/Index" replace />;
  }

  return <PrelaunchLanding />;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings && isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <PrivateRoute>
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            </PrivateRoute>
          }
        />
      ))}
      <Route path="/Membership" element={<PrivateRoute><LayoutWrapper currentPageName="Membership"><MembershipPage /></LayoutWrapper></PrivateRoute>} />
      <Route path="/Soumettre" element={<PrivateRoute><LayoutWrapper currentPageName="Soumettre"><SoumettreePage /></LayoutWrapper></PrivateRoute>} />
      <Route path="/MemberDashboard" element={<PrivateRoute><LayoutWrapper currentPageName="MemberDashboard"><MemberDashboardPage /></LayoutWrapper></PrivateRoute>} />
      <Route path="/SponsorRequest" element={<PrivateRoute><LayoutWrapper currentPageName="SponsorRequest"><SponsorRequestPage /></LayoutWrapper></PrivateRoute>} />
      <Route path="/MemberListing" element={<PrivateRoute><LayoutWrapper currentPageName="MemberListing"><MemberListingPage /></LayoutWrapper></PrivateRoute>} />
      <Route path="/Studio" element={<PrivateRoute><LayoutWrapper currentPageName="Studio"><StudioPage /></LayoutWrapper></PrivateRoute>} />
      <Route path="/MyProjects" element={<PrivateRoute><LayoutWrapper currentPageName="MyProjects"><MyProjectsPage /></LayoutWrapper></PrivateRoute>} />
      <Route path="/CampaignSubscribe" element={<PrivateRoute><LayoutWrapper currentPageName="CampaignSubscribe"><CampaignSubscribePage /></LayoutWrapper></PrivateRoute>} />
      <Route path="/Login" element={<LoginPage />} />
      <Route path="/ResetPassword" element={<ResetPasswordPage />} />
      <Route path="/PitchDeckShare" element={<PitchDeckSharePage />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AppContextProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <NavigationTracker />
            <StudioRecorderLauncher />
            <StudioAIAssistant />
            <StudioMobileUtilities />
            <AuthenticatedApp />
          </Router>
          <Toaster />
          <SonnerToaster position="top-center" richColors />
        </QueryClientProvider>
      </AuthProvider>
    </AppContextProvider>
  )
}

export default App