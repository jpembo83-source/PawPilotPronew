// My Account store — the signed-in user's OWN profile, avatar, and
// preferences. Talks to /account (see supabase/functions/server/
// account_routes.ts) which is self-scoped: every call operates on the
// authenticated user only, so nothing in this store can touch anyone else.
//
// Prefs are cached in localStorage (persist) so the theme and default
// location apply instantly on reload; the server copy loaded on login is
// the source of truth and overwrites the cache.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId } from '../../../utils/supabase/info';
import { getAuthHeaders } from '../../utils/supabase/authHeaders';
import { supabase } from '../../utils/supabase/client';
import { parseErrorResponse } from '../utils/api';
import { DEFAULT_ACCOUNT_PREFS, type AccountPrefs } from '../lib/account';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/account`;

export interface AccountProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

interface AccountState {
  profile: AccountProfile | null;
  avatarUrl: string | null;
  prefs: AccountPrefs;
  /** True once /account/me has loaded for the current user. */
  hasLoaded: boolean;
  isSaving: boolean;
  /** My Account dialog visibility — opened from the sidebar profile block. */
  isAccountOpen: boolean;

  openAccount: () => void;
  closeAccount: () => void;

  fetchAccount: () => Promise<void>;
  updateProfile: (update: { name?: string; phone?: string }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
  savePrefs: (patch: Partial<AccountPrefs>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Revokes every session except this one (supabase scope: 'others'). */
  signOutOtherSessions: () => Promise<void>;
  reset: () => void;
}

async function throwOnError(res: Response): Promise<void> {
  if (!res.ok) throw new Error(await parseErrorResponse(res));
}

// Response shapes from account_routes.ts.
interface MeResponse {
  profile: AccountProfile;
  avatarUrl: string | null;
  prefs: AccountPrefs;
}
interface ProfileResponse {
  ok: boolean;
  name: string;
  phone: string;
}
interface AvatarResponse {
  ok: boolean;
  avatarUrl: string | null;
}
interface PrefsResponse {
  ok: boolean;
  prefs: AccountPrefs;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      profile: null,
      avatarUrl: null,
      prefs: DEFAULT_ACCOUNT_PREFS,
      hasLoaded: false,
      isSaving: false,
      isAccountOpen: false,

      openAccount: () => set({ isAccountOpen: true }),
      closeAccount: () => set({ isAccountOpen: false }),

      fetchAccount: async () => {
        const headers = await getAuthHeaders();
        const res = await fetch(`${BASE_URL}/me`, { headers });
        await throwOnError(res);
        const data = (await res.json()) as MeResponse;
        set({
          profile: data.profile,
          avatarUrl: data.avatarUrl ?? null,
          prefs: data.prefs ?? DEFAULT_ACCOUNT_PREFS,
          hasLoaded: true,
        });
      },

      updateProfile: async (update) => {
        set({ isSaving: true });
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${BASE_URL}/profile`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(update),
          });
          await throwOnError(res);
          const data = (await res.json()) as ProfileResponse;
          const profile = get().profile;
          set({
            profile: profile ? { ...profile, name: data.name, phone: data.phone } : profile,
          });
          // AuthContext reads the display name from the session's
          // user_metadata — refresh it so the sidebar (and anywhere else the
          // name shows) updates immediately via onAuthStateChange.
          await supabase.auth.refreshSession();
        } finally {
          set({ isSaving: false });
        }
      },

      uploadAvatar: async (file) => {
        set({ isSaving: true });
        try {
          const headers = await getAuthHeaders();
          // multipart: the browser sets the boundary — don't send JSON content-type
          delete headers['Content-Type'];
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch(`${BASE_URL}/avatar`, {
            method: 'POST',
            headers,
            body: formData,
          });
          await throwOnError(res);
          const data = (await res.json()) as AvatarResponse;
          set({ avatarUrl: data.avatarUrl ?? null });
        } finally {
          set({ isSaving: false });
        }
      },

      removeAvatar: async () => {
        set({ isSaving: true });
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${BASE_URL}/avatar`, { method: 'DELETE', headers });
          await throwOnError(res);
          set({ avatarUrl: null });
        } finally {
          set({ isSaving: false });
        }
      },

      savePrefs: async (patch) => {
        // Optimistic: theme/default-location apply instantly; server response
        // (normalized) is authoritative and replaces the optimistic value.
        const before = get().prefs;
        set({ prefs: { ...before, ...patch }, isSaving: true });
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${BASE_URL}/prefs`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(patch),
          });
          await throwOnError(res);
          const data = (await res.json()) as PrefsResponse;
          set({ prefs: data.prefs ?? before });
        } catch (e) {
          set({ prefs: before });
          throw e;
        } finally {
          set({ isSaving: false });
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        set({ isSaving: true });
        try {
          const headers = await getAuthHeaders();
          const res = await fetch(`${BASE_URL}/password`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ currentPassword, newPassword }),
          });
          await throwOnError(res);
        } finally {
          set({ isSaving: false });
        }
      },

      signOutOtherSessions: async () => {
        const { error } = await supabase.auth.signOut({ scope: 'others' });
        if (error) throw new Error('Could not sign out other sessions. Please try again.');
      },

      reset: () =>
        set({
          profile: null,
          avatarUrl: null,
          prefs: DEFAULT_ACCOUNT_PREFS,
          hasLoaded: false,
          isAccountOpen: false,
        }),
    }),
    {
      name: 'account-storage',
      // Only the prefs cache persists (instant theme on reload). Profile and
      // avatar URLs are session-scoped — signed URLs expire, so they must be
      // re-fetched, never rehydrated.
      partialize: (state) => ({ prefs: state.prefs }),
    }
  )
);
