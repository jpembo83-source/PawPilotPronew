// Supabase Project Configuration
// MDC Operations Centre - Dog Daycare Platform
//
// Read from build-time env (Vite) so each Netlify deploy context can target a
// different Supabase project:
//   production              -> prod  (ruahrxkfgfyshuxykiay)
//   deploy-preview / branch -> staging (ihdbnwlmqhsrslstbbqn)
// Falls back to the production values when the env vars are unset, so existing
// production behaviour is unchanged even if a build context has no env set.

const FALLBACK_PROJECT_ID = 'ruahrxkfgfyshuxykiay';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YWhyeGtmZ2Z5c2h1eHlraWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NDUxMTcsImV4cCI6MjA4MjQyMTExN30.gG65FbgAYdrjbLAgKJRscIGwbcHwyuEAGa5M_o_fYeU';

export const projectId =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) || FALLBACK_PROJECT_ID;
export const publicAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY;

// Note: Service role key should only be used server-side (Edge Functions)
// It's configured via Supabase secrets, not exposed in frontend code
