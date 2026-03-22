import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/pricing`;

// ===========================
// TYPES
// ===========================

export type ServiceType = 
  // Daycare
  | 'daycare-full' | 'daycare-half' | 'daycare-trial' | 'daycare-extra-hours' | 'daycare-adhoc'
  // Grooming
  | 'grooming-bath' | 'grooming-cut' | 'grooming-trim' | 'grooming-addon' | 'grooming-penalty'
  // Boutique
  | 'boutique-product' | 'boutique-bundle' | 'boutique-discount'
  // Transportation
  | 'transport-pickup' | 'transport-dropoff' | 'transport-roundtrip' | 'transport-penalty';

export type PriceBookStatus = 'draft' | 'active' | 'archived';
export type PriceBookScope = 'organisation' | 'location';

export interface Service {
  id: string;
  moduleId: string; // 'daycare' | 'grooming' | 'boutique' | 'transport'
  name: string;
  description: string;
  customerFacingDescription?: string;
  serviceType: ServiceType;
  
  // Operational attributes
  durationMinutes?: number;
  capacityImpact?: number;
  requiredStaffRole?: string;
  
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface PriceBook {
  id: string;
  name: string;
  currency: string;
  effectiveDate: string;
  
  // Scope
  scope: PriceBookScope;
  locationIds?: string[]; // If scope is 'location'
  
  status: PriceBookStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface PriceBookEntry {
  id: string;
  priceBookId: string;
  serviceId: string;
  
  basePrice: number;
  taxRate: number; // Percentage (e.g., 20 for 20%)
  unit?: string; // 'per day', 'per hour', 'per item'
  
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface LocationPriceOverride {
  id: string;
  locationId: string;
  serviceId: string;
  
  overridePrice: number;
  taxRate: number;
  reason?: string;
  
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface Membership {
  id: string;
  name: string;
  description: string;
  
  monthlyPrice: number;
  includedCredits: {
    serviceId: string;
    quantity: number;
  }[];
  overagePricing: {
    serviceId: string;
    price: number;
  }[];
  
  pauseRules?: string;
  prorationRules?: string;
  
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  
  price: number;
  includedServices: {
    serviceId: string;
    quantity: number;
  }[];
  
  expiryDays?: number;
  isRefundable: boolean;
  
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
}

// ===========================
// STORE
// ===========================

interface PricingState {
  // Data
  services: Service[];
  priceBooks: PriceBook[];
  priceBookEntries: Record<string, PriceBookEntry[]>; // bookId -> entries
  locationOverrides: Record<string, LocationPriceOverride[]>; // locationId -> overrides
  memberships: Membership[];
  packages: Package[];
  auditLog: AuditEntry[];
  
  // Loading states
  isLoading: boolean;
  
  // Services
  fetchServices: () => Promise<void>;
  fetchServicesByModule: (moduleId: string) => Promise<void>;
  createService: (service: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Service>;
  updateService: (id: string, service: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  
  // Price Books
  fetchPriceBooks: () => Promise<void>;
  createPriceBook: (book: Omit<PriceBook, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PriceBook>;
  updatePriceBook: (id: string, book: Partial<PriceBook>) => Promise<void>;
  deletePriceBook: (id: string) => Promise<void>;
  
  // Price Book Entries
  fetchPriceBookEntries: (bookId: string) => Promise<void>;
  createPriceBookEntry: (bookId: string, entry: Omit<PriceBookEntry, 'id' | 'priceBookId' | 'createdAt' | 'updatedAt'>) => Promise<PriceBookEntry>;
  updatePriceBookEntry: (bookId: string, id: string, entry: Partial<PriceBookEntry>) => Promise<void>;
  deletePriceBookEntry: (bookId: string, id: string) => Promise<void>;
  
  // Location Price Overrides
  fetchLocationOverrides: (locationId: string) => Promise<void>;
  createLocationOverride: (locationId: string, override: Omit<LocationPriceOverride, 'id' | 'locationId' | 'createdAt' | 'updatedAt'>) => Promise<LocationPriceOverride>;
  updateLocationOverride: (locationId: string, id: string, override: Partial<LocationPriceOverride>) => Promise<void>;
  deleteLocationOverride: (locationId: string, id: string) => Promise<void>;
  
  // Memberships
  fetchMemberships: () => Promise<void>;
  createMembership: (membership: Omit<Membership, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Membership>;
  updateMembership: (id: string, membership: Partial<Membership>) => Promise<void>;
  deleteMembership: (id: string) => Promise<void>;
  
  // Packages
  fetchPackages: () => Promise<void>;
  createPackage: (pkg: Omit<Package, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Package>;
  updatePackage: (id: string, pkg: Partial<Package>) => Promise<void>;
  deletePackage: (id: string) => Promise<void>;
  
  // Audit
  fetchAuditLog: () => Promise<void>;
  
  // Utility
  getServicePrice: (serviceId: string, locationId?: string) => number | null;
  getActivePriceBook: (locationId?: string) => PriceBook | null;
}

// Helper function for API calls
const fetchApi = async (path: string, options: RequestInit = {}) => {
  // Validate configuration
  if (!projectId || !publicAnonKey) {
    throw new Error('Supabase configuration not available');
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      }
    });
    
    if (!res.ok) {
      let errorMessage = `API Error: ${res.statusText || res.status}`;
      try {
        const text = await res.text();
        if (text) {
          errorMessage += ` - ${text}`;
        }
      } catch {
        // Ignore text parsing errors
      }
      throw new Error(errorMessage);
    }
    
    return res.json();
  } catch (error: any) {
    // Re-throw with more context if it's a network error
    if (error.message && error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to reach pricing API at ${path}`);
    }
    throw error;
  }
};

