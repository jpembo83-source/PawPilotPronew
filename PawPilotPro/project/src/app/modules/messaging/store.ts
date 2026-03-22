import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  MessageThread, 
  Message, 
  MessageTemplate, 
  MessageFilters,
  ContactConsent
} from './types';

interface MessagingState {
  // Threads
  threads: MessageThread[];
  selectedThread: MessageThread | null;
  threadMessages: Record<string, Message[]>; // threadId -> messages[]
  
  // Filters
  filters: MessageFilters;
  
  // Templates
  templates: MessageTemplate[];
  
  // Consent records
  consentRecords: Record<string, ContactConsent>; // contactId -> consent
  
  // UI state
  isLoading: boolean;
  isSendingMessage: boolean;
  showComposeModal: boolean;
  
  // Stats
  stats: {
    total: number;
    unread: number;
    awaitingResponse: number;
    slaBreached: number;
  };
  
  // Actions - Threads
  setThreads: (threads: MessageThread[]) => void;
  addThread: (thread: MessageThread) => void;
  updateThread: (threadId: string, updates: Partial<MessageThread>) => void;
  selectThread: (thread: MessageThread | null) => void;
  
  // Actions - Messages
  setThreadMessages: (threadId: string, messages: Message[]) => void;
  addMessage: (threadId: string, message: Message) => void;
  updateMessage: (threadId: string, messageId: string, updates: Partial<Message>) => void;
  
  // Actions - Filters
  setFilters: (filters: Partial<MessageFilters>) => void;
  clearFilters: () => void;
  
  // Actions - Templates
  setTemplates: (templates: MessageTemplate[]) => void;
  addTemplate: (template: MessageTemplate) => void;
  updateTemplate: (templateId: string, updates: Partial<MessageTemplate>) => void;
  
  // Actions - Consent
  setConsent: (contactId: string, consent: ContactConsent) => void;
  
  // Actions - UI
  setLoading: (isLoading: boolean) => void;
  setSendingMessage: (isSending: boolean) => void;
  setShowComposeModal: (show: boolean) => void;
  
  // Actions - Stats
  setStats: (stats: Partial<MessagingState['stats']>) => void;
  
  // Actions - Utility
  reset: () => void;
}

const initialState = {
  threads: [],
  selectedThread: null,
  threadMessages: {},
  filters: {},
  templates: [],
  consentRecords: {},
  isLoading: false,
  isSendingMessage: false,
  showComposeModal: false,
  stats: {
    total: 0,
    unread: 0,
    awaitingResponse: 0,
    slaBreached: 0
  }
};

export const useMessagingStore = create<MessagingState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Threads
      setThreads: (threads) => set({ threads }),
      
      addThread: (thread) => set((state) => ({
        threads: [thread, ...state.threads]
      })),
      
      updateThread: (threadId, updates) => set((state) => ({
        threads: state.threads.map(t => 
          t.id === threadId ? { ...t, ...updates } : t
        ),
        selectedThread: state.selectedThread?.id === threadId 
          ? { ...state.selectedThread, ...updates }
          : state.selectedThread
      })),
      
      selectThread: (thread) => set({ selectedThread: thread }),
      
      // Messages
      setThreadMessages: (threadId, messages) => set((state) => ({
        threadMessages: {
          ...state.threadMessages,
          [threadId]: messages
        }
      })),
      
      addMessage: (threadId, message) => set((state) => {
        const existingMessages = state.threadMessages[threadId] || [];
        return {
          threadMessages: {
            ...state.threadMessages,
            [threadId]: [...existingMessages, message]
          }
        };
      }),
      
      updateMessage: (threadId, messageId, updates) => set((state) => ({
        threadMessages: {
          ...state.threadMessages,
          [threadId]: (state.threadMessages[threadId] || []).map(m =>
            m.id === messageId ? { ...m, ...updates } : m
          )
        }
      })),
      
      // Filters
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),
      
      clearFilters: () => set({ filters: {} }),
      
      // Templates
      setTemplates: (templates) => set({ templates }),
      
      addTemplate: (template) => set((state) => ({
        templates: [...state.templates, template]
      })),
      
      updateTemplate: (templateId, updates) => set((state) => ({
        templates: state.templates.map(t =>
          t.id === templateId ? { ...t, ...updates } : t
        )
      })),
      
      // Consent
      setConsent: (contactId, consent) => set((state) => ({
        consentRecords: {
          ...state.consentRecords,
          [contactId]: consent
        }
      })),
      
      // UI
      setLoading: (isLoading) => set({ isLoading }),
      setSendingMessage: (isSendingMessage) => set({ isSendingMessage }),
      setShowComposeModal: (showComposeModal) => set({ showComposeModal }),
      
      // Stats
      setStats: (stats) => set((state) => ({
        stats: { ...state.stats, ...stats }
      })),
      
      // Reset
      reset: () => set(initialState)
    }),
    {
      name: 'messaging-storage',
      partialize: (state) => ({
        filters: state.filters,
        // Don't persist threads/messages - always fetch fresh
      })
    }
  )
);
