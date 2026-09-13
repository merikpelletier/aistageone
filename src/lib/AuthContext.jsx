import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, supabase } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoadingAuth(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        return;
      }

      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_error', message: error?.message || 'Erreur d\'authentification' });
    } finally {
      setAuthChecked(true);
      if (showLoading) setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
    const { data } = supabase.auth.onAuthStateChange(() => {
      // Token refreshes and focus changes must not unmount the current page.
      // In particular, an admin editor keeps all of its local form state while
      // the refreshed session is verified in the background.
      window.setTimeout(() => checkUserAuth({ showLoading: false }), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    await base44.auth.logout(shouldRedirect ? window.location.href : undefined);
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
  };

  const navigateToLogin = () => base44.auth.redirectToLogin(window.location.href);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
