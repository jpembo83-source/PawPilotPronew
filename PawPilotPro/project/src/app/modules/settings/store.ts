import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

export interface OrganisationSettings {
  name: string;
  tradingName: string;
  address: string;
  timezone: string;
  language: string;
  currency: string;
  dialCode: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  emailSenderName: string;
  defaultOperatingHours: string;
  cancellationRule: string;
  vaccinationGracePeriodDays: number;
  /** Which regional vaccine checklist the pet profile offers ('uk' default). */
  vaccinationSchedule?: 'uk' | 'ch';
}

export interface Location {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  isActive: boolean;
  enabledModules: string[]; // IDs of modules enabled for this location
  capacity: {
    maxDogs: number;
    smallDogLimit: number;
    largeDogLimit: number;
  };
  /** Storage object path of the dashboard header image (private
   *  tenant-assets bucket). Set only by the upload endpoint. */
  headerImagePath?: string | null;
  /** Image visibility 0–100 under the fixed readability scrim. */
  headerImageStrength?: number;
  /** Focal point for object-position, each axis 0–1 (default centre). */
  headerImageFocalPoint?: { x: number; y: number } | null;
  /** Short-lived signed URL minted by the server on every read. Never a
   *  public URL; never persisted client-side. */
  headerImageUrl?: string | null;
}

export interface SettingsState {
  organisation: OrganisationSettings;
  globalEnabledModules: string[]; // IDs of modules enabled at org level
  locations: Location[];
  auditLog: AuditEntry[];
  
  fetchLocations: () => Promise<void>;
  fetchOrganisation: () => Promise<void>;
  fetchGlobalModules: () => Promise<void>;
  updateOrganisation: (settings: Partial<OrganisationSettings>) => Promise<void>;
  toggleGlobalModule: (moduleId: string, isEnabled: boolean) => Promise<void>;
  addLocation: (location: Omit<Location, 'id'>) => Promise<void>;
  updateLocation: (id: string, location: Partial<Location>) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  toggleLocationModule: (locationId: string, moduleId: string, isEnabled: boolean) => Promise<void>;
  toggleLocationStatus: (id: string) => Promise<void>;
  logAction: (action: string, details: string, user: string) => void;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      organisation: {
        name: 'Paw Pilot Pro',
        tradingName: '',
        address: '',
        timezone: 'Europe/London',
        language: 'en-GB',
        currency: 'GBP',
        dialCode: '+44',
        primaryColor: '',
        secondaryColor: '',
        emailSenderName: 'Paw Pilot Pro',
        defaultOperatingHours: '07:00 - 19:00',
        cancellationRule: '24h',
        vaccinationGracePeriodDays: 0,
        vaccinationSchedule: 'uk',
      },
      globalEnabledModules: ['daycare', 'grooming', 'overnights', 'transport'], // Default enabled
      locations: [],
      auditLog: [],
      
      fetchLocations: async () => {
         try {
            console.log('[fetchLocations] Starting location fetch...');
            const headers = await getAuthHeaders();
            console.log('[fetchLocations] Got auth headers:', headers);
            
            const url = `${API_URL}/locations`;
            console.log('[fetchLocations] Fetching from:', url);
            
            const res = await fetch(url, {
               headers
            });
            
            console.log('[fetchLocations] Response status:', res.status);
            console.log('[fetchLocations] Response ok:', res.ok);
            
            if (!res.ok) {
              // If it's a 403, the user doesn't have permission - this is expected for staff roles
              // Don't throw an error, just return silently
              if (res.status === 403) {
                console.debug('[fetchLocations] Access denied (expected for staff roles) - skipping location fetch');
                return; // Exit without throwing
              }
              
              // For other errors, throw
              const errorText = await res.text();
              console.error('[fetchLocations] Error response:', errorText);
              throw new Error(`Failed to fetch locations: ${res.status} ${errorText}`);
            }
            
            const locations = await res.json();
            console.log('[fetchLocations] Received locations:', locations);
            set({ locations });
         } catch (e: any) {
            // Only log and re-throw if it's not a permission error
            if (e.message?.includes('403') || e.message?.includes('Forbidden')) {
              console.debug('[fetchLocations] Skipped due to insufficient permissions (expected for staff roles)');
              return; // Exit without re-throwing
            }
            console.error('[fetchLocations] Failed to fetch locations:', e);
            // Re-throw for other errors so Layout can catch and handle gracefully
            throw e;
         }
      },

