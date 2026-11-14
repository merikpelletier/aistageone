import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPlatformLanguage, fetchTranslationDictionary, translationLookup, translatedLabel } from '@/lib/translationDictionary';

export function useStudioTranslation() {
  const location = useLocation();
  const [language, setLanguage] = useState(() => getPlatformLanguage());
  const { data: rows = [] } = useQuery({
    queryKey: ['translationDictionary'],
    queryFn: fetchTranslationDictionary,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const dictionary = useMemo(() => translationLookup(rows), [rows]);
  useEffect(() => {
    const sync = () => setLanguage(getPlatformLanguage());
    sync();
    window.addEventListener('aistage-language-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('aistage-language-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, [location.pathname, location.search]);
  const t = (key, fallback) => dictionary.has('ui:' + key)
    ? translatedLabel(dictionary, 'ui', key, language)
    : fallback;
  return t;
}
