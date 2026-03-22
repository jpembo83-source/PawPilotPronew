import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

export interface Dog {
  id: string;
  name: string;
  breed: string;
  size: 'small' | 'large';
  ownerId: string;
  notes: string;
  vaccinations: {
    name: string;
    expiryDate: string;
  }[];
  alerts: string[]; // 'aggressive', 'medication', etc.
  photoUrl?: string;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Booking {
  id: string;
  dogId: string;
  locationId: string; // Add this
  date: string;
  type: 'daycare' | 'grooming';
  status: 'booked' | 'checked-in' | 'completed' | 'cancelled';
  checkInTime?: string;
  checkOutTime?: string;
  roomId?: string;
}

// Helper for API calls
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
        const errorBody = await res.text();
        if (errorBody) {
          errorMessage += ` - ${errorBody}`;
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }
    
    return res.json();
  } catch (error: any) {
    // Re-throw with more context if it's a network error
    if (error.message.includes('fetch')) {
      throw new Error(`Network error: Unable to reach API at ${path}`);
    }
    throw error;
  }
};

export const api = {
  getOwners: async () => {
    return fetchApi('/owners');
  },
  getDogs: async () => {
    return fetchApi('/dogs');
  },
  getBookings: async (date: string) => {
    const bookings = await fetchApi('/bookings');
    // Filter client-side for now as KV doesn't support complex queries
    return bookings.filter((b: Booking) => b.date === date);
  },
  checkIn: async (bookingId: string) => {
    const update = {
      status: 'checked-in',
      checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    return fetchApi(`/bookings/${bookingId}`, {
      method: 'PUT',
      body: JSON.stringify(update)
    });
  }
};