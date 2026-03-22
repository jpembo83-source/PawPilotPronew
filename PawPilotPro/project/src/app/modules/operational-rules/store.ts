import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  OperationalRule,
  RuleAudit,
  RuleTemplate,
  RulesFilters,
  RuleBuilderState,
  LocationOverrideConfig
} from './types';

interface OperationalRulesState {
  // Rules
  rules: OperationalRule[];
  selectedRule: OperationalRule | null;
  
  // Filters
  filters: RulesFilters;
  
  // Templates
  templates: RuleTemplate[];
  
  // Audit log
  auditLog: RuleAudit[];
  
  // Location overrides
  overrideConfigs: LocationOverrideConfig[];
  
  // Rule builder
  builderState: RuleBuilderState;
  isBuilderOpen: boolean;
  
  // UI state
  isLoading: boolean;
  showAuditLog: boolean;
  
  // Actions - Rules
  setRules: (rules: OperationalRule[]) => void;
  addRule: (rule: OperationalRule) => void;
  updateRule: (ruleId: string, updates: Partial<OperationalRule>) => void;
  deleteRule: (ruleId: string) => void;
  selectRule: (rule: OperationalRule | null) => void;
  
  // Actions - Filters
  setFilters: (filters: Partial<RulesFilters>) => void;
  clearFilters: () => void;
  
  // Actions - Templates
  setTemplates: (templates: RuleTemplate[]) => void;
  
  // Actions - Audit
  setAuditLog: (log: RuleAudit[]) => void;
  addAuditEntry: (entry: RuleAudit) => void;
  
  // Actions - Overrides
  setOverrideConfigs: (configs: LocationOverrideConfig[]) => void;
  
  // Actions - Builder
  setBuilderState: (state: Partial<RuleBuilderState>) => void;
  resetBuilder: () => void;
  openBuilder: (template?: RuleTemplate) => void;
  closeBuilder: () => void;
  nextBuilderStep: () => void;
  prevBuilderStep: () => void;
  
  // Actions - UI
  setLoading: (isLoading: boolean) => void;
  setShowAuditLog: (show: boolean) => void;
  
  // Actions - Utility
  reset: () => void;
}

const initialBuilderState: RuleBuilderState = {
  step: 1,
  conditions: [],
  actions: [],
  priority: 100
};

const initialState = {
  rules: [],
  selectedRule: null,
  filters: {},
  templates: [],
  auditLog: [],
  overrideConfigs: [],
  builderState: initialBuilderState,
  isBuilderOpen: false,
  isLoading: false,
  showAuditLog: false
};

export const useOperationalRulesStore = create<OperationalRulesState>()(
  persist(
    (set, get) => ({
      ...initialState,
      
      // Rules
      setRules: (rules) => set({ rules }),
      
      addRule: (rule) => set((state) => ({
        rules: [rule, ...state.rules]
      })),
      
      updateRule: (ruleId, updates) => set((state) => ({
        rules: state.rules.map(r =>
          r.id === ruleId ? { ...r, ...updates } : r
        ),
        selectedRule: state.selectedRule?.id === ruleId
          ? { ...state.selectedRule, ...updates }
          : state.selectedRule
      })),
      
      deleteRule: (ruleId) => set((state) => ({
        rules: state.rules.filter(r => r.id !== ruleId),
        selectedRule: state.selectedRule?.id === ruleId ? null : state.selectedRule
      })),
      
      selectRule: (rule) => set({ selectedRule: rule }),
      
      // Filters
      setFilters: (filters) => set((state) => ({
        filters: { ...state.filters, ...filters }
      })),
      
      clearFilters: () => set({ filters: {} }),
      
      // Templates
      setTemplates: (templates) => set({ templates }),
      
      // Audit
      setAuditLog: (auditLog) => set({ auditLog }),
      
      addAuditEntry: (entry) => set((state) => ({
        auditLog: [entry, ...state.auditLog]
      })),
      
      // Overrides
      setOverrideConfigs: (overrideConfigs) => set({ overrideConfigs }),
      
      // Builder
      setBuilderState: (updates) => set((state) => ({
        builderState: { ...state.builderState, ...updates }
      })),
      
      resetBuilder: () => set({ builderState: initialBuilderState }),
      
      openBuilder: (template) => {
        if (template) {
          // Pre-populate from template
          set({
            isBuilderOpen: true,
            builderState: {
              step: 1,
              module: template.module,
              category: template.category,
              type: template.type,
              event: template.event,
              conditions: template.conditionTemplates.map((ct, idx) => ({
                id: `cond_${idx}`,
                ...ct
              })),
              actions: template.actionTemplates.map((at, idx) => ({
                id: `act_${idx}`,
                ...at
              })),
              priority: 100
            }
          });
        } else {
          set({
            isBuilderOpen: true,
            builderState: initialBuilderState
          });
        }
      },
      
      closeBuilder: () => set({
        isBuilderOpen: false,
        builderState: initialBuilderState
      }),
      
      nextBuilderStep: () => set((state) => ({
        builderState: {
          ...state.builderState,
          step: Math.min(state.builderState.step + 1, 7)
        }
      })),
      
      prevBuilderStep: () => set((state) => ({
        builderState: {
          ...state.builderState,
          step: Math.max(state.builderState.step - 1, 1)
        }
      })),
      
      // UI
      setLoading: (isLoading) => set({ isLoading }),
      setShowAuditLog: (showAuditLog) => set({ showAuditLog }),
      
      // Reset
      reset: () => set(initialState)
    }),
    {
      name: 'operational-rules-storage',
      partialize: (state) => ({
        filters: state.filters
        // Don't persist rules - always fetch fresh
      })
    }
  )
);
