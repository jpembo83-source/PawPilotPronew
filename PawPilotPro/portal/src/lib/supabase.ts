import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  // Strip ALL whitespace: a line-wrapped key pasted into .env produces an
  // invalid HTTP header, and WKWebView rejects every request with a bare
  // "Type error" before it leaves the device. Neither value legitimately
  // contains whitespace, so scrubbing is always safe.
  const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "").toString().replace(/\s+/g, "");
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").toString().replace(/\s+/g, "");
  if (!projectId || !anonKey) throw new Error("Missing VITE_SUPABASE_PROJECT_ID / VITE_SUPABASE_ANON_KEY");
  _client = createClient(`https://${projectId}.supabase.co`, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
  });
  return _client;
}
