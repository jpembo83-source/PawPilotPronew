import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DateRange =
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | '7d'
  | '30d'
  | 'next7d'
  | 'next30d'
  | 'custom';

// Global dashboard/app filters. The widget-era slices (rolePermissions,
// userLayouts, userHiddenWidgets and their actions) were deleted along with
// the DashboardSettings page and dashboard/constants.ts — the widget
// dashboard they configured no longer exists.
interface DashboardState {
  // Global Filters
  selectedLocationId: string; // 'ALL' or specific ID
  dateRange: DateRange;

  // Sidebar state
  sidebarCollapsed: boolean;

  // Refresh trigger for dashboard data
  refreshTrigger: number;

  // Actions
  setLocation: (id: string) => void;
  setDateRange: (range: DateRange) => void;
  toggleSidebar: () => void;
  refreshAllWidgets: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      selectedLocationId: 'ALL',
      dateRange: 'today',
      sidebarCollapsed: false,
      refreshTrigger: 0,

      setLocation: (id) => set({ selectedLocationId: id }),
      setDateRange: (range) => set({ dateRange: range }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      refreshAllWidgets: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
    }),
    {
      name: 'dashboard-storage',
      // Only display preferences persist; stale widget-era keys in existing
      // localStorage entries are simply ignored on merge.
      partialize: (state) => ({
        selectedLocationId: state.selectedLocationId,
        dateRange: state.dateRange,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
