import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import MembershipPage from './pages/Membership';
import SoumettreePage from './pages/Soumettre';
import MemberDashboardPage from './pages/MemberDashboard';
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

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const PrivateRoute = ({ children }) => {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  if (isLoadingAuth) return <div className="fixed inset-0 flex items-center justify-center bg-black"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>;
  if (!isAuthenticated) return <Navigate to={\`/Login?returnTo=\${encodeURIComponent(location.pathname + location.search + location.hash)}\`} replace />;
  if (!['admin', 'guest'].includes(user?.role)) return <Navigate to="/" replace />;
  return children;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings && isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // For auth_required, we still render the app — individual pages handle auth as needed
    // Do NOT redirect here globally, as public pages (Magazine, Index) must be accessible
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<PrelaunchLanding />} />
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
      <Route path="/PitchDeckShare" element={<PrivateRoute><PitchDeckSharePage /></PrivateRoute>} />
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
