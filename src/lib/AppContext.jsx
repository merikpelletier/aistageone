import React, { createContext, useContext, useState, useCallback } from 'react';

const AppCtx = createContext({ appContext: {}, setAppContext: () => {} });

export function AppContextProvider({ children }) {
  const [appContext, setAppContextRaw] = useState({});

  // Merges new fields into existing context (no need to spread in callers)
  const setAppContext = useCallback((data) => {
    if (typeof data === 'function') {
      setAppContextRaw(data);
    } else {
      setAppContextRaw(prev => ({ ...prev, ...data }));
    }
  }, []);

  return (
    <AppCtx.Provider value={{ appContext, setAppContext }}>
      {children}
    </AppCtx.Provider>
  );
}

export const useAppContext = () => useContext(AppCtx);