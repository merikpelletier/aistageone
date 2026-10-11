import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, supabase } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [accountStatus, setAccountStatus] = useState('active');
  const [accountRestrictionReason, setAccountRestrictionReason] = useState(null);
  const [accountDeletionDueAt, setAccountDeletionDueAt] = useState(null);

  const resetAccountState = () => {
    setAccountStatus('active');
    setAccountRestrictionReason(null);
    setAccountDeletionDueAt(null);
  };

  const checkUserAuth = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setIsLoadingAuth(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (!sessionData.session) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
        resetAccountState();
        return;
      }

      const currentUser = await base44.auth.me();

      if (currentUser?.role !== 'admin') {
        const { data: accessRows, error: accessError } = await supabase.rpc('get_my_account_access');
        if (accessError) throw accessError;
        const access = accessRows?.[0] || { status: 'active', reason: null, deletion_due_at: null };

        if (access.status === 'frozen') {
          await supabase.auth.signOut();
          setUser(null);
          setIsAuthenticated(false);
          setAccountStatus('frozen');
          setAccountRestrictionReason(access.reason || null);
          setAccountDeletionDueAt(null);
          setAuthError({
            type: 'account_restricted',
            status: 'frozen',
            message: 'Your account has been temporarily frozen by AI Stage One administration.',
            reason: access.reason || null,
          });
          return;
        }

        setAccountStatus(access.status || 'active');
        setAccountRestrictionReason(access.reason || null);
        setAccountDeletionDueAt(access.deletion_due_at || null);
      } else {
        resetAccountState();
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
    resetAccountState();
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
      accountStatus,
      accountRestrictionReason,
      accountDeletionDueAt,
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
