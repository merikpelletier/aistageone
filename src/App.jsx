import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

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
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/Membership" element={<LayoutWrapper currentPageName="Membership"><MembershipPage /></LayoutWrapper>} />
      <Route path="/Soumettre" element={<LayoutWrapper currentPageName="Soumettre"><SoumettreePage /></LayoutWrapper>} />
      <Route path="/MemberDashboard" element={<LayoutWrapper currentPageName="MemberDashboard"><MemberDashboardPage /></LayoutWrapper>} />
      <Route path="/SponsorRequest" element={<LayoutWrapper currentPageName="SponsorRequest"><SponsorRequestPage /></LayoutWrapper>} />
      <Route path="/MemberListing" element={<LayoutWrapper currentPageName="MemberListing"><MemberListingPage /></LayoutWrapper>} />
      <Route path="/Studio" element={<LayoutWrapper currentPageName="Studio"><StudioPage /></LayoutWrapper>} />
      <Route path="/MyProjects" element={<LayoutWrapper currentPageName="MyProjects"><MyProjectsPage /></LayoutWrapper>} />
      <Route path="/CampaignSubscribe" element={<LayoutWrapper currentPageName="CampaignSubscribe"><CampaignSubscribePage /></LayoutWrapper>} />
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
