// Supabase Project Configuration
// MDC Operations Centre - Dog Daycare Platform

export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Note: Service role key should only be used server-side (Edge Functions)
// It's configured via Supabase secrets, not exposed in frontend code
