// Communications Settings Module Types - MDC Operations Centre

export type CommunicationChannel = 'email' | 'sms' | 'whatsapp';

export type ChannelStatus = 'active' | 'misconfigured' | 'disabled';

export type TemplateStatus = 'draft' | 'active' | 'archived';

export type AutomationStatus = 'active' | 'paused' | 'disabled';

export type MessageEventType =
  | 'daycare.check_in'
  | 'daycare.check_out'
  | 'grooming.completed'
  | 'grooming.ready_for_pickup'
  | 'overnight.update'
  | 'overnight.check_in'
  | 'overnight.check_out'
  | 'transport.pickup'
  | 'transport.dropoff'
  | 'transport.delayed'
  | 'document.expiring'
  | 'document.expired'
  | 'booking.confirmed'
  | 'booking.reminder'
  | 'booking.cancelled'
  | 'invoice.created'
  | 'payment.received';

export type ConsentType = 'operational' | 'informational' | 'promotional';

// Channel Configuration
export interface ChannelConfig {
  id: string;
  channel: CommunicationChannel;
  
  // Status
  isEnabled: boolean;
  status: ChannelStatus;
  
  // Configuration
  organisationEnabled: boolean;
  locationConfigs: LocationChannelConfig[];
  
  // Provider settings (metadata)
  providerName?: string;
  providerStatus?: string;
  
  // Audit
  lastUpdatedAt: string;
  lastUpdatedBy: string;
  lastUpdatedByName: string;
}

// Location-specific channel configuration
export interface LocationChannelConfig {
  locationId: string;
  locationName: string;
  isEnabled: boolean;
  senderIdentity?: SenderIdentity;
  lastUpdated: string;
}

// Sender Identity
export interface SenderIdentity {
  id: string;
  
  // Scope
  scope: 'organisation' | 'location';
  scopeId: string; // 'ORG' or locationId
  scopeName: string;
  
  // Channel-specific settings
  email?: {
    senderName: string;
    senderEmail: string;
    replyToEmail?: string;
  };
  sms?: {
    senderId: string; // Phone number or alphanumeric
    phoneNumber?: string;
  };
  whatsapp?: {
    phoneNumber: string;
    displayName?: string;
  };
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// Consent Policy
export interface ConsentPolicy {
  id: string;
  
  // Policy settings
  defaultOptIn: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  
  // Required consent per message type
  requiredConsent: {
    operational: boolean;   // Always true - cannot be disabled
    informational: boolean;
    promotional: boolean;
  };
  
  // Enforcement
  blockWhenConsentMissing: boolean; // Always true - cannot be disabled
  
  // Audit
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

// Message Template (extends messaging template with governance)
export interface CommunicationTemplate {
  id: string;
  
  // Identity
  name: string;
  description: string;
  module: string; // 'daycare', 'grooming', 'overnights', 'transport', 'boutique'
  eventType: 'manual' | 'automated';
  
  // Content
  subject?: string; // For email
  body: string;
  
  // Variables
  variables: string[]; // e.g., ['petName', 'staffName', 'date', 'time']
  
  // Channel support
  channels: CommunicationChannel[];
  
  // Status
  status: TemplateStatus;
  
  // Permissions
  allowedRoles: string[]; // ['admin', 'manager', 'staff', 'driver']
  locationIds: string[]; // Empty = all locations
  
  // Usage tracking
  usageCount: number;
  lastUsedAt?: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

// Automation Rule
export interface AutomationRule {
  id: string;
  
  // Identity
  name: string;
  description: string;
  event: MessageEventType;
  module: string;
  
  // Configuration
  isEnabled: boolean;
  status: AutomationStatus;
  
  // Template & Channel
  templateId: string;
  templateName: string;
  channels: CommunicationChannel[];
  
  // Timing
  sendTiming: 'immediate' | 'delayed';
  delayMinutes?: number; // If delayed
  
  // Scope
  scope: 'organisation' | 'location';
  scopeId: string;
  scopeName: string;
  locationIds: string[]; // Applicable locations
  
  // Conditions (optional - for advanced filtering)
  conditions?: {
    field: string;
    operator: string;
    value: any;
  }[];
  
  // Consent enforcement
  respectConsent: boolean; // Always true
  
  // Statistics
  messagesSent: number;
  lastTriggeredAt?: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  
  disabledAt?: string;
  disabledBy?: string;
  disabledReason?: string;
}

// SLA Definition
export interface SLADefinition {
  id: string;
  
  // Identity
  name: string;
  description: string;
  
  // Scope
  scope: 'organisation' | 'location';
  scopeId: string;
  scopeName: string;
  
  // SLA settings
  responseTimeMinutes: number;
  
  // Business hours only?
  businessHoursOnly: boolean;
  businessHours?: {
    start: string; // e.g., '09:00'
    end: string;   // e.g., '17:00'
    days: number[]; // 0-6, Sunday = 0
  };
  
  // Channel-specific overrides
  channelOverrides?: {
    channel: CommunicationChannel;
    responseTimeMinutes: number;
  }[];
  
  // Priority
  priority: number; // Higher = evaluated first
  isDefault: boolean;
  
  // Status
  isActive: boolean;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// Communication Permission
export interface CommunicationPermission {
  id: string;
  
  // Role-based permissions
  role: string; // 'admin', 'manager', 'staff', 'driver', 'night_shift'
  
