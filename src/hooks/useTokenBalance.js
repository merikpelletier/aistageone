import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export function useTokenBalance(userEmail) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    return base44.functions.invoke('getUserBalance', {})
      .then((res) => { if (res?.data) setBalance(res.data.balance); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (userEmail) refresh();
  }, [userEmail, refresh]);

  return { balance, loading, refresh };
}