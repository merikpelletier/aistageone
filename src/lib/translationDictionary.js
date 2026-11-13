import { supabase } from '@/api/base44Client';

export const normalizeLocale = value => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['fr','french','français','francais','fr-ca','fr-fr'].includes(normalized)) return 'fr';
  if (['en','english','en-ca','en-us','en-gb'].includes(normalized)) return 'en';
  return normalized.split('-')[0] || 'en';
};

export const getPlatformLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  const param = new URLSearchParams(window.location.search).get('lang');
  if (param === 'fr' || param === 'en') return param;
  try { return window.localStorage.getItem('aistage-landing-language') === 'fr' ? 'fr' : 'en'; }
  catch { return 'en'; }
};

export const fetchTranslationDictionary = async () => {
  const { data, error } = await supabase.from('translation_dictionary').select('namespace,source_key,translations,synonyms');
  if (error) throw error;
  return data || [];
};

export const translationLookup = rows => new Map((rows || []).map(row => [`${row.namespace}:${row.source_key}`, row]));

export function translatedLabel(dictionary, namespace, key, language = 'en') {
  if (!key) return key || '';
  if (key === 'All' && namespace === 'ui') return language === 'fr' ? 'Tout' : 'All';
  const entry = dictionary.get(`${namespace}:${key}`);
  return entry?.translations?.[language] || entry?.translations?.en || key;
}

export const normalizeSearchText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

export function searchTerms(dictionary, namespace, key, language) {
  const entry = dictionary.get(`${namespace}:${key}`);
  return [key, ...(entry ? Object.values(entry.translations || {}) : []), ...(entry ? Object.values(entry.synonyms || {}).flat() : [])]
    .filter(v => typeof v === 'string' && v.trim());
}

export const matchesContentLanguage = (dossier, locale) => {
  const current = dossier.default_language || dossier.original_language;
  if (!current) return locale === 'en';
  return normalizeLocale(current) === locale;
};