  // Basic permissions
  canSendMessages: boolean;
  canSendWithoutTemplate: boolean;
  
  // Channel permissions
  allowedChannels: CommunicationChannel[];
  
  // Module restrictions
  restrictedModules?: string[]; // Cannot send messages for these modules
  
  // Template restrictions
  templateRequired: boolean;
  allowedTemplateIds?: string[]; // If empty, can use any active template
  
  // Safeguards
  requiresApproval: boolean;
  approverRoles?: string[];
  
  // Location scope
  locationIds: string[]; // Empty = all locations
  
  // Audit
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
}

// Delivery Log
export interface CommunicationDeliveryLog {
  id: string;
  messageId: string;
  threadId?: string;
  
  // Message details
  channel: CommunicationChannel;
  recipientContactId: string;
  recipientName: string;
  
  // Template
  templateId?: string;
  templateName?: string;
  
  // Status
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  
  // Delivery tracking
  queuedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  
  // Error handling
  attempts: number;
  lastAttemptAt: string;
  failureReason?: string;
  providerResponse?: string;
  providerMessageId?: string;
  
  // Context
  locationId: string;
  householdId: string;
  module?: string;
  
  // Consent verification
  consentVerified: boolean;
  consentStatus?: string;
  
  // Sender
  sentBy: string;
  sentByName: string;
  
  // Metadata
  metadata?: Record<string, any>;
}

// Audit Log Entry
export interface CommunicationAuditLog {
  id: string;
  
  // What changed
  entityType: 'channel' | 'sender_identity' | 'consent_policy' | 'template' | 'automation' | 'sla' | 'permission';
  entityId: string;
  entityName: string;
  
  // Action
  action: 'created' | 'updated' | 'deleted' | 'enabled' | 'disabled' | 'archived';
  
  // Changes
  before?: Record<string, any>;
  after?: Record<string, any>;
  changedFields?: string[];
  
  // Actor
  performedBy: string;
  performedByName: string;
  performedAt: string;
  
  // Context
  reason?: string;
  ipAddress?: string;
  
  // Metadata
  metadata?: Record<string, any>;
}

// Template Builder State
export interface TemplateBuilderState {
  step: number;
  name?: string;
  description?: string;
  module?: string;
  eventType?: 'manual' | 'automated';
  subject?: string;
  body?: string;
  variables: string[];
  channels: CommunicationChannel[];
  allowedRoles: string[];
  locationIds: string[];
}

// Filters
export interface TemplateFilters {
  module?: string;
  eventType?: 'manual' | 'automated';
  status?: TemplateStatus;
  channel?: CommunicationChannel;
  search?: string;
}

export interface AutomationFilters {
  module?: string;
  status?: AutomationStatus;
  event?: MessageEventType;
  locationId?: string;
  search?: string;
}

export interface DeliveryLogFilters {
  channel?: CommunicationChannel;
  status?: string;
  locationId?: string;
  householdId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface AuditLogFilters {
  entityType?: string;
  action?: string;
  performedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// Statistics & Dashboard Data
export interface CommunicationStats {
  // Channel health
  channelHealth: {
    channel: CommunicationChannel;
    status: ChannelStatus;
    messagesLast24h: number;
    deliveryRate: number;
  }[];
  
  // Template usage
  topTemplates: {
    templateId: string;
    templateName: string;
    usageCount: number;
    lastUsed: string;
  }[];
  
  // Automation performance
  automationStats: {
    totalRules: number;
    activeRules: number;
    messagesSent24h: number;
    failureRate: number;
  };
  
  // SLA performance
  slaStats: {
    totalMessages: number;
    withinSLA: number;
    breachedSLA: number;
    averageResponseMinutes: number;
  };
  
  // Consent overview
  consentStats: {
    totalContacts: number;
    emailConsent: number;
    smsConsent: number;
    whatsappConsent: number;
  };
}

// Template Variable Definition
export interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  example: string;
  category: 'customer' | 'pet' | 'booking' | 'location' | 'staff' | 'system';
}

// Common template variables
export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: 'customerName', label: 'Customer Name', description: 'Primary contact name', example: 'Sarah Jones', category: 'customer' },
  { key: 'petName', label: 'Pet Name', description: 'Name of the pet', example: 'Max', category: 'pet' },
  { key: 'petBreed', label: 'Pet Breed', description: 'Breed of the pet', example: 'Golden Retriever', category: 'pet' },
  { key: 'locationName', label: 'Location Name', description: 'Branch/facility name', example: 'Downtown Branch', category: 'location' },
  { key: 'locationPhone', label: 'Location Phone', description: 'Location contact number', example: '(555) 123-4567', category: 'location' },
  { key: 'staffName', label: 'Staff Name', description: 'Name of staff member', example: 'Emily Smith', category: 'staff' },
  { key: 'date', label: 'Date', description: 'Current or booking date', example: '2025-01-15', category: 'system' },
  { key: 'time', label: 'Time', description: 'Current or booking time', example: '2:30 PM', category: 'system' },
  { key: 'bookingReference', label: 'Booking Reference', description: 'Booking ID/reference', example: 'BK-2025-0001', category: 'booking' },
  { key: 'checkInTime', label: 'Check-in Time', description: 'Time of check-in', example: '8:00 AM', category: 'booking' },
  { key: 'pickupTime', label: 'Pickup Time', description: 'Expected pickup time', example: '5:00 PM', category: 'booking' },
];
