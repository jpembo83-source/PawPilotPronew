import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import { supabase } from '../../../../utils/supabase/client';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

// Re-using/Extending types compatible with AuthContext
export type Role = 'admin' | 'manager' | 'staff';

export interface Permission {
  module: string; // 'daycare', 'grooming', 'transport', 'finance', 'settings'
  action: 'view' | 'create' | 'update' | 'delete' | 'export' | 'approve';
  flags?: string[]; // 'personal_data', 'financial_data', 'incident_data'
}

export interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem?: boolean; // Cannot be deleted
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  locationIds: string[]; // 'all' or specific IDs
  templateId?: string; // Link to PermissionTemplate
  permissions?: Permission[]; // Per-user overrides
  password?: string;
  isActive: boolean;
  lastLogin?: string;
  avatarUrl?: string;
}

interface UserState {
  users: User[];
  // Templates are SERVER-backed (settings:{tenant}:permission_template:*).
  // This state is only ever a cache of the server's list — never persisted
  // to localStorage, never mutated without a successful server call.
  templates: PermissionTemplate[];
  templatesLoaded: boolean;
  // The current user's own assigned template, fetchable by every role so
  // usePermissions can resolve enforcement even for staff (who cannot list
  // all templates).
  myTemplate: PermissionTemplate | null;
  myTemplateLoaded: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchUsers: () => Promise<void>;
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  toggleUserStatus: (id: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;

  fetchTemplates: () => Promise<void>;
  ensureMyTemplate: () => Promise<void>;
  addTemplate: (template: Omit<PermissionTemplate, 'id'>) => Promise<PermissionTemplate | null>;
  updateTemplate: (id: string, updates: Partial<PermissionTemplate>) => Promise<PermissionTemplate | null>;
  deleteTemplate: (id: string) => Promise<boolean>;

  // Helper
  getUsersByLocation: (locationId: string) => User[];
}

async function templateRequest(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method: init?.method ?? 'GET',
    headers: await getAuthHeaders(),
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      users: [],
      templates: [],
      templatesLoaded: false,
      myTemplate: null,
      myTemplateLoaded: false,
      isLoading: false,
      error: null,

      fetchUsers: async () => {
        set({ isLoading: true, error: null });
        try {
           const headers = await getAuthHeaders();

           const res = await fetch(`${API_URL}/users`, {
             headers
           });
           if (!res.ok) throw new Error('Failed to fetch users');
           const users = await res.json();
           set({ users, isLoading: false });
        } catch (e: any) {
           console.error("Fetch Users Error:", e);
           set({ error: e.message, isLoading: false });
        }
      },

      addUser: async (user) => {
        set({ isLoading: true, error: null });
        try {
           const headers = await getAuthHeaders();

           const res = await fetch(`${API_URL}/users`, {
             method: 'POST',
             headers,
             body: JSON.stringify(user)
           });

           if (!res.ok) {
             const err = await res.json();
             throw new Error(err.error || 'Failed to create user');
           }

           const newUser = await res.json();
           const metadata = newUser.user_metadata || {};
           // Role lives in app_metadata (server-set). user_metadata is
           // client-writable so reading role from there would let a user
           // self-promote.
           const appMetadata = newUser.app_metadata || {};

           const mappedUser: User = {
             id: newUser.id,
             name: metadata.name || user.name,
             email: newUser.email || user.email,
             role: appMetadata.role || user.role,
             locationIds: appMetadata.locationIds || user.locationIds,
             permissions: appMetadata.permissions || user.permissions,
             isActive: true,
             templateId: appMetadata.templateId || user.templateId
           };

           set((state) => ({
             users: [...state.users, mappedUser],
             isLoading: false
           }));
        } catch (e: any) {
           set({ error: e.message, isLoading: false });
           throw e;
        }
      },

      updateUser: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
           const headers = await getAuthHeaders();

           const res = await fetch(`${API_URL}/users/${id}`, {
             method: 'PUT',
             headers,
             body: JSON.stringify(updates)
           });

           if (!res.ok) {
             const err = await res.json();
             throw new Error(err.error || 'Failed to update user');
           }

           set((state) => ({
             users: state.users.map(u => u.id === id ? { ...u, ...updates } : u),
             isLoading: false
           }));
        } catch (e: any) {
           set({ error: e.message, isLoading: false });
           throw e;
        }
      },

      toggleUserStatus: async (id) => {
        set({ isLoading: true, error: null });
        const user = get().users.find(u => u.id === id);
        if (!user) {
          set({ isLoading: false });
          return;
        }
        const newStatus = !user.isActive;

        try {
           const headers = await getAuthHeaders();

           const res = await fetch(`${API_URL}/users/${id}`, {
             method: 'PUT',
             headers,
             body: JSON.stringify({ isActive: newStatus })
           });

           if (!res.ok) {
             const err = await res.json();
             throw new Error(err.error || 'Failed to update status');
           }

           set((state) => ({
             users: state.users.map(u => u.id === id ? { ...u, isActive: newStatus } : u),
             isLoading: false
           }));
        } catch (e: any) {
           set({ error: e.message, isLoading: false });
           throw e;
        }
      },

      sendPasswordReset: async (email) => {
        // Sends a real Supabase password-recovery email. The link returns the
        // user to /reset-password where they set a new password.
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
          throw new Error(error.message || 'Failed to send password reset email');
        }
      },

      // --- Permission templates: server-backed CRUD ---
      // Mutations are audit-logged server-side with the authenticated actor;
      // the client no longer fabricates its own audit entries.

      fetchTemplates: async () => {
        try {
          const res = await templateRequest('/settings/permission-templates');
          if (!res.ok) throw new Error('Failed to fetch permission templates');
          const templates = (await res.json()) as PermissionTemplate[];
          set({ templates, templatesLoaded: true });
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Failed to fetch templates' });
        }
      },

      ensureMyTemplate: async () => {
        if (get().myTemplateLoaded) return;
        try {
          const res = await templateRequest('/settings/my-permission-template');
          if (!res.ok) throw new Error('Failed to fetch assigned template');
          const myTemplate = (await res.json()) as PermissionTemplate | null;
          set({ myTemplate, myTemplateLoaded: true });
        } catch {
          // Fail closed: without the template the user falls back to the
          // (more restrictive) role defaults in usePermissions.
          set({ myTemplateLoaded: true });
        }
      },

      addTemplate: async (template) => {
        try {
          const res = await templateRequest('/settings/permission-templates', {
            method: 'POST',
            body: template,
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error || 'Failed to create template');
          }
          const created = (await res.json()) as PermissionTemplate;
          set((state) => ({ templates: [...state.templates, created] }));
          return created;
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Failed to create template' });
          return null;
        }
      },

      updateTemplate: async (id, updates) => {
        const existing = get().templates.find(t => t.id === id);
        if (!existing) return null;
        try {
          const res = await templateRequest(`/settings/permission-templates/${id}`, {
            method: 'PUT',
            // The server validates name/description/permissions and preserves
            // id/isSystem itself — send the merged editable fields.
            body: {
              name: updates.name ?? existing.name,
              description: updates.description ?? existing.description,
              permissions: updates.permissions ?? existing.permissions,
            },
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error || 'Failed to update template');
          }
          const updated = (await res.json()) as PermissionTemplate;
          set((state) => ({
            templates: state.templates.map(t => t.id === id ? updated : t),
            myTemplate: state.myTemplate?.id === id ? updated : state.myTemplate,
          }));
          return updated;
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Failed to update template' });
          return null;
        }
      },

      deleteTemplate: async (id) => {
        try {
          const res = await templateRequest(`/settings/permission-templates/${id}`, {
            method: 'DELETE',
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error || 'Failed to delete template');
          }
          set((state) => ({ templates: state.templates.filter(t => t.id !== id) }));
          return true;
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'Failed to delete template' });
          return false;
        }
      },

      getUsersByLocation: (locationId) => {
        return get().users.filter(u =>
          u.locationIds.includes('all') || u.locationIds.includes(locationId)
        );
      },
    }),
    {
      name: 'user-access-storage',
      version: 5, // v5: templates + audit log are server-backed, never persisted
      // Security data (permission templates) must never treat localStorage as
      // a source of truth — only the display-level users cache is persisted.
      partialize: (state) => ({ users: state.users }),
      migrate: (persistedState: unknown) => {
        const state = (persistedState ?? {}) as Partial<UserState>;
        return { users: state.users ?? [] };
      },
    }
  )
);
