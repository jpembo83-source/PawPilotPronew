import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';

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

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  targetName: string;
  details: string;
}

interface UserState {
  users: User[];
  templates: PermissionTemplate[];
  auditLog: AuditLogEntry[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchUsers: () => Promise<void>;
  addUser: (user: Omit<User, 'id'>, actorName: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>, actorName: string) => Promise<void>;
  toggleUserStatus: (id: string, actorName: string) => Promise<void>;
  sendPasswordReset: (email: string, actorName: string) => Promise<void>;
  
  addTemplate: (template: Omit<PermissionTemplate, 'id'>, actorName: string) => void;
  updateTemplate: (id: string, updates: Partial<PermissionTemplate>, actorName: string) => void;
  deleteTemplate: (id: string, actorName: string) => void;
  
  // Helper
  getUsersByLocation: (locationId: string) => User[];
  
  // Admin functions
  resetTemplates: () => void;
}

// Initial Data
// All templates include dashboard view so users have a landing page
const INITIAL_TEMPLATES: PermissionTemplate[] = [
  {
    id: 'tpl-handler',
    name: 'Daycare Handler',
    description: 'Standard access for daycare staff. Can check-in dogs and view bookings.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'daycare', action: 'view' },
      { module: 'daycare', action: 'update' }, // Check-in
      { module: 'customers', action: 'view' },
      { module: 'incidents', action: 'view' },
      { module: 'incidents', action: 'create' }, // Can report incidents
    ],
    isSystem: true
  },
  {
    id: 'tpl-groomer',
    name: 'Groomer',
    description: 'Access to grooming appointments and schedule.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'grooming', action: 'view' },
      { module: 'grooming', action: 'update' },
      { module: 'customers', action: 'view' },
      { module: 'incidents', action: 'view' },
      { module: 'incidents', action: 'create' },
    ],
    isSystem: true
  },
  {
    id: 'tpl-driver',
    name: 'Driver',
    description: 'Access to Transportation module only.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'transport', action: 'view' },
      { module: 'transport', action: 'update' }, // Complete stops
      { module: 'customers', action: 'view' }, // Need to see pickup addresses
      { module: 'incidents', action: 'view' },
      { module: 'incidents', action: 'create' }, // Can report incidents
    ],
    isSystem: true
  },
  {
    id: 'tpl-frontdesk',
    name: 'Front Desk',
    description: 'Full operational access excluding finance settings.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'daycare', action: 'view' },
      { module: 'daycare', action: 'create' },
      { module: 'daycare', action: 'update' },
      { module: 'grooming', action: 'view' },
      { module: 'grooming', action: 'create' },
      { module: 'grooming', action: 'update' },
      { module: 'customers', action: 'view' },
      { module: 'customers', action: 'create' },
      { module: 'customers', action: 'update' },
      { module: 'messages', action: 'view' },
      { module: 'messages', action: 'create' },
      { module: 'incidents', action: 'view' },
      { module: 'incidents', action: 'create' },
      { module: 'incidents', action: 'update' },
    ],
    isSystem: true
  },
  {
    id: 'tpl-finance',
    name: 'Finance Viewer',
    description: 'Read-only access to billing and financial records.',
    permissions: [
      { module: 'dashboard', action: 'view' },
      { module: 'billing', action: 'view' },
      { module: 'billing', action: 'export' },
      { module: 'invoices', action: 'view' },
      { module: 'payments', action: 'view' },
    ],
    isSystem: true
  }
];

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      users: [],
      templates: INITIAL_TEMPLATES,
      auditLog: [],
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

      addUser: async (user, actorName) => {
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
             locationIds: metadata.locationIds || user.locationIds,
             permissions: metadata.permissions || user.permissions,
             isActive: true,
             templateId: metadata.templateId || user.templateId // Get from metadata or fallback to input
           };

           set((state) => ({
             users: [...state.users, mappedUser],
             auditLog: [{
               id: Math.random().toString(36).substr(2, 9),
               timestamp: new Date().toISOString(),
               actorName,
               action: 'CREATE_USER',
               targetName: mappedUser.name,
               details: `Role: ${mappedUser.role}`
             }, ...state.auditLog],
             isLoading: false
           }));
        } catch (e: any) {
           set({ error: e.message, isLoading: false });
           throw e;
        }
      },

      updateUser: async (id, updates, actorName) => {
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

           set((state) => {
             const user = state.users.find(u => u.id === id);
             if (!user) return { isLoading: false };
             
             return {
               users: state.users.map(u => u.id === id ? { ...u, ...updates } : u),
               auditLog: [{
                 id: Math.random().toString(36).substr(2, 9),
                 timestamp: new Date().toISOString(),
                 actorName,
                 action: 'UPDATE_USER',
                 targetName: user.name,
                 details: 'User details updated'
               }, ...state.auditLog],
               isLoading: false
             };
           });
        } catch (e: any) {
           set({ error: e.message, isLoading: false });
           throw e;
        }
      },

      toggleUserStatus: async (id, actorName) => {
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
             auditLog: [{
               id: Math.random().toString(36).substr(2, 9),
               timestamp: new Date().toISOString(),
               actorName,
               action: newStatus ? 'ENABLE_USER' : 'DISABLE_USER',
               targetName: user.name,
               details: 'Status toggled'
             }, ...state.auditLog],
             isLoading: false
           }));
        } catch (e: any) {
           set({ error: e.message, isLoading: false });
           throw e;
        }
      },

      sendPasswordReset: async (email, actorName) => {
        // Sends a real Supabase password-recovery email. The link returns the
        // user to /reset-password where they set a new password.
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) {
          throw new Error(error.message || 'Failed to send password reset email');
        }
        set((state) => ({
          auditLog: [{
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            actorName,
            action: 'SEND_PASSWORD_RESET',
            targetName: email,
            details: 'Password reset email sent',
          }, ...state.auditLog],
        }));
      },

      addTemplate: (template, actorName) => set((state) => ({
        templates: [...state.templates, { ...template, id: Math.random().toString(36).substr(2, 9) }],
        auditLog: [{
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          actorName,
          action: 'CREATE_TEMPLATE',
          targetName: template.name,
          details: 'New permission template'
        }, ...state.auditLog]
      })),

      updateTemplate: (id, updates, actorName) => set((state) => ({
        templates: state.templates.map(t => t.id === id ? { ...t, ...updates } : t),
        auditLog: [{
          id: Math.random().toString(36).substr(2, 9),
          timestamp: new Date().toISOString(),
          actorName,
          action: 'UPDATE_TEMPLATE',
          targetName: state.templates.find(t => t.id === id)?.name || 'Unknown',
          details: 'Template updated'
        }, ...state.auditLog]
      })),

      deleteTemplate: (id, actorName) => set((state) => {
        const tpl = state.templates.find(t => t.id === id);
        if (!tpl) return {};
        return {
          templates: state.templates.filter(t => t.id !== id),
          auditLog: [{
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            actorName,
            action: 'DELETE_TEMPLATE',
            targetName: tpl.name,
            details: 'Template deleted'
          }, ...state.auditLog]
        };
      }),

      getUsersByLocation: (locationId) => {
        return get().users.filter(u => 
          u.locationIds.includes('all') || u.locationIds.includes(locationId)
        );
      },
      
      // Force refresh templates from initial data (admin function)
      resetTemplates: () => set({ templates: INITIAL_TEMPLATES }),
    }),
    {
      name: 'user-access-storage',
      version: 4, // Bump this to force migration
      migrate: (persistedState: any, version: number) => {
        // Always reset templates on version mismatch to ensure correct permissions
        if (version < 4) {
          console.log('[UserStore] Migrating to v4: ensuring all templates have correct permissions');
          return {
            ...persistedState,
            templates: INITIAL_TEMPLATES,
          };
        }
        return persistedState;
      },
    }
  )
);