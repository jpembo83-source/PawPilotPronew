// Messaging Module Types - MDC Operations Centre

export type MessageChannel = 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';

export type MessageStatus = 'draft' | 'sending' | 'sent' | 'delivered' | 'failed' | 'read';

export type MessageType = 'manual' | 'automated' | 'internal_note';

export type MessageCategory = 'operations' | 'communications' | 'safety' | 'admin';

// Context linking
export interface MessageContext {
  householdId: string;
  petId?: string;
  bookingId?: string;
  transportId?: string;
  incidentId?: string;
  invoiceId?: string;
  module?: string; // daycare, grooming, overnights, transport, etc.
}

// Individual message
export interface Message {
  id: string;
  threadId: string;
  
  // Content
  content: string;
  channel: MessageChannel;
  type: MessageType;
  
  // Sender
  senderId: string; // userId or 'system'
  senderName: string;
  senderType: 'staff' | 'system' | 'customer';
  
  // Recipient
  recipientContactId?: string; // if sent to customer
  recipientName?: string;
  
  // Status
  status: MessageStatus;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failureReason?: string;
  
  // Metadata
  templateId?: string;
  context: MessageContext;
  locationId: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  metadata?: Record<string, any>;
}

// Message thread (conversation)
export interface MessageThread {
  id: string;
  
  // Context
  householdId: string;
  householdName: string;
  context: MessageContext;
  
  // Participants
  customerContactIds: string[];
  staffUserIds: string[];
  
  // Thread metadata
  subject?: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageChannel: MessageChannel;
  
  // Status
  isUnread: boolean;
  awaitingResponse: boolean;
  slaBreached: boolean;
  slaDueAt?: string;
  
  // Flags
  isPinned: boolean;
  isArchived: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Location & module
  locationId: string;
  module?: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

// Message template
export interface MessageTemplate {
  id: string;
  
  // Identity
  name: string;
  description: string;
  category: MessageCategory;
  module?: string;
  
  // Content
  subject?: string; // for email
  body: string;
  
  // Variables supported
  variables: string[]; // e.g., ['petName', 'staffName', 'date', 'time', 'location']
  
  // Channel support
  channels: MessageChannel[];
  
  // Usage
  isAutomated: boolean; // used by automation
  isMandatory: boolean; // must be used for specific events
  
  // Permissions
  requiredPermission?: { module: string; action: string };
  allowedRoles?: string[];
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  
  // Status
  isActive: boolean;
}

// Contact consent
export interface ContactConsent {
  contactId: string;
  householdId: string;
  
  // Consent per channel
  emailConsent: boolean;
  smsConsent: boolean;
  whatsappConsent: boolean;
  pushConsent: boolean;
  
  // Metadata
  emailAddress?: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  
  // Audit
  lastUpdated: string;
  updatedBy: string;
  consentHistory: Array<{
    timestamp: string;
    channel: MessageChannel;
    consented: boolean;
    updatedBy: string;
  }>;
}

// Delivery log
export interface DeliveryLog {
  messageId: string;
  channel: MessageChannel;
  status: MessageStatus;
  attempts: number;
  lastAttemptAt: string;
  deliveredAt?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
}

// Inbox filters
export interface MessageFilters {
  locationId?: string;
  module?: string;
  channel?: MessageChannel;
  unreadOnly?: boolean;
  awaitingResponseOnly?: boolean;
  slaBreachedOnly?: boolean;
  householdId?: string;
  petId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// Compose message request
export interface ComposeMessageRequest {
  threadId?: string; // if replying to existing thread
  householdId: string;
  contactId: string;
  channel: MessageChannel;
  content: string;
  context: MessageContext;
  templateId?: string;
  locationId: string;
}

// SLA configuration
export interface SLAConfig {
  id: string;
  name: string;
  module?: string;
  responseTimeMinutes: number;
  applicableChannels: MessageChannel[];
  isActive: boolean;
}

// Template variable context (for rendering)
export interface TemplateVariableContext {
  petName?: string;
  customerName?: string;
  staffName?: string;
  locationName?: string;
  date?: string;
  time?: string;
  bookingReference?: string;
  [key: string]: string | undefined;
}
