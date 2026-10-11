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

      if (currentUser?.role !== 'admin') {
        const { data: moderationRows, error: moderationError } = await supabase.rpc('get_my_moderation_status');
        if (moderationError) throw moderationError;
        const moderation = moderationRows?.[0] || { status: 'active', reason: null };

        if (moderation.status === 'frozen' || moderation.status === 'expelled') {
          await supabase.auth.signOut();
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({
            type: 'account_restricted',
            status: moderation.status,
            message: moderation.status === 'frozen'
              ? 'Your account has been temporarily frozen by AI Stage One administration.'
              : 'Your account has been expelled from AI Stage One.',
            reason: moderation.reason || null,
          });
          return;
        }
      }

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
