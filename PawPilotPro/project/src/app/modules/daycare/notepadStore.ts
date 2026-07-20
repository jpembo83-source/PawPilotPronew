// Paper-notepad booking ingest — client store.
// Talks to /daycare-notepad (see supabase/functions/server/daycare_notepad_routes.tsx).

import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import { broadcastMutation } from '../../lib/realtimeBroadcast';
import type { DaycareSession } from './lib/multiDayBooking';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/daycare-notepad`;

export interface NotepadPage {
  id: string;
  location_id: string;
  photo_path: string;
  photo_url?: string;
  week_start: string;
  status: 'uploaded' | 'parsing' | 'parsed' | 'parse_failed' | 'discarded';
  parse_error?: string;
  uploaded_by_name: string;
  uploaded_at: string;
  draft_counts?: { ready: number; needs_review: number; confirmed: number; discarded: number };
}

export interface NotepadDraftCandidate {
  pet_id: string;
  pet_name: string;
  household_id?: string;
  score: number;
}

export interface NotepadDraft {
  id: string;
  page_id: string;
  location_id: string;
  dog_name_as_written: string;
  date?: string;
  session: DaycareSession;
  parse_confidence: number;
  match_confidence: number;
  matched_pet_id?: string;
  matched_pet_name?: string;
  matched_household_id?: string;
  candidates: NotepadDraftCandidate[];
  status: 'ready' | 'needs_review' | 'confirmed' | 'discarded';
  review_reasons: string[];
  booking_id?: string;
  y_top?: number;
  y_bottom?: number;
}

export interface RosterCandidate {
  pet_id: string;
  pet_name: string;
  household_id: string | null;
  photo_url: string | null;
}

interface ApiErrorBody {
  error?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    throw new Error(body.error || 'Request failed');
  }
  return (await response.json()) as T;
}

interface NotepadState {
  pages: NotepadPage[];
  drafts: Record<string, NotepadDraft[]>; // keyed by page id
  isLoading: boolean;
  error: string | null;

  fetchPages: () => Promise<void>;
  fetchPage: (pageId: string) => Promise<void>;
  uploadPages: (
    files: File[],
    locationId: string,
    weekStart?: string,
  ) => Promise<{ pages: NotepadPage[]; failed: Array<{ name: string; error: string }> }>;
  parsePage: (pageId: string) => Promise<NotepadDraft[]>;
  updateDraft: (
    pageId: string,
    draftId: string,
    patch: { pet_id?: string | null; session?: DaycareSession; date?: string; status?: 'discarded' },
  ) => Promise<NotepadDraft>;
  confirmDraft: (pageId: string, draftId: string) => Promise<NotepadDraft>;
  confirmAll: (
    pageId: string,
  ) => Promise<{ confirmed: number; failures: Array<{ draft_id: string; dog_name_as_written: string; error: string }> }>;
  discardPage: (pageId: string) => Promise<void>;
  searchCandidates: (query: string) => Promise<RosterCandidate[]>;
  clearError: () => void;
}

export const useNotepadStore = create<NotepadState>((set) => ({
  pages: [],
  drafts: {},
  isLoading: false,
  error: null,

  fetchPages: async () => {
    set({ isLoading: true, error: null });
    try {
      const { pages } = await request<{ pages: NotepadPage[] }>('/pages');
      set({ pages, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },

  fetchPage: async (pageId) => {
    try {
      const { page, drafts } = await request<{ page: NotepadPage; drafts: NotepadDraft[] }>(
        `/pages/${pageId}`,
      );
      set((state) => ({
        pages: state.pages.some((p) => p.id === pageId)
          ? state.pages.map((p) => (p.id === pageId ? { ...p, ...page } : p))
          : [page, ...state.pages],
        drafts: { ...state.drafts, [pageId]: drafts },
      }));
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },

  uploadPages: async (files, locationId, weekStart) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append('location_id', locationId);
      if (weekStart) formData.append('week_start', weekStart);
      for (const file of files) formData.append('files', file);

      // getAuthHeaders sets Content-Type: application/json — strip it so the
      // browser writes the multipart boundary itself.
      const headers = await getAuthHeaders();
      delete headers['Content-Type'];

      const response = await fetch(`${BASE_URL}/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
        throw new Error(body.error || 'Upload failed');
      }
      const result = (await response.json()) as {
        pages: NotepadPage[];
        failed: Array<{ name: string; error: string }>;
      };
      set((state) => ({ pages: [...result.pages, ...state.pages], isLoading: false }));
      return result;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  parsePage: async (pageId) => {
    set((state) => ({
      pages: state.pages.map((p) => (p.id === pageId ? { ...p, status: 'parsing' } : p)),
      error: null,
    }));
    try {
      const { page, drafts } = await request<{ page: NotepadPage; drafts: NotepadDraft[] }>(
        `/pages/${pageId}/parse`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      set((state) => ({
        pages: state.pages.map((p) => (p.id === pageId ? { ...p, ...page } : p)),
        drafts: { ...state.drafts, [pageId]: drafts },
      }));
      return drafts;
    } catch (error) {
      set((state) => ({
        pages: state.pages.map((p) => (p.id === pageId ? { ...p, status: 'parse_failed' } : p)),
        error: (error as Error).message,
      }));
      throw error;
    }
  },

  updateDraft: async (pageId, draftId, patch) => {
    const { draft } = await request<{ draft: NotepadDraft }>(
      `/pages/${pageId}/drafts/${draftId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    );
    set((state) => ({
      drafts: {
        ...state.drafts,
        [pageId]: (state.drafts[pageId] ?? []).map((d) => (d.id === draftId ? draft : d)),
      },
    }));
    return draft;
  },

  confirmDraft: async (pageId, draftId) => {
    const { draft } = await request<{ draft: NotepadDraft }>(
      `/pages/${pageId}/drafts/${draftId}/confirm`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    set((state) => ({
      drafts: {
        ...state.drafts,
        [pageId]: (state.drafts[pageId] ?? []).map((d) => (d.id === draftId ? draft : d)),
      },
    }));
    void broadcastMutation('daycare', 'booking', 'created', draft.booking_id ?? draftId, undefined, draft.location_id);
    return draft;
  },

  confirmAll: async (pageId) => {
    const result = await request<{
      confirmed: number;
      failures: Array<{ draft_id: string; dog_name_as_written: string; error: string }>;
      drafts: NotepadDraft[];
    }>(`/pages/${pageId}/confirm-all`, { method: 'POST', body: JSON.stringify({}) });
    set((state) => ({ drafts: { ...state.drafts, [pageId]: result.drafts } }));
    if (result.confirmed > 0) {
      void broadcastMutation('daycare', 'booking', 'created', `notepad-${pageId}`);
    }
    return result;
  },

  discardPage: async (pageId) => {
    await request(`/pages/${pageId}/discard`, { method: 'POST', body: JSON.stringify({}) });
    set((state) => ({
      pages: state.pages.filter((p) => p.id !== pageId),
      drafts: { ...state.drafts, [pageId]: [] },
    }));
  },

  searchCandidates: async (query) => {
    const { candidates } = await request<{ candidates: RosterCandidate[] }>(
      `/candidates?q=${encodeURIComponent(query)}`,
    );
    return candidates;
  },

  clearError: () => set({ error: null }),
}));
