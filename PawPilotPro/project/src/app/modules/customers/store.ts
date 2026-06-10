// Customer Management Store - MDC Operations Centre
// Zustand store for customer/household operations

import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { broadcastMutation } from '../../lib/realtimeBroadcast';
import type {
  Household,
  HouseholdContact,
  Pet,
  PetDocument,
  ActivityEvent,
  CustomerFilters,
  DocumentAlert,
  HouseholdNote,
  HouseholdFlag,
  TimelineItem,
} from './types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers`;

interface CustomerState {
  // Data
  households: Array<Household & { contacts_count?: number; pets_count?: number; primary_contact?: HouseholdContact }>;
  selectedHousehold: (Household & { contacts?: HouseholdContact[]; pets?: Pet[]; documents?: PetDocument[] }) | null;
  currentHouseholdDetail: (Household & { contacts?: HouseholdContact[]; pets?: Pet[]; documents?: PetDocument[] }) | null;
  currentPetProfile: Pet | null;
  contacts: HouseholdContact[];
  pets: Pet[];
  documents: PetDocument[];
  activity: ActivityEvent[];
  documentAlerts: DocumentAlert[];
  notes: HouseholdNote[];
  flags: HouseholdFlag[];
  
  // Aliases for compatibility
  householdListItems: Array<{
    household: Household;
    primaryContact: HouseholdContact | null;
    contactsCount: number;
    petsCount: number;
    documentAlerts: number;
    activeFlags: number;
  }>;
  
  // Filters
  filters: CustomerFilters;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  
  // Actions - Households
  fetchHouseholds: (filters?: CustomerFilters) => Promise<void>;
  fetchHouseholdById: (id: string) => Promise<void>;
  fetchHouseholdDetail: (id: string) => Promise<void>; // Alias
  createHousehold: (data: Partial<Household>) => Promise<Household>;
  updateHousehold: (id: string, data: Partial<Household>) => Promise<Household>;
  deleteHousehold: (id: string) => Promise<Household>;
  
  // Actions - Contacts
  fetchContacts: (householdId: string) => Promise<void>;
  createContact: (householdId: string, data: Partial<HouseholdContact>) => Promise<HouseholdContact>;
  updateContact: (id: string, data: Partial<HouseholdContact>) => Promise<HouseholdContact>;
  deleteContact: (id: string) => Promise<void>;
  
  // Actions - Pets
  fetchPets: (householdId: string) => Promise<void>;
  fetchPetById: (id: string) => Promise<Pet>;
  fetchPetProfile: (id: string) => Promise<void>; // Alias
  createPet: (householdId: string, data: Partial<Pet>) => Promise<Pet>;
  updatePet: (id: string, data: Partial<Pet>) => Promise<Pet>;
  
  // Actions - Documents
  fetchDocuments: (householdId: string) => Promise<void>;
  createDocument: (householdId: string, data: Partial<PetDocument>) => Promise<PetDocument>;
  deleteDocument: (id: string) => Promise<string>; // Returns storage_path
  
  // Actions - Pulse
  fetchActivity: (householdId: string) => Promise<void>;
  fetchPetTimeline: (petId: string) => Promise<TimelineItem[]>;
  createActivity: (data: Partial<ActivityEvent>) => Promise<ActivityEvent>;
  
  // Actions - Alerts
  fetchDocumentAlerts: () => Promise<void>;
  
  // Actions - Notes
  fetchNotes: (householdId: string) => Promise<void>;
  createNote: (householdId: string, data: Partial<HouseholdNote> & { pet_ids?: string[] }) => Promise<HouseholdNote>;
  updateNote: (id: string, data: Partial<HouseholdNote> & { pet_ids?: string[] }) => Promise<HouseholdNote>;
  deleteNote: (id: string) => Promise<void>;
  
  // Actions - Flags
  fetchFlags: (householdId: string) => Promise<void>;
  createFlag: (householdId: string, data: Partial<HouseholdFlag>) => Promise<HouseholdFlag>;
  updateFlag: (id: string, data: Partial<HouseholdFlag>) => Promise<HouseholdFlag>;
  deleteFlag: (id: string) => Promise<void>;
  
  // Filters
  setFilters: (filters: CustomerFilters) => void;
  clearFilters: () => void;
  