      fetchOrganisation: async () => {
         try {
            const headers = await getAuthHeaders();
            
            const res = await fetch(`${API_URL}/organisation`, {
               headers
            });
            
            if (!res.ok) {
              // If it's a 403, the user doesn't have permission - this is expected for staff roles
              if (res.status === 403) {
                console.debug('[fetchOrganisation] Access denied (expected for staff roles) - skipping organisation fetch');
                return; // Exit without throwing
              }
              // For other errors, throw
              throw new Error(`Failed to fetch organisation: ${res.status}`);
            }
            
            if (res.ok) {
               const org = await res.json();
               if (org && Object.keys(org).length > 0) {
                  // Merge with defaults to ensure all fields exist
                  set((state) => ({ organisation: { ...state.organisation, ...org } }));
                  
                  // Cache branding for login page (shown before auth)
                  if (org.logoUrl) {
                    localStorage.setItem('paw_pilot_cached_logo', org.logoUrl);
                  }
                  if (org.tradingName || org.name) {
                    localStorage.setItem('paw_pilot_cached_org_name', org.tradingName || org.name);
                  }
               }
            }
         } catch (e: any) {
            // Only log and re-throw if it's not a permission error
            if (e.message?.includes('403') || e.message?.includes('Forbidden')) {
              console.debug('[fetchOrganisation] Skipped due to insufficient permissions (expected for staff roles)');
              return; // Exit without re-throwing
            }
            console.error('Failed to fetch organisation settings', e);
            // Re-throw so Layout can catch and handle gracefully
            throw e;
         }
      },

      fetchGlobalModules: async () => {
        try {
          console.log('[fetchGlobalModules] Starting fetch...');
          const headers = await getAuthHeaders();
          console.log('[fetchGlobalModules] Got auth headers, making request...');
          
          const res = await fetch(`${API_URL}/settings/global-modules`, {
            headers
          });
          console.log('[fetchGlobalModules] Response status:', res.status, res.statusText);
          
          if (!res.ok) {
            // If it's a 403, the user doesn't have permission - this is expected for staff roles
            if (res.status === 403) {
              console.debug('[fetchGlobalModules] Access denied (expected for staff roles) - skipping global modules fetch');
              return; // Exit without throwing
            }
            // For other non-OK responses, just set empty array (feature may not be deployed yet)
            console.debug('Failed to fetch global modules - Response not OK:', res.status, res.statusText);
            set({ globalEnabledModules: [] });
            return;
          }
          
          const modules = await res.json();
          console.log('[fetchGlobalModules] Success:', modules);
          set({ globalEnabledModules: modules.globalEnabledModules });
        } catch (e: any) {
          // Only log and re-throw if it's not a permission error
          if (e.message?.includes('403') || e.message?.includes('Forbidden')) {
            console.debug('[fetchGlobalModules] Skipped due to insufficient permissions (expected for staff roles)');
            return; // Exit without re-throwing
          }
          console.debug('Failed to fetch global modules - Network error:', e);
          // Re-throw so Layout can catch and handle gracefully  
          throw e;
        }
      },

      updateOrganisation: async (settings) => {
        // Optimistic update
        set((state) => ({
          organisation: { ...state.organisation, ...settings },
        }));
        
        // Update branding cache for login page
        if (settings.logoUrl !== undefined) {
          if (settings.logoUrl) {
            localStorage.setItem('paw_pilot_cached_logo', settings.logoUrl);
          } else {
            localStorage.removeItem('paw_pilot_cached_logo');
          }
        }
        if (settings.tradingName !== undefined || settings.name !== undefined) {
          const current = get().organisation;
          const orgName = settings.tradingName || settings.name || current.tradingName || current.name;
          if (orgName) {
            localStorage.setItem('paw_pilot_cached_org_name', orgName);
          }
        }
        
        try {
           const current = get().organisation;
           const updated = { ...current, ...settings };
           await fetch(`${API_URL}/organisation`, {
              method: 'PUT',
              headers: await getAuthHeaders(),
              body: JSON.stringify(updated)
           });
        } catch (e) {
           console.error('Failed to update organisation', e);
        }
      },
        
