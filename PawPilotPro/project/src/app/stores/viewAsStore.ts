// View As Store - MDC Operations Centre
// Zustand store for View As state management

import { create } from 'zustand';
import type { ViewAsSession, ViewAsUser } from '../modules/view-as/types';

interface ViewAsState {
  session: ViewAsSession | null;
  targetUser: ViewAsUser | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setSession: (session: ViewAsSession | null) => void;
  setTargetUser: (user: ViewAsUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useViewAsStore = create<ViewAsState>((set) => ({
  session: null,
  targetUser: null,
  isLoading: false,
  error: null,
  
  setSession: (session) => set({ session }),
  setTargetUser: (user) => set({ targetUser: user }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  reset: () => set({ session: null, targetUser: null, isLoading: false, error: null }),
}));
