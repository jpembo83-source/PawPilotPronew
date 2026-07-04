import { createPortalApi, PortalApi } from "@shared/api/client";
import { getSupabase } from "./supabase";

let _api: PortalApi | null = null;

export function getPortalApi(): PortalApi {
  if (_api) return _api;
  // Whitespace-scrubbed for the same reason as getSupabase(): a wrapped
  // key in .env makes WKWebView reject every request with "Type error".
  const projectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "").toString().replace(/\s+/g, "");
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").toString().replace(/\s+/g, "");
  _api = createPortalApi({
    projectId,
    anonKey,
    getAccessToken: async () => {
      const { data } = await getSupabase().auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
  return _api;
}
