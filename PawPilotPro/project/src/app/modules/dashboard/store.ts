import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WIDGETS, DEFAULT_WIDGETS_BY_ROLE } from './constants';

export type DateRange = 'today' | 'yesterday' | '7d' | '30d' | 'custom';

interface DashboardState {
  // Global Filters
  selectedLocationId: string; // 'ALL' or specific ID
  dateRange: DateRange;
  
  // Sidebar state
  sidebarCollapsed: boolean;
  
  // Refresh trigger for widgets
  refreshTrigger: number;
  
  // RBAC Configuration (Persisted)
  // Which widgets are allowed for each role (defined by upstream role)
  rolePermissions: Record<string, string[]>;

  // User Preferences (Persisted)
  // Per-user layout customization
  userLayouts: Record<string, string[]>; // Order of widget IDs
  userHiddenWidgets: Record<string, string[]>; // IDs of hidden widgets

  // Actions
  setLocation: (id: string) => void;
  setDateRange: (range: DateRange) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  refreshAllWidgets: () => void;
  updateRolePermissions: (role: string, widgetIds: string[]) => void;
  updateUserLayout: (userId: string, widgetIds: string[]) => void;
  toggleUserWidget: (userId: string, widgetId: string) => void;
  resetUserLayout: (userId: string, role: string) => void;
  // Helper to merge new widgets into existing layout
  mergeNewWidgets: (userId: string, role: string) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      selectedLocationId: 'ALL',
      dateRange: 'today',
      sidebarCollapsed: false,
      refreshTrigger: 0,
      
      // Initialize rolePermissions from the latest constants on load
      rolePermissions: {
        admin: DEFAULT_WIDGETS_BY_ROLE.admin,
        manager: DEFAULT_WIDGETS_BY_ROLE.manager,
        staff: DEFAULT_WIDGETS_BY_ROLE.staff,
      },

      userLayouts: {},
      userHiddenWidgets: {},

      setLocation: (id) => set({ selectedLocationId: id }),
      setDateRange: (range) => set({ dateRange: range }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      refreshAllWidgets: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })), 

      updateRolePermissions: (role, widgetIds) => 
        set((state) => ({
          rolePermissions: {
            ...state.rolePermissions,
            [role]: widgetIds
          }
        })),

      updateUserLayout: (userId, widgetIds) =>
        set((state) => ({
          userLayouts: {
            ...state.userLayouts,
            [userId]: widgetIds
          }
        })),

      toggleUserWidget: (userId, widgetId) =>
        set((state) => {
          const currentHidden = state.userHiddenWidgets[userId] || [];
          const isHidden = currentHidden.includes(widgetId);
          return {
            userHiddenWidgets: {
              ...state.userHiddenWidgets,
              [userId]: isHidden 
                ? currentHidden.filter(id => id !== widgetId)
                : [...currentHidden, widgetId]
            }
          };
        }),

      resetUserLayout: (userId, role) =>
        set((state) => {
          const defaultWidgets = state.rolePermissions[role] || DEFAULT_WIDGETS_BY_ROLE[role] || [];
          return {
            userLayouts: {
              ...state.userLayouts,
              [userId]: defaultWidgets
            },
            userHiddenWidgets: {
              ...state.userHiddenWidgets,
              [userId]: []
            }
          };
        }),

      // Helper to merge new widgets into existing layout
      mergeNewWidgets: (userId: string, role: string) => 
        set((state) => {
          const currentLayout = state.userLayouts[userId] || [];
          const allowedWidgets = state.rolePermissions[role] || DEFAULT_WIDGETS_BY_ROLE[role] || [];
          
          // Find new widgets that aren't in the current layout
          const newWidgets = allowedWidgets.filter(id => !currentLayout.includes(id));
          
          // Add new widgets at the beginning
          const mergedLayout = [...newWidgets, ...currentLayout];
          
          return {
            userLayouts: {
              ...state.userLayouts,
              [userId]: mergedLayout
            }
          };
        }),
    }),
    {
      name: 'dashboard-storage',
      // Force merge latest rolePermissions on hydration
      merge: (persistedState: any, currentState) => {
        return {
          ...currentState,
          ...persistedState,
          // Always override rolePermissions with latest from constants
          rolePermissions: {
            admin: DEFAULT_WIDGETS_BY_ROLE.admin,
            manager: DEFAULT_WIDGETS_BY_ROLE.manager,
            staff: DEFAULT_WIDGETS_BY_ROLE.staff,
          },
        };
      },
    }
  )
);