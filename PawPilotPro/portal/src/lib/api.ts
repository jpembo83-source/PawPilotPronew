import { createPortalApi, PortalApi } from "@shared/api/client";
import { getSupabase } from "./supabase";

let _api: PortalApi | null = null;

export function getPortalApi(): PortalApi {
  if (_api) return _api;
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID!;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
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
