import { useEffect, useState } from 'react';
import { supabase } from '@/api/base44Client';

export function useAiPriceQuote({ service, kind, input, modelKey = null, enabled = true }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const signature = JSON.stringify(input || {});

  useEffect(() => {
    if (!enabled || !service || !kind) {
      setQuote(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-price-quote', {
          body: { service, kind, input: input || {}, model_key: modelKey || undefined },
        });
        if (cancelled) return;
        if (error) throw error;
        setQuote(data?.credits ? data : null);
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [service, kind, modelKey, enabled, signature]);

  return { quote, loading };
}