      toggleGlobalModule: async (moduleId, isEnabled) => {
        set((state) => {
          const currentModules = state.globalEnabledModules || [];
          let newModules = isEnabled 
            ? [...currentModules, moduleId]
            : currentModules.filter(id => id !== moduleId);
          
          return {
            globalEnabledModules: newModules
          };
        });
        
        // Persist to backend
        try {
          const newModules = get().globalEnabledModules;
          const res = await fetch(`${API_URL}/settings/global-modules`, {
            method: 'PUT',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ globalEnabledModules: newModules })
          });
          if (!res.ok) {
            console.error('Failed to persist global modules - Response not OK:', res.status, res.statusText);
            const text = await res.text();
            console.error('Response body:', text);
          }
        } catch (e) {
          console.error('Failed to persist global modules - Network error:', e);
        }
      },
        
      addLocation: async (location) => {
         try {
            console.log('[addLocation] Starting location creation...');
            console.log('[addLocation] Location data:', location);
            const headers = await getAuthHeaders();
            console.log('[addLocation] Got auth headers:', headers);
            console.log('[addLocation] Making POST request to:', `${API_URL}/locations`);
            
            const res = await fetch(`${API_URL}/locations`, {
               method: 'POST',
               headers,
               body: JSON.stringify(location)
            });
            
            console.log('[addLocation] Response status:', res.status, res.statusText);
            console.log('[addLocation] Response headers:', Object.fromEntries(res.headers.entries()));
            
            if (res.ok) {
               const newLocation = await res.json();
               console.log('[addLocation] Location created successfully:', newLocation);
               set((state) => ({
                  locations: [...state.locations, newLocation]
               }));
            } else {
               const contentType = res.headers.get('content-type');
               let errorMessage;
               
               if (contentType?.includes('application/json')) {
                  const errorData = await res.json();
                  console.error('[addLocation] Error response (JSON):', errorData);
                  errorMessage = errorData.error || errorData.message || res.statusText;
               } else {
                  const text = await res.text();
                  console.error('[addLocation] Error response (text):', text);
                  errorMessage = text || res.statusText;
               }
               
               throw new Error(`Failed to add location (${res.status}): ${errorMessage}`);
            }
         } catch (e: any) {
            console.error('[addLocation] Exception caught:', e);
            console.error('[addLocation] Error name:', e.name);
            console.error('[addLocation] Error message:', e.message);
            console.error('[addLocation] Error stack:', e.stack);
            throw e; // Re-throw so the UI can handle it
         }
      },
      
      updateLocation: async (id, location) => {
         try {
            const res = await fetch(`${API_URL}/locations/${id}`, {
               method: 'PUT',
               headers: await getAuthHeaders(),
               body: JSON.stringify(location)
            });
            if (res.ok) {
               const updated = await res.json();
               set((state) => ({
                  locations: state.locations.map(loc => loc.id === id ? updated : loc)
               }));
            }
         } catch (e) {
            console.error('Failed to update location', e);
         }
      },
      
      deleteLocation: async (id) => {
         try {
            const res = await fetch(`${API_URL}/locations/${id}`, {
               method: 'DELETE',
               headers: await getAuthHeaders(),
            });
            if (res.ok) {
               set((state) => ({
                  locations: state.locations.filter(loc => loc.id !== id)
               }));
            } else {
               const errorData = await res.json();
               throw new Error(errorData.error || 'Failed to delete location');
            }
         } catch (e: any) {
            console.error('Failed to delete location', e);
            throw e;
         }
      },
      
      toggleLocationModule: async (locationId, moduleId, isEnabled) => {
         const loc = get().locations.find(l => l.id === locationId);
         if (!loc) return;
         const current = loc.enabledModules || [];
         const newModules = isEnabled
           ? [...current, moduleId]
           : current.filter(id => id !== moduleId);
         
         await get().updateLocation(locationId, { enabledModules: newModules });
      },
      
      toggleLocationStatus: async (id) => {
         const loc = get().locations.find(l => l.id === id);
         if (!loc) return;
         await get().updateLocation(id, { isActive: !loc.isActive });
      },
      
      logAction: (action, details, user) =>
        set((state) => ({
          auditLog: [
            {
              id: Math.random().toString(36).substring(7),
              timestamp: new Date().toISOString(),
              user,
              action,
              details,
            },
            ...state.auditLog,
          ],
        })),
    }),
    {
      name: 'mdc-settings-storage',
    }
  )
);