export const usePricingStore = create<PricingState>()(() => ({
  // Initial state
  services: [],
  priceBooks: [],
  priceBookEntries: {},
  locationOverrides: {},
  memberships: [],
  packages: [],
  auditLog: [],
  isLoading: false,
  
  // ===========================
  // SERVICES
  // ===========================
  
  fetchServices: async () => {
    try {
      const services = await fetchApi('/services');
      usePricingStore.setState({ services });
    } catch (e) {
      console.error('Failed to fetch services:', e);
      throw e;
    }
  },
  
  fetchServicesByModule: async (moduleId: string) => {
    try {
      const services = await fetchApi(`/services/module/${moduleId}`);
      usePricingStore.setState({ services });
    } catch (e) {
      console.error('Failed to fetch services by module:', e);
      throw e;
    }
  },
  
  createService: async (service) => {
    try {
      const created = await fetchApi('/services', {
        method: 'POST',
        body: JSON.stringify(service)
      });
      usePricingStore.setState((state) => ({
        services: [...state.services, created]
      }));
      return created;
    } catch (e) {
      console.error('Failed to create service:', e);
      throw e;
    }
  },
  
  updateService: async (id, service) => {
    try {
      const updated = await fetchApi(`/services/${id}`, {
        method: 'PUT',
        body: JSON.stringify(service)
      });
      usePricingStore.setState((state) => ({
        services: state.services.map(s => s.id === id ? updated : s)
      }));
    } catch (e) {
      console.error('Failed to update service:', e);
      throw e;
    }
  },
  
  deleteService: async (id) => {
    try {
      await fetchApi(`/services/${id}`, { method: 'DELETE' });
      usePricingStore.setState((state) => ({
        services: state.services.filter(s => s.id !== id)
      }));
    } catch (e) {
      console.error('Failed to delete service:', e);
      throw e;
    }
  },
  
  // ===========================
  // PRICE BOOKS
  // ===========================
  
  fetchPriceBooks: async () => {
    try {
      const priceBooks = await fetchApi('/price-books');
      usePricingStore.setState({ priceBooks });
    } catch (e) {
      console.error('Failed to fetch price books:', e);
      throw e;
    }
  },
  
  createPriceBook: async (book) => {
    try {
      const created = await fetchApi('/price-books', {
        method: 'POST',
        body: JSON.stringify(book)
      });
      usePricingStore.setState((state) => ({
        priceBooks: [...state.priceBooks, created]
      }));
      return created;
    } catch (e) {
      console.error('Failed to create price book:', e);
      throw e;
    }
  },
  
  updatePriceBook: async (id, book) => {
    try {
      const updated = await fetchApi(`/price-books/${id}`, {
        method: 'PUT',
        body: JSON.stringify(book)
      });
      usePricingStore.setState((state) => ({
        priceBooks: state.priceBooks.map(b => b.id === id ? updated : b)
      }));
    } catch (e) {
      console.error('Failed to update price book:', e);
      throw e;
    }
  },
  
  deletePriceBook: async (id) => {
    try {
      await fetchApi(`/price-books/${id}`, { method: 'DELETE' });
      usePricingStore.setState((state) => ({
        priceBooks: state.priceBooks.filter(b => b.id !== id),
        priceBookEntries: Object.fromEntries(
          Object.entries(state.priceBookEntries).filter(([key]) => key !== id)
        )
      }));
    } catch (e) {
      console.error('Failed to delete price book:', e);
      throw e;
    }
  },
  
  // ===========================
  // PRICE BOOK ENTRIES
  // ===========================
  
  fetchPriceBookEntries: async (bookId) => {
    try {
      const entries = await fetchApi(`/price-books/${bookId}/entries`);
      usePricingStore.setState((state) => ({
        priceBookEntries: {
          ...state.priceBookEntries,
          [bookId]: entries
        }
      }));
    } catch (e) {
      console.error('Failed to fetch price book entries:', e);
      throw e;
    }
  },
  
  createPriceBookEntry: async (bookId, entry) => {
    try {
      const created = await fetchApi(`/price-books/${bookId}/entries`, {
        method: 'POST',
        body: JSON.stringify(entry)
      });
      usePricingStore.setState((state) => ({
        priceBookEntries: {
          ...state.priceBookEntries,
          [bookId]: [...(state.priceBookEntries[bookId] || []), created]
        }
      }));
      return created;
    } catch (e) {
      console.error('Failed to create price book entry:', e);
      throw e;
    }
  },
  
  updatePriceBookEntry: async (bookId, id, entry) => {
    try {
      const updated = await fetchApi(`/price-books/${bookId}/entries/${id}`, {
        method: 'PUT',
        body: JSON.stringify(entry)
      });
      usePricingStore.setState((state) => ({
        priceBookEntries: {
          ...state.priceBookEntries,
          [bookId]: (state.priceBookEntries[bookId] || []).map(e => e.id === id ? updated : e)
        }
      }));
    } catch (e) {
      console.error('Failed to update price book entry:', e);
      throw e;
    }
  },
  
  deletePriceBookEntry: async (bookId, id) => {
    try {
      await fetchApi(`/price-books/${bookId}/entries/${id}`, { method: 'DELETE' });
      usePricingStore.setState((state) => ({
        priceBookEntries: {
          ...state.priceBookEntries,
          [bookId]: (state.priceBookEntries[bookId] || []).filter(e => e.id !== id)
        }
      }));
    } catch (e) {
      console.error('Failed to delete price book entry:', e);
      throw e;
    }
  },
  
  // ===========================
  // LOCATION OVERRIDES
  // ===========================
  
  fetchLocationOverrides: async (locationId) => {
    try {
      const overrides = await fetchApi(`/locations/${locationId}/price-overrides`);
      usePricingStore.setState((state) => ({
        locationOverrides: {
          ...state.locationOverrides,
          [locationId]: overrides
        }
      }));
    } catch (e) {
      console.error('Failed to fetch location overrides:', e);
      throw e;
    }
  },
  
  createLocationOverride: async (locationId, override) => {
    try {
      const created = await fetchApi(`/locations/${locationId}/price-overrides`, {
        method: 'POST',
        body: JSON.stringify(override)
      });
      usePricingStore.setState((state) => ({
        locationOverrides: {
          ...state.locationOverrides,
          [locationId]: [...(state.locationOverrides[locationId] || []), created]
        }
      }));
      return created;
    } catch (e) {
      console.error('Failed to create location override:', e);
      throw e;
    }
  },
  
  updateLocationOverride: async (locationId, id, override) => {
    try {
      const updated = await fetchApi(`/locations/${locationId}/price-overrides/${id}`, {
        method: 'PUT',
        body: JSON.stringify(override)
      });
      usePricingStore.setState((state) => ({
        locationOverrides: {
          ...state.locationOverrides,
          [locationId]: (state.locationOverrides[locationId] || []).map(o => o.id === id ? updated : o)
        }
      }));
    } catch (e) {
      console.error('Failed to update location override:', e);
      throw e;
    }
  },
  
  deleteLocationOverride: async (locationId, id) => {
    try {
      await fetchApi(`/locations/${locationId}/price-overrides/${id}`, { method: 'DELETE' });
      usePricingStore.setState((state) => ({
        locationOverrides: {
          ...state.locationOverrides,
          [locationId]: (state.locationOverrides[locationId] || []).filter(o => o.id !== id)
        }
      }));
    } catch (e) {
      console.error('Failed to delete location override:', e);
      throw e;
    }
  },
  
  // ===========================
  // MEMBERSHIPS
  // ===========================
  
  fetchMemberships: async () => {
    try {
      const memberships = await fetchApi('/memberships');
      usePricingStore.setState({ memberships });
    } catch (e) {
      console.error('Failed to fetch memberships:', e);
      throw e;
    }
  },
  
  createMembership: async (membership) => {
    try {
      const created = await fetchApi('/memberships', {
        method: 'POST',
        body: JSON.stringify(membership)
      });
      usePricingStore.setState((state) => ({
        memberships: [...state.memberships, created]
      }));
      return created;
    } catch (e) {
      console.error('Failed to create membership:', e);
      throw e;
    }
  },
  
  updateMembership: async (id, membership) => {
    try {
      const updated = await fetchApi(`/memberships/${id}`, {
        method: 'PUT',
        body: JSON.stringify(membership)
      });
      usePricingStore.setState((state) => ({
        memberships: state.memberships.map(m => m.id === id ? updated : m)
      }));
    } catch (e) {
      console.error('Failed to update membership:', e);
      throw e;
    }
  },
  
  deleteMembership: async (id) => {
    try {
      await fetchApi(`/memberships/${id}`, { method: 'DELETE' });
      usePricingStore.setState((state) => ({
        memberships: state.memberships.filter(m => m.id !== id)
      }));
    } catch (e) {
      console.error('Failed to delete membership:', e);
      throw e;
    }
  },
  
  // ===========================
  // PACKAGES
  // ===========================
  
  fetchPackages: async () => {
    try {
      const packages = await fetchApi('/packages');
      usePricingStore.setState({ packages });
    } catch (e) {
      console.error('Failed to fetch packages:', e);
      throw e;
    }
  },
  
  createPackage: async (pkg) => {
    try {
      const created = await fetchApi('/packages', {
        method: 'POST',
        body: JSON.stringify(pkg)
      });
      usePricingStore.setState((state) => ({
        packages: [...state.packages, created]
      }));
      return created;
    } catch (e) {
      console.error('Failed to create package:', e);
      throw e;
    }
  },
  
  updatePackage: async (id, pkg) => {
    try {
      const updated = await fetchApi(`/packages/${id}`, {
        method: 'PUT',
        body: JSON.stringify(pkg)
      });
      usePricingStore.setState((state) => ({
        packages: state.packages.map(p => p.id === id ? updated : p)
      }));
    } catch (e) {
      console.error('Failed to update package:', e);
      throw e;
    }
  },
  
  deletePackage: async (id) => {
    try {
      await fetchApi(`/packages/${id}`, { method: 'DELETE' });
      usePricingStore.setState((state) => ({
        packages: state.packages.filter(p => p.id !== id)
      }));
    } catch (e) {
      console.error('Failed to delete package:', e);
      throw e;
    }
  },
  
  // ===========================
  // AUDIT
  // ===========================
  
  fetchAuditLog: async () => {
    try {
      const auditLog = await fetchApi('/audit');
      usePricingStore.setState({ auditLog });
    } catch (e) {
      console.error('Failed to fetch audit log:', e);
      throw e;
    }
  },
  
  // ===========================
  // UTILITY
  // ===========================
  
  getServicePrice: (serviceId, locationId) => {
    const state = usePricingStore.getState();
    
    // Check for location override first
    if (locationId && state.locationOverrides[locationId]) {
      const override = state.locationOverrides[locationId].find(o => o.serviceId === serviceId);
      if (override) return override.overridePrice;
    }
    
    // Find active price book entry
    const activeBook = state.priceBooks.find(b => 
      b.status === 'active' && 
      (b.scope === 'organisation' || (b.locationIds && b.locationIds.includes(locationId || '')))
    );
    
    if (!activeBook) return null;
    
    const entries = state.priceBookEntries[activeBook.id];
    if (!entries) return null;
    
    const entry = entries.find(e => e.serviceId === serviceId);
    return entry ? entry.basePrice : null;
  },
  
  getActivePriceBook: (locationId) => {
    const state = usePricingStore.getState();
    
    // Prefer location-specific price book
    if (locationId) {
      const locationBook = state.priceBooks.find(b => 
        b.status === 'active' && 
        b.scope === 'location' &&
        b.locationIds?.includes(locationId)
      );
      if (locationBook) return locationBook;
    }
    
    // Fallback to organisation-wide
    return state.priceBooks.find(b => 
      b.status === 'active' && 
      b.scope === 'organisation'
    ) || null;
  },
}));