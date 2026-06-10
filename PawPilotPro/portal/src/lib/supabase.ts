import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!projectId || !anonKey) throw new Error("Missing VITE_SUPABASE_PROJECT_ID / VITE_SUPABASE_ANON_KEY");
  _client = createClient(`https://${projectId}.supabase.co`, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
  });
  return _client;
}