  // UI
  setSelectedHousehold: (household: Household | null) => void;
  clearError: () => void;
  reset: () => void;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  // Initial State
  households: [],
  selectedHousehold: null,
  currentHouseholdDetail: null,
  currentPetProfile: null,
  contacts: [],
  pets: [],
  documents: [],
  activity: [],
  documentAlerts: [],
  notes: [],
  flags: [],
  filters: {},
  isLoading: false,
  error: null,
  
  // Computed list items
  get householdListItems() {
    const state = get();
    return state.households.map(h => ({
      household: h,
      primaryContact: h.primary_contact || null,
      contactsCount: h.contacts_count || 0,
      petsCount: h.pets_count || 0,
      documentAlerts: 0, // Would be calculated from documents
      activeFlags: 0, // Would be calculated from flags
    }));
  },
  
  // ============================================================================
  // HOUSEHOLDS
  // ============================================================================
  
  fetchHouseholds: async (filters?: CustomerFilters) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      
      const currentFilters = filters || get().filters;
      
      if (currentFilters.search) params.append('search', currentFilters.search);
      if (currentFilters.status) params.append('status', currentFilters.status);
      if (currentFilters.vip !== undefined) params.append('vip', currentFilters.vip.toString());
      if (currentFilters.payment_hold !== undefined) params.append('payment_hold', currentFilters.payment_hold.toString());
      if (currentFilters.location_id) params.append('location_id', currentFilters.location_id);
      
      const url = params.toString() ? `${BASE_URL}/households?${params.toString()}` : `${BASE_URL}/households`;
      
      console.log('[fetchHouseholds] Fetching from:', url);
      
      console.log('[fetchHouseholds] Fetching from:', url);
      
      const response = await fetch(url, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('[fetchHouseholds] Error response:', error);
        console.error('[fetchHouseholds] Error response:', error);
        throw new Error(error.error || 'Failed to fetch households');
      }
      
      const rawHouseholds = await response.json();
      const households = rawHouseholds.filter((h: any) => h.id && h.id.startsWith('hh-'));
      console.log('[fetchHouseholds] Received households:', households.length, 'households');
      
