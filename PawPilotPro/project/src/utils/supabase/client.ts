import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;
const supabaseKey = publicAnonKey;

if (!projectId || !publicAnonKey) {
  console.error('Supabase configuration missing: projectId or publicAnonKey is undefined');
}

export const supabase = createClient(
  supabaseUrl || 'https://not-configured.supabase.co',
  supabaseKey || 'not-configured',
  {
    auth: {
      persistSession: true,
      storage: window.localStorage,
      storageKey: 'mdc-operations-auth',
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
