// ============================================================================
// SERVICES & PRICING - TYPE DEFINITIONS
// ============================================================================

export type ModuleType = 'daycare' | 'grooming' | 'boutique' | 'transport';

export type ServicePricingUnit = 'fixed' | 'per_hour' | 'per_day' | 'per_month';

export type ServiceType = 
  // Daycare
  | 'daycare_hourly'
  | 'daycare_half_day'
  | 'daycare_full_day'
  | 'daycare_overnight'
  // Grooming/Spa
  | 'grooming_fixed'
  | 'grooming_hourly'
  | 'grooming_addon'
  // Boutique
  | 'boutique_product'
  // Transport
  | 'transport_trip';

export type TaxCategory = 'standard' | 'reduced' | 'exempt';

// ============================================================================
// LAYER 1: SERVICE CATALOGUE
// ============================================================================

export interface Service {
  id: string;
  module: ModuleType;
  type: ServiceType;
  name: string;
  description?: string;
  isActive: boolean;
  isBillable: boolean;
  
  // Operational attributes
  durationMinutes?: number; // For grooming services
  bufferMinutes?: number; // For grooming services (cleanup/prep)
  capacityImpact?: number; // For daycare (how many "slots" this uses)
  
  // Frequency-based pricing support (for daycare)
  frequencyTiers?: FrequencyTier[];
  
  // Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FrequencyTier {
  id: string;
  minDaysPerWeek: number;
  maxDaysPerWeek: number;
  label: string; // e.g., "1-2 days per week"
}

// ============================================================================
// LAYER 2: PRICE BOOKS
// ============================================================================

export interface PriceBook {
  id: string;
  name: string;
  description?: string;
  currency: string; // ISO 4217 (e.g., "CHF", "EUR")
  effectiveFrom: string; // ISO date
  effectiveTo?: string; // ISO date (null = active indefinitely)
  isActive: boolean;
  
  // Scope
  isOrganisationWide: boolean;
  locationIds: string[]; // Empty if org-wide
  
  // Entries
  entries: PriceBookEntry[];
  
  // Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface PriceBookEntry {
  id: string;
  serviceId: string;
  frequencyTierId?: string; // For daycare frequency pricing
  
  basePrice: number;
  unit: ServicePricingUnit;
  taxCategory: TaxCategory;
  taxRate: number; // e.g., 0.077 for 7.7% VAT in Switzerland
  
  // Optional modifiers
  minQuantity?: number;
  maxQuantity?: number;
}

// ============================================================================
// LAYER 3: LOCATION OVERRIDES
// ============================================================================

export interface LocationPriceOverride {
  id: string;
  locationId: string;
  serviceId: string;
  frequencyTierId?: string;
  
  overridePrice: number;
  reason?: string;
  
  // Audit
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
}

// ============================================================================
// LAYER 4: COMMERCIAL MODIFIERS
// ============================================================================

// MEMBERSHIPS / SUBSCRIPTIONS
export interface MembershipPlan {
  id: string;
  module: ModuleType;
  name: string;
  displayName: string; // e.g., "Split my social"
  description?: string;
  
  monthlyPrice: number;
  currency: string;
  
  // Access/Credits
  accessType: 'credits' | 'unlimited';
  creditsPerMonth?: number;
  creditUnit?: 'half_day' | 'full_day' | 'hour'; // What each credit represents
  
  // Service restrictions
  allowedServiceIds: string[]; // Which services can be consumed
  
  // Multi-dog support
  allowsMultipleDogs: boolean;
  
  // Operational
  isActive: boolean;
  requiresContract: boolean;
  minimumTermMonths?: number;
  allowPause: boolean;
  allowProration: boolean;
  
  // Metadata
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// MULTI-DOG DISCOUNT RULES
export interface MultiDogRule {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  
  // e.g., "Second dog gets 50% off"
  applicableDogPosition: number; // 2 = second dog, 3 = third dog
  discountValue: number; // 50 (percentage) or fixed amount
  
  // Which memberships does this apply to?
  applicableMembershipIds: string[];
  
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

// PACKAGES (Bundle multiple services)
export interface ServicePackage {
  id: string;
  name: string;
  description?: string;
  module: ModuleType;
  
  packagePrice: number;
  currency: string;
  
  // Bundle contents
  includedServices: PackageServiceItem[];
  
  validFrom: string;
  validTo?: string;
  isActive: boolean;
  
  createdAt: string;
  createdBy: string;
}

export interface PackageServiceItem {
  serviceId: string;
  quantity: number;
  unit: 'sessions' | 'hours' | 'days';
}

// FEES & PENALTIES
export interface FeeRule {
  id: string;
  name: string;
  type: 'late_pickup' | 'cancellation' | 'no_show' | 'early_dropoff' | 'custom';
  
  amount: number;
  unit: 'fixed' | 'per_hour' | 'per_day' | 'percentage_of_booking';
  
  // Conditions
  triggerCondition?: string; // e.g., ">15 minutes late"
  graceMinutes?: number;
  
  // Waivers
  canBeWaived: boolean;
  waiverRequiresPermission?: string; // Permission ID
  
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

// DISCOUNTS
export interface DiscountRule {
  id: string;
  name: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  
  // Applicability
  applicableModules: ModuleType[];
  applicableServiceIds?: string[];
  
  // Conditions
  requiresCode?: string;
  minBookingAmount?: number;
  maxDiscountAmount?: number;
  
  // Time restrictions
  validFrom: string;
  validTo?: string;
  
  isActive: boolean;
  requiresApproval: boolean;
  
  createdAt: string;
  createdBy: string;
}

// ============================================================================
// RESOLVED PRICING (For Bookings)
// ============================================================================

export interface ResolvedLineItem {
  id: string;
  serviceId: string;
  serviceName: string;
  
  basePrice: number;
  quantity: number;
  unit: ServicePricingUnit;
  
  // Applied modifiers
  membershipCreditUsed?: number;
  discountsApplied?: AppliedDiscount[];
  feesApplied?: AppliedFee[];
  
  subtotal: number; // Before tax
  taxAmount: number;
  total: number; // After tax
  
  // Lock pricing at booking time
  priceLockedAt: string;
  priceBookId: string;
  locationId: string;
}

export interface AppliedDiscount {
  discountId: string;
  discountName: string;
  amount: number;
}

export interface AppliedFee {
  feeId: string;
  feeName: string;
  amount: number;
  waived?: boolean;
  waivedBy?: string;
  waivedReason?: string;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface PriceResolutionRequest {
  serviceId: string;
  locationId: string;
  frequencyTierId?: string;
  quantity: number;
  date: string; // Booking date (for effective price book lookup)
  membershipId?: string;
  discountCodes?: string[];
}

export interface PriceResolutionResponse {
  lineItem: ResolvedLineItem;
  availableCredits?: number;
  creditsAfterBooking?: number;
}
