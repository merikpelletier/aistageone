import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zbfjexzxkvufcqvtsafu.supabase.co';
const supabasePublishableKey = 'sb_publishable_5W5CB1vcnU6_9N0qxhTbUw_NDnakzhN';

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
