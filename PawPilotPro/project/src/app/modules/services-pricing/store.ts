import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import {
  Service,
  PriceBook,
  MembershipPlan,
  LocationPriceOverride,
  MultiDogRule,
  ServicePackage,
  FeeRule,
  DiscountRule,
  PriceResolutionRequest,
  PriceResolutionResponse,
} from './types';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

export interface ServicesPricingState {
  // Layer 1: Services
  services: Service[];
  
  // Layer 2: Price Books
  priceBooks: PriceBook[];
  activePriceBook: PriceBook | null;
  
  // Layer 3: Location Overrides
  locationOverrides: LocationPriceOverride[];
  
  // Layer 4: Commercial Modifiers
  membershipPlans: MembershipPlan[];
  multiDogRules: MultiDogRule[];
  packages: ServicePackage[];
  feeRules: FeeRule[];
  discountRules: DiscountRule[];
  
  // Loading states
  isLoading: boolean;
  
  // ========================================================================
  // FETCH OPERATIONS
  // ========================================================================
  
  fetchServices: () => Promise<void>;
  fetchPriceBooks: () => Promise<void>;
  fetchMembershipPlans: () => Promise<void>;
  fetchLocationOverrides: (locationId?: string) => Promise<void>;
  fetchMultiDogRules: () => Promise<void>;
  fetchPackages: () => Promise<void>;
  fetchFeeRules: () => Promise<void>;
  fetchDiscountRules: () => Promise<void>;
  
  // ========================================================================
  // SERVICE OPERATIONS
  // ========================================================================
  
  createService: (service: Omit<Service, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<Service>;
  updateService: (id: string, updates: Partial<Service>) => Promise<void>;
  toggleServiceStatus: (id: string) => Promise<void>;
  
  // ========================================================================
  // PRICE BOOK OPERATIONS
  // ========================================================================
  
  createPriceBook: (priceBook: Omit<PriceBook, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<PriceBook>;
  updatePriceBook: (id: string, updates: Partial<PriceBook>) => Promise<void>;
  activatePriceBook: (id: string) => Promise<void>;
  archivePriceBook: (id: string) => Promise<void>;
  
  // ========================================================================
  // MEMBERSHIP OPERATIONS
  // ========================================================================
  
  createMembershipPlan: (plan: Omit<MembershipPlan, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<MembershipPlan>;
  updateMembershipPlan: (id: string, updates: Partial<MembershipPlan>) => Promise<void>;
  toggleMembershipStatus: (id: string) => Promise<void>;
  
  // ========================================================================
  // LOCATION OVERRIDE OPERATIONS
  // ========================================================================
  
  createLocationOverride: (override: Omit<LocationPriceOverride, 'id' | 'createdAt' | 'createdBy'>) => Promise<LocationPriceOverride>;
  updateLocationOverride: (id: string, updates: Partial<LocationPriceOverride>) => Promise<void>;
  deleteLocationOverride: (id: string) => Promise<void>;
  
  // ========================================================================
  // MULTI-DOG RULE OPERATIONS
  // ========================================================================
  
  createMultiDogRule: (rule: Omit<MultiDogRule, 'id' | 'createdAt' | 'createdBy'>) => Promise<MultiDogRule>;
  updateMultiDogRule: (id: string, updates: Partial<MultiDogRule>) => Promise<void>;
  toggleMultiDogRuleStatus: (id: string) => Promise<void>;
  
  // ========================================================================
  // FEE RULE OPERATIONS
  // ========================================================================
  
  createFeeRule: (rule: Omit<FeeRule, 'id' | 'createdAt' | 'createdBy'>) => Promise<FeeRule>;
  updateFeeRule: (id: string, updates: Partial<FeeRule>) => Promise<void>;
  toggleFeeRuleStatus: (id: string) => Promise<void>;
  
  // ========================================================================
  // DISCOUNT RULE OPERATIONS
  // ========================================================================
  
  createDiscountRule: (rule: Omit<DiscountRule, 'id' | 'createdAt' | 'createdBy'>) => Promise<DiscountRule>;
  updateDiscountRule: (id: string, updates: Partial<DiscountRule>) => Promise<void>;
  toggleDiscountRuleStatus: (id: string) => Promise<void>;
  
  // ========================================================================
  // PRICE RESOLUTION (CRITICAL FOR BOOKINGS)
  // ========================================================================
  
  resolvePrice: (request: PriceResolutionRequest) => Promise<PriceResolutionResponse>;
}

export const useServicesPricingStore = create<ServicesPricingState>((set, get) => ({
  services: [],
  priceBooks: [],
  activePriceBook: null,
  locationOverrides: [],
  membershipPlans: [],
  multiDogRules: [],
  packages: [],
  feeRules: [],
  discountRules: [],
  isLoading: false,
  
  // ========================================================================
  // FETCH OPERATIONS
  // ========================================================================
  
  fetchServices: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch(`${API_URL}/pricing/services`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const services = await res.json();
        set({ services, isLoading: false });
      } else {
        console.error('Failed to fetch services:', res.status, res.statusText);
        set({ isLoading: false });
      }
    } catch (e) {
      console.error('Failed to fetch services', e);
      set({ isLoading: false });
    }
  },
  
  fetchPriceBooks: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch(`${API_URL}/pricing/price-books`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const priceBooks = await res.json();
        const active = priceBooks.find((pb: PriceBook) => pb.isActive) || null;
        set({ priceBooks, activePriceBook: active, isLoading: false });
      } else {
        console.error('Failed to fetch price books:', res.status, res.statusText);
        set({ isLoading: false });
      }
    } catch (e) {
      console.error('Failed to fetch price books', e);
      set({ isLoading: false });
    }
  },
  
  fetchMembershipPlans: async () => {
    try {
      set({ isLoading: true });
      const res = await fetch(`${API_URL}/pricing/memberships`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const membershipPlans = await res.json();
        set({ membershipPlans, isLoading: false });
      } else {
        console.error('Failed to fetch membership plans:', res.status, res.statusText);
        set({ isLoading: false });
      }
    } catch (e) {
      console.error('Failed to fetch membership plans', e);
      set({ isLoading: false });
    }
  },
  
  fetchLocationOverrides: async (locationId?: string) => {
    try {
      const url = locationId 
        ? `${API_URL}/pricing/location-overrides?locationId=${locationId}`
        : `${API_URL}/pricing/location-overrides`;
      const res = await fetch(url, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const locationOverrides = await res.json();
        set({ locationOverrides });
      }
    } catch (e) {
      console.error('Failed to fetch location overrides', e);
    }
  },
  
  fetchMultiDogRules: async () => {
    try {
      const res = await fetch(`${API_URL}/pricing/multi-dog-rules`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const multiDogRules = await res.json();
        set({ multiDogRules });
      }
    } catch (e) {
      console.error('Failed to fetch multi-dog rules', e);
    }
  },
  
  fetchPackages: async () => {
    try {
      const res = await fetch(`${API_URL}/pricing/packages`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const packages = await res.json();
        set({ packages });
      }
    } catch (e) {
      console.error('Failed to fetch packages', e);
    }
  },
  
  fetchFeeRules: async () => {
    try {
      const res = await fetch(`${API_URL}/pricing/fee-rules`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const feeRules = await res.json();
        set({ feeRules });
      }
    } catch (e) {
      console.error('Failed to fetch fee rules', e);
    }
  },
  
  fetchDiscountRules: async () => {
    try {
      const res = await fetch(`${API_URL}/pricing/discount-rules`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const discountRules = await res.json();
        set({ discountRules });
      }
    } catch (e) {
      console.error('Failed to fetch discount rules', e);
    }
  },
  
  // ========================================================================
  // SERVICE OPERATIONS
  // ========================================================================
  
  createService: async (service) => {
    const res = await fetch(`${API_URL}/pricing/services`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(service)
    });
    if (!res.ok) throw new Error('Failed to create service');
    const newService = await res.json();
    set(state => ({ services: [...state.services, newService] }));
    return newService;
  },
  
