// Re-export all types from store for convenience
export type {
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  IncidentModule,
  Incident,
  IncidentPerson,
  IncidentAction,
  IncidentNote,
  IncidentAttachment,
  IncidentAuditLog,
  IncidentStats,
  IncidentFilters,
} from './store';

// Category labels
export const INCIDENT_CATEGORIES: Record<string, string> = {
  injury_dog: 'Injury (Dog)',
  injury_human: 'Injury (Human/Staff)',
  behaviour: 'Behaviour / Aggression',
  escape: 'Escape / Lost Dog',
  illness: 'Illness / Medical Concern',
  property_damage: 'Property Damage',
  transport: 'Transport Incident',
  overnight: 'Overnight Welfare Issue',
  complaint: 'Customer Complaint',
  near_miss: 'Near Miss (Safety)',
  other: 'Other',
};

// Severity labels and colors
export const INCIDENT_SEVERITIES: Record<string, { label: string; color: string; bgColor: string }> = {
  low: {
    label: 'Low',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  medium: {
    label: 'Medium',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  high: {
    label: 'High',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
  critical: {
    label: 'Critical',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
};

// Status labels and colors
export const INCIDENT_STATUSES: Record<string, { label: string; color: string; bgColor: string }> = {
  new: {
    label: 'New',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
  },
  in_review: {
    label: 'In Review',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
  action_required: {
    label: 'Action Required',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
  awaiting_customer: {
    label: 'Awaiting Customer',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
  },
  resolved: {
    label: 'Resolved',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  closed: {
    label: 'Closed',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
  },
  reopened: {
    label: 'Reopened',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  },
};

// Module labels
export const INCIDENT_MODULES: Record<string, string> = {
  daycare: 'Daycare',
  grooming: 'Grooming/Spa',
  boutique: 'Boutique',
  transport: 'Transportation',
  overnights: 'Overnights',
};

// Root cause categories
export const ROOT_CAUSES = [
  'Equipment failure',
  'Human error',
  'Inadequate training',
  'Inadequate supervision',
  'Environmental factors',
  'Animal behaviour',
  'Process failure',
  'Communication breakdown',
  'External factors',
  'Other',
];
