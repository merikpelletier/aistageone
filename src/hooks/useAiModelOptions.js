import { useEffect, useState } from 'react';
import { supabase } from '@/api/base44Client';

export function useAiModelOptions({ service, kind, input, enabled = true }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const signature = JSON.stringify(input || {});

  useEffect(() => {
    if (!enabled || !service || !kind) {
      setOptions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('ai-price-quote', {
          body: { action: 'options', service, kind, input: input || {} },
        });
        if (cancelled) return;
        if (error) throw error;
        setOptions(Array.isArray(data?.options) ? data.options : []);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [service, kind, enabled, signature]);

  return { options, loading };
}
