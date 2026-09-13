import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    'Supabase n’est pas configuré. Définir VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY.',
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://invalid.supabase.local',
  supabasePublishableKey || 'missing-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
