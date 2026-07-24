// Packages Store - Zustand state management
import { create } from 'zustand';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { projectId } from '../../../../utils/supabase/info';
import type { Package, CustomerPackage, CustomPlanInput, PackageUsage, PackageStats } from './types';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

interface PackagesState {
  // Package templates
  packages: Package[];
  selectedPackage: Package | null;
  
  // Customer packages
  customerPackages: CustomerPackage[];
  
  // Usage history
  usageHistory: PackageUsage[];
  
  // Stats
  stats: PackageStats | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions - Package Templates
  fetchPackages: () => Promise<void>;
  fetchPackage: (id: string) => Promise<void>;
  createPackage: (pkg: Partial<Package>) => Promise<Package>;
  updatePackage: (id: string, pkg: Partial<Package>) => Promise<void>;
  deletePackage: (id: string) => Promise<void>;
  
  // Actions - Customer Packages
  fetchCustomerPackages: (customerId?: string) => Promise<void>;
  purchasePackage: (customerId: string, packageId: string) => Promise<CustomerPackage>;
  assignCustomPackage: (customerId: string, customPlan: CustomPlanInput) => Promise<CustomerPackage>;
  useCredits: (customerPackageId: string, petId: string, credits: number, bookingId?: string) => Promise<void>;
  cancelPackage: (customerPackageId: string) => Promise<void>;
  
  // Actions - Stats
  fetchStats: () => Promise<void>;
  
  // Utilities
  clearError: () => void;
  reset: () => void;
}

export const usePackagesStore = create<PackagesState>((set, get) => ({
  packages: [],
  selectedPackage: null,
  customerPackages: [],
  usageHistory: [],
  stats: null,
  isLoading: false,
  error: null,

  fetchPackages: async () => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/packages`, { headers });
      
      if (!response.ok) {
        // No mock data - show empty state until API is implemented
        set({ packages: [], isLoading: false });
        return;
      }
      
      const data = (await response.json()) as { packages?: Package[] };
      set({ packages: data.packages || [], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchPackage: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/packages/${id}`, { headers });
      
      if (!response.ok) throw new Error('Failed to fetch package');
      
      const data = (await response.json()) as Package;
      set({ selectedPackage: data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  createPackage: async (pkg) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/packages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(pkg),
      });
      
      if (!response.ok) throw new Error('Failed to create package');
      
      const data = (await response.json()) as Package;
      set(state => ({
        packages: [...state.packages, data],
        isLoading: false
      }));
      return data;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  updatePackage: async (id, pkg) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/packages/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(pkg),
      });
      
      if (!response.ok) throw new Error('Failed to update package');
      
      const data = (await response.json()) as Package;
      set(state => ({
        packages: state.packages.map(p => p.id === id ? data : p),
        selectedPackage: state.selectedPackage?.id === id ? data : state.selectedPackage,
        isLoading: false 
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  deletePackage: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/packages/${id}`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) throw new Error('Failed to delete package');
      
      set(state => ({ 
        packages: state.packages.filter(p => p.id !== id),
        isLoading: false 
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  fetchCustomerPackages: async (customerId) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const url = customerId 
        ? `${API_BASE}/customer-packages?customer_id=${customerId}`
        : `${API_BASE}/customer-packages`;
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        // No mock data - show empty state until API is implemented
        set({ customerPackages: [], isLoading: false });
        return;
      }
      
      const data = (await response.json()) as { packages?: CustomerPackage[] };
      set({ customerPackages: data.packages || [], isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  purchasePackage: async (customerId, packageId) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/customer-packages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ customer_id: customerId, package_id: packageId }),
      });
      
      if (!response.ok) throw new Error('Failed to purchase package');
      
      const data = (await response.json()) as CustomerPackage;
      set(state => ({
        customerPackages: [...state.customerPackages, data],
        isLoading: false
      }));
      return data;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  assignCustomPackage: async (customerId, customPlan) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/customer-packages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ customer_id: customerId, custom_plan: customPlan }),
      });

      if (!response.ok) throw new Error('Failed to assign custom membership');

      const data = (await response.json()) as CustomerPackage;
      set(state => ({
        customerPackages: [...state.customerPackages, data],
        isLoading: false
      }));
      return data;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  useCredits: async (customerPackageId, petId, credits, bookingId) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/customer-packages/${customerPackageId}/use`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pet_id: petId, credits, booking_id: bookingId }),
      });
      
      if (!response.ok) throw new Error('Failed to use credits');
      
      // Refresh customer packages
      await get().fetchCustomerPackages();
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  cancelPackage: async (customerPackageId) => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/customer-packages/${customerPackageId}/cancel`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) throw new Error('Failed to cancel package');
      
      set(state => ({ 
        customerPackages: state.customerPackages.map(p => 
          p.id === customerPackageId ? { ...p, status: 'cancelled' as const } : p
        ),
        isLoading: false 
      }));
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/packages/stats`, { headers });
      
      if (!response.ok) {
        // No mock data - show empty state until API is implemented
        set({ stats: null, isLoading: false });
        return;
      }
      
      const data = (await response.json()) as PackageStats;
      set({ stats: data, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({
    packages: [],
    selectedPackage: null,
    customerPackages: [],
    usageHistory: [],
    stats: null,
    isLoading: false,
    error: null,
  }),
}));