  updateService: async (id, updates) => {
    const res = await fetch(`${API_URL}/pricing/services/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update service');
    const updated = await res.json();
    set(state => ({
      services: state.services.map(s => s.id === id ? updated : s)
    }));
  },
  
  toggleServiceStatus: async (id) => {
    const service = get().services.find(s => s.id === id);
    if (!service) return;
    await get().updateService(id, { isActive: !service.isActive });
  },
  
  // ========================================================================
  // PRICE BOOK OPERATIONS
  // ========================================================================
  
  createPriceBook: async (priceBook) => {
    const res = await fetch(`${API_URL}/pricing/price-books`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(priceBook)
    });
    if (!res.ok) throw new Error('Failed to create price book');
    const newPriceBook = await res.json();
    set(state => ({ priceBooks: [...state.priceBooks, newPriceBook] }));
    return newPriceBook;
  },
  
  updatePriceBook: async (id, updates) => {
    const res = await fetch(`${API_URL}/pricing/price-books/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update price book');
    const updated = await res.json();
    set(state => ({
      priceBooks: state.priceBooks.map(pb => pb.id === id ? updated : pb),
      activePriceBook: updated.isActive ? updated : state.activePriceBook
    }));
  },
  
  activatePriceBook: async (id) => {
    // Deactivate all others first
    const state = get();
    for (const pb of state.priceBooks) {
      if (pb.isActive && pb.id !== id) {
        await get().updatePriceBook(pb.id, { isActive: false });
      }
    }
    await get().updatePriceBook(id, { isActive: true });
  },
  
  archivePriceBook: async (id) => {
    await get().updatePriceBook(id, { 
      isActive: false,
      effectiveTo: new Date().toISOString()
    });
  },
  
  // ========================================================================
  // MEMBERSHIP OPERATIONS
  // ========================================================================
  
  createMembershipPlan: async (plan) => {
    const res = await fetch(`${API_URL}/pricing/memberships`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(plan)
    });
    if (!res.ok) throw new Error('Failed to create membership plan');
    const newPlan = await res.json();
    set(state => ({ membershipPlans: [...state.membershipPlans, newPlan] }));
    return newPlan;
  },
  
