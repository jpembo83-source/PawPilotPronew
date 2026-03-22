// ============================================================================
// PRICING APPROVALS - TYPE DEFINITIONS
// ============================================================================

export type ApprovalStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'active' | 'superseded';

export type ApprovalType = 
  | 'price_book'
  | 'location_override'
  | 'membership_plan'
  | 'service_definition';

// ============================================================================
// PRICE BOOK VERSIONS (WITH APPROVAL WORKFLOW)
// ============================================================================

export interface PriceBookVersion {
  id: string;
  priceBookId: string;
  
  version: number;
  status: ApprovalStatus;
  
  // Effective dates
  effectiveFrom: string;
  effectiveTo?: string;
  
  // Approval workflow
  submittedForApprovalAt?: string;
  submittedBy?: string;
  
  approvedAt?: string;
  approvedBy?: string;
  approvalComment?: string;
  
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// ============================================================================
// LOCATION PRICE OVERRIDE PROPOSALS
// ============================================================================

export interface LocationPriceOverrideProposal {
  id: string;
  
  locationId: string;
  serviceId: string;
  
  // Pricing
  currentPrice: number;
  proposedPrice: number;
  currency: string;
  
  // Effective dates
  effectiveFrom: string;
  effectiveTo?: string;
  
  // Justification (required)
  justification: string;
  
  // Status
  status: ApprovalStatus;
  
  // Workflow
  proposedBy: string;
  proposedAt: string;
  
  approvedBy?: string;
  approvedAt?: string;
  approvalComment?: string;
  
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// MEMBERSHIP PLAN VERSIONS
// ============================================================================

export interface MembershipPlanVersion {
  id: string;
  membershipPlanId: string;
  
  version: number;
  status: ApprovalStatus;
  
  // Pricing
  monthlyPrice: number;
  currency: string;
  
  // Benefits
  benefits: MembershipBenefit[];
  
  // Activation strategy
  activationStrategy: 'new_subscribers_only' | 'existing_at_renewal' | 'manual_migration';
  
  // Effective dates
  effectiveFrom: string;
  effectiveTo?: string;
  
  // Approval workflow
  proposedBy: string;
  proposedAt: string;
  
  approvedBy?: string;
  approvedAt?: string;
  approvalComment?: string;
  
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  
  // Audit
  createdAt: string;
  updatedAt: string;
}

export interface MembershipBenefit {
  serviceType: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  description: string;
}

// ============================================================================
// APPROVAL RECORDS (UNIFIED)
// ============================================================================

export interface Approval {
  id: string;
  
  type: ApprovalType;
  referenceId: string; // ID of the thing being approved
  
  // Proposer
  proposedBy: string;
  proposedAt: string;
  proposalData: Record<string, any>;
  
  // Approver
  status: ApprovalStatus;
  
  approvedBy?: string;
  approvedAt?: string;
  approvalComment?: string;
  
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  
  // Metadata
  impactPreview?: ImpactPreview;
  
  // Audit
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// IMPACT PREVIEW (MANDATORY BEFORE APPROVAL)
// ============================================================================

export interface ImpactPreview {
  // Services affected
  servicesAffected: ServiceImpact[];
  
  // Locations affected
  locationsAffected: string[];
  
  // Effective date
  effectiveDate: string;
  
  // Upcoming bookings impacted
  upcomingBookingsImpacted: number;
  draftBookingsImpacted: number;
  
  // Summary
  totalPriceChanges: number;
  averagePriceChange: number; // percentage
  maxPriceIncrease: number;
  maxPriceDecrease: number;
  
  // Generated at
  generatedAt: string;
}

export interface ServiceImpact {
  serviceId: string;
  serviceName: string;
  
  oldPrice: number;
  newPrice: number;
  priceChange: number; // absolute
  priceChangePercent: number;
  
  locationsAffected: string[];
}

// ============================================================================
// AUDIT LOG (PRICING-SPECIFIC)
// ============================================================================

export interface PricingAuditLog {
  id: string;
  
  action: PricingAuditAction;
  entityType: 'price_book' | 'price_book_entry' | 'location_override' | 'membership_plan';
  entityId: string;
  
  // Who & When
  performedBy: string;
  performedAt: string;
  
  // What changed
  beforeValue?: any;
  afterValue?: any;
  
  // Context
  scope: 'organisation' | 'location';
  locationId?: string;
  
  reason?: string;
  comment?: string;
  
  // Metadata
  metadata?: Record<string, any>;
}

export type PricingAuditAction =
  | 'price_book_created'
  | 'price_book_submitted'
  | 'price_book_approved'
  | 'price_book_rejected'
  | 'price_book_activated'
  | 'price_book_superseded'
  | 'price_entry_updated'
  | 'location_override_proposed'
  | 'location_override_approved'
  | 'location_override_rejected'
  | 'location_override_activated'
  | 'membership_plan_proposed'
  | 'membership_plan_approved'
  | 'membership_plan_rejected'
  | 'emergency_override';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface SubmitPriceBookRequest {
  priceBookVersionId: string;
  comment?: string;
}

export interface ApprovePriceBookRequest {
  priceBookVersionId: string;
  approvalComment?: string;
  activateImmediately: boolean;
  scheduledActivationDate?: string;
}

export interface RejectPriceBookRequest {
  priceBookVersionId: string;
  rejectionReason: string;
}

export interface ProposeLocationOverrideRequest {
  locationId: string;
  serviceId: string;
  proposedPrice: number;
  effectiveFrom: string;
  effectiveTo?: string;
  justification: string;
}

export interface ApproveLocationOverrideRequest {
  proposalId: string;
  approvalComment?: string;
}

export interface RejectLocationOverrideRequest {
  proposalId: string;
  rejectionReason: string;
}

export interface GenerateImpactPreviewRequest {
  type: ApprovalType;
  referenceId: string;
  proposedChanges: Record<string, any>;
}