      set({ households, isLoading: false });
    } catch (error: any) {
      console.error('Fetch households error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchHouseholdById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households/${id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch household');
      }
      
      const household = await response.json();
      
      set({
        selectedHousehold: household,
        contacts: household.contacts || [],
        pets: household.pets || [],
        documents: household.documents || [],
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Fetch household error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  fetchHouseholdDetail: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households/${id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        
        // Handle 404 gracefully without logging as error
        if (response.status === 404) {
          set({ 
            error: error.error || 'Household not found', 
            isLoading: false,
            currentHouseholdDetail: null,
            contacts: [],
            pets: [],
            documents: [],
          });
          return;
        }
        
        throw new Error(error.error || 'Failed to fetch household detail');
      }
      
      const household = await response.json();
      
      set({
        currentHouseholdDetail: {
          ...household,
          contacts: household.contacts || [],
          pets: household.pets || [],
          documents: household.documents || [],
          activities: household.activities || [],
          activeFlags: household.activeFlags || [],
        },
        contacts: household.contacts || [],
        pets: household.pets || [],
        documents: household.documents || [],
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Fetch household detail error:', error);
      set({ 
        error: error.message, 
        isLoading: false,
        currentHouseholdDetail: null,
        contacts: [],
        pets: [],
        documents: [],
      });
    }
  },
  
  createHousehold: async (data: Partial<Household>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create household');
      }
      
      const household = await response.json();
      
      set(state => ({
        households: [household, ...state.households],
        isLoading: false,
      }));
      
      return household;
    } catch (error: any) {
      console.error('Create household error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateHousehold: async (id: string, data: Partial<Household>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households/${id}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update household');
      }
      
      const household = await response.json();
      
      set(state => ({
        households: state.households.map(h => h.id === id ? { ...h, ...household } : h),
        selectedHousehold: state.selectedHousehold?.id === id ? { ...state.selectedHousehold, ...household } : state.selectedHousehold,
        isLoading: false,
      }));
      
      return household;
    } catch (error: any) {
      console.error('Update household error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  deleteHousehold: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households/${id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete household');
      }
      
      set(state => ({
        households: state.households.filter(h => h.id !== id),
        currentHouseholdDetail: state.currentHouseholdDetail?.id === id ? null : state.currentHouseholdDetail,
        isLoading: false,
      }));
      
      return await response.json();
    } catch (error: any) {
      console.error('Delete household error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // CONTACTS
  // ============================================================================
  
  fetchContacts: async (householdId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/contacts`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch contacts');
      }
      
      const contacts = await response.json();
      set({ contacts });
    } catch (error: any) {
      console.error('Fetch contacts error:', error);
      throw error;
    }
  },
  
  createContact: async (householdId: string, data: Partial<HouseholdContact>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/contacts`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create contact');
      }
      
      const contact = await response.json();
      
      set(state => ({
        contacts: [...state.contacts, contact],
        isLoading: false,
      }));
      
      return contact;
    } catch (error: any) {
      console.error('Create contact error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateContact: async (id: string, data: Partial<HouseholdContact>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/contacts/${id}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update contact');
      }
      
      const contact = await response.json();
      
      set(state => ({
        contacts: state.contacts.map(c => c.id === id ? contact : c),
        isLoading: false,
      }));
      
      return contact;
    } catch (error: any) {
      console.error('Update contact error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  deleteContact: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/contacts/${id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete contact');
      }
      
      set(state => ({
        contacts: state.contacts.filter(c => c.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('Delete contact error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // PETS
  // ============================================================================
  
  fetchPets: async (householdId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/pets`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch pets');
      }
      
      const pets = await response.json();
      set({ pets });
    } catch (error: any) {
      console.error('Fetch pets error:', error);
      throw error;
    }
  },
  
  fetchPetById: async (id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/pets/${id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch pet');
      }
      
      return await response.json();
    } catch (error: any) {
      console.error('Fetch pet error:', error);
      throw error;
    }
  },
  
  fetchPetProfile: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/pets/${id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch pet profile');
      }
      
      const pet = await response.json();
      
      // Also fetch the household to get contact information
      const householdResponse = await fetch(`${BASE_URL}/households/${pet.household_id}`, {
        headers: await getAuthHeaders(),
      });
      
      if (householdResponse.ok) {
        const household = await householdResponse.json();
        
        set({
          currentPetProfile: pet,
          currentHouseholdDetail: household,
          isLoading: false,
        });
      } else {
        // If household fetch fails, still set the pet but without household
        set({
          currentPetProfile: pet,
          isLoading: false,
        });
      }
      
      return pet;
    } catch (error: any) {
      console.error('Fetch pet profile error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  createPet: async (householdId: string, data: Partial<Pet>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/pets`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create pet');
      }
      
      const pet = await response.json();
      
      set(state => ({
        pets: [...state.pets, pet],
        isLoading: false,
      }));
      
      return pet;
    } catch (error: any) {
      console.error('Create pet error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updatePet: async (id: string, data: Partial<Pet>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/pets/${id}`, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update pet');
      }
      
      const pet = await response.json();
      
      set(state => ({
        pets: state.pets.map(p => p.id === id ? pet : p),
        isLoading: false,
      }));
      
      return pet;
    } catch (error: any) {
      console.error('Update pet error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // DOCUMENTS
  // ============================================================================
  
  fetchDocuments: async (householdId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/documents`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch documents');
      }
      
      const documents = await response.json();
      set({ documents });
    } catch (error: any) {
      console.error('Fetch documents error:', error);
      throw error;
    }
  },
  
  createDocument: async (householdId: string, data: Partial<PetDocument>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/documents`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create document');
      }
      
      const document = await response.json();
      
      set(state => ({
        documents: [...state.documents, document],
        isLoading: false,
      }));
      
      return document;
    } catch (error: any) {
      console.error('Create document error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  deleteDocument: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/documents/${id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete document');
      }
      
      const result = await response.json();
      
      set(state => ({
        documents: state.documents.filter(d => d.id !== id),
        isLoading: false,
      }));
      
      return result.storage_path;
    } catch (error: any) {
      console.error('Delete document error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // ACTIVITY
  // ============================================================================
  
  fetchActivity: async (householdId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/activity`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch activity');
      }
      
      const activity = await response.json();
      set({ activity });
    } catch (error: any) {
      console.error('Fetch activity error:', error);
      throw error;
    }
  },
  
  fetchPetTimeline: async (petId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/pets/${petId}/timeline`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch pet timeline');
      }
      
      const timeline = await response.json();
      return timeline;
    } catch (error: any) {
      console.error('Fetch pet timeline error:', error);
      throw error;
    }
  },
  
  createActivity: async (data: Partial<ActivityEvent>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/activity`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create activity');
      }
      
      const activity = await response.json();
      
      set(state => ({
        activity: [...state.activity, activity],
        isLoading: false,
      }));
      
      return activity;
    } catch (error: any) {
      console.error('Create activity error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // ALERTS
  // ============================================================================
  
  fetchDocumentAlerts: async () => {
    try {
      const response = await fetch(`${BASE_URL}/document-alerts`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch document alerts');
      }
      
      const alerts = await response.json();
      set({ documentAlerts: alerts });
    } catch (error: any) {
      console.error('Fetch document alerts error:', error);
      throw error;
    }
  },
  
  // ============================================================================
  // NOTES
  // ============================================================================
  
  fetchNotes: async (householdId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/notes`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch notes');
      }
      
      const notes = await response.json();
      set({ notes });
    } catch (error: any) {
      console.error('Fetch notes error:', error);
      throw error;
    }
  },
  
  createNote: async (householdId: string, data: Partial<HouseholdNote> & { pet_ids?: string[] }) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/notes`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create note');
      }
      
      const note = await response.json();
      
      set(state => ({
        notes: [...state.notes, note],
        isLoading: false,
      }));
      
      return note;
    } catch (error: any) {
      console.error('Create note error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateNote: async (id: string, data: Partial<HouseholdNote> & { pet_ids?: string[] }) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/notes/${id}`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update note');
      }
      
      const note = await response.json();
      
      set(state => ({
        notes: state.notes.map(n => n.id === id ? note : n),
        isLoading: false,
      }));
      
      return note;
    } catch (error: any) {
      console.error('Update note error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  deleteNote: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/notes/${id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete note');
      }
      
      set(state => ({
        notes: state.notes.filter(n => n.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('Delete note error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // FLAGS
  // ============================================================================
  
  fetchFlags: async (householdId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/flags`, {
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch flags');
      }
      
      const flags = await response.json();
      set({ flags });
    } catch (error: any) {
      // Silently fail - flags might not exist yet or household might be invalid
      // Don't log error to console to avoid cluttering logs
      set({ flags: [] });
    }
  },
  
  createFlag: async (householdId: string, data: Partial<HouseholdFlag>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/households/${householdId}/flags`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create flag');
      }
      
      const flag = await response.json();
      
      set(state => ({
        flags: [...state.flags, flag],
        isLoading: false,
      }));
      
      return flag;
    } catch (error: any) {
      console.error('Create flag error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  updateFlag: async (id: string, data: Partial<HouseholdFlag>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/flags/${id}`, {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update flag');
      }
      
      const flag = await response.json();
      
      set(state => ({
        flags: state.flags.map(f => f.id === id ? flag : f),
        isLoading: false,
      }));
      
      return flag;
    } catch (error: any) {
      console.error('Update flag error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  deleteFlag: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${BASE_URL}/flags/${id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete flag');
      }
      
      set(state => ({
        flags: state.flags.filter(f => f.id !== id),
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('Delete flag error:', error);
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
  
  // ============================================================================
  // FILTERS
  // ============================================================================
  
  setFilters: (filters: CustomerFilters) => {
    set({ filters });
  },
  
  clearFilters: () => {
    set({ filters: {} });
  },
  
  // ============================================================================
  // UI
  // ============================================================================
  
  setSelectedHousehold: (household: Household | null) => {
    set({ selectedHousehold: household });
  },
  
  clearError: () => set({ error: null }),
  
  reset: () => set({
    households: [],
    selectedHousehold: null,
    currentHouseholdDetail: null,
    currentPetProfile: null,
    contacts: [],
    pets: [],
    documents: [],
    activity: [],
    documentAlerts: [],
    notes: [],
    flags: [],
    filters: {},
    isLoading: false,
    error: null,
  }),
}));