  updateMembershipPlan: async (id, updates) => {
    const res = await fetch(`${API_URL}/pricing/memberships/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update membership plan');
    const updated = await res.json();
    set(state => ({
      membershipPlans: state.membershipPlans.map(mp => mp.id === id ? updated : mp)
    }));
  },
  
  toggleMembershipStatus: async (id) => {
    const plan = get().membershipPlans.find(mp => mp.id === id);
    if (!plan) return;
    await get().updateMembershipPlan(id, { isActive: !plan.isActive });
  },
  
  // ========================================================================
  // LOCATION OVERRIDE OPERATIONS
  // ========================================================================
  
  createLocationOverride: async (override) => {
    const res = await fetch(`${API_URL}/pricing/location-overrides`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(override)
    });
    if (!res.ok) throw new Error('Failed to create location override');
    const newOverride = await res.json();
    set(state => ({ locationOverrides: [...state.locationOverrides, newOverride] }));
    return newOverride;
  },
  
  updateLocationOverride: async (id, updates) => {
    const res = await fetch(`${API_URL}/pricing/location-overrides/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update location override');
    const updated = await res.json();
    set(state => ({
      locationOverrides: state.locationOverrides.map(lo => lo.id === id ? updated : lo)
    }));
  },
  
  deleteLocationOverride: async (id) => {
    const res = await fetch(`${API_URL}/pricing/location-overrides/${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete location override');
    set(state => ({
      locationOverrides: state.locationOverrides.filter(lo => lo.id !== id)
    }));
  },
  
  // ========================================================================
  // MULTI-DOG RULE OPERATIONS
  // ========================================================================
  
  createMultiDogRule: async (rule) => {
    const res = await fetch(`${API_URL}/pricing/multi-dog-rules`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(rule)
    });
    if (!res.ok) throw new Error('Failed to create multi-dog rule');
    const newRule = await res.json();
    set(state => ({ multiDogRules: [...state.multiDogRules, newRule] }));
    return newRule;
  },
  
  updateMultiDogRule: async (id, updates) => {
    const res = await fetch(`${API_URL}/pricing/multi-dog-rules/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update multi-dog rule');
    const updated = await res.json();
    set(state => ({
      multiDogRules: state.multiDogRules.map(mdr => mdr.id === id ? updated : mdr)
    }));
  },
  
  toggleMultiDogRuleStatus: async (id) => {
    const rule = get().multiDogRules.find(mdr => mdr.id === id);
    if (!rule) return;
    await get().updateMultiDogRule(id, { isActive: !rule.isActive });
  },
  
  // ========================================================================
  // FEE RULE OPERATIONS
  // ========================================================================
  
  createFeeRule: async (rule) => {
    const res = await fetch(`${API_URL}/pricing/fee-rules`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(rule)
    });
    if (!res.ok) throw new Error('Failed to create fee rule');
    const newRule = await res.json();
    set(state => ({ feeRules: [...state.feeRules, newRule] }));
    return newRule;
  },
  
  updateFeeRule: async (id, updates) => {
    const res = await fetch(`${API_URL}/pricing/fee-rules/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update fee rule');
    const updated = await res.json();
    set(state => ({
      feeRules: state.feeRules.map(fr => fr.id === id ? updated : fr)
    }));
  },
  
  toggleFeeRuleStatus: async (id) => {
    const rule = get().feeRules.find(fr => fr.id === id);
    if (!rule) return;
    await get().updateFeeRule(id, { isActive: !rule.isActive });
  },
  
  // ========================================================================
  // DISCOUNT RULE OPERATIONS
  // ========================================================================
  
  createDiscountRule: async (rule) => {
    const res = await fetch(`${API_URL}/pricing/discount-rules`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(rule)
    });
    if (!res.ok) throw new Error('Failed to create discount rule');
    const newRule = await res.json();
    set(state => ({ discountRules: [...state.discountRules, newRule] }));
    return newRule;
  },
  
  updateDiscountRule: async (id, updates) => {
    const res = await fetch(`${API_URL}/pricing/discount-rules/${id}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update discount rule');
    const updated = await res.json();
    set(state => ({
      discountRules: state.discountRules.map(dr => dr.id === id ? updated : dr)
    }));
  },
  
  toggleDiscountRuleStatus: async (id) => {
    const rule = get().discountRules.find(dr => dr.id === id);
    if (!rule) return;
    await get().updateDiscountRule(id, { isActive: !rule.isActive });
  },
  
  // ========================================================================
  // PRICE RESOLUTION (CRITICAL FOR BOOKINGS)
  // ========================================================================
  
  resolvePrice: async (request) => {
    const res = await fetch(`${API_URL}/pricing/resolve`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(request)
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to resolve price: ${error}`);
    }
    return await res.json();
  },
}));
