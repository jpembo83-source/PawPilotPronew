export type ReservationStatus =
  | 'booked'
  | 'confirmed'
  | 'checked_in'
  | 'in_stay'
  | 'transitioning_to_daycare'
  | 'transitioning_from_daycare'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type SleepingAreaType = 'kennel' | 'suite' | 'shared_room' | 'outdoor_shelter';

export type OvernightEventType =
  | 'created'
  | 'checked_in'
  | 'transitioned_from_daycare'
  | 'assigned'
  | 'transitioned_to_daycare'
  | 'checked_out'
  | 'cancelled'
  | 'status_changed'
  | 'carer_assigned'
  | 'carer_reassigned'
  | 'billing_calculated';

export interface OvernightReservation {
  id: string;

  customerId: string;
  petId: string;
  householdId: string;

  startDate: string;
  endDate: string;
  checkInWindow: TimeWindow;
  checkOutWindow: TimeWindow;

  actualCheckInTime?: string;
  actualCheckOutTime?: string;

  locationId: string;
  sleepingAreaId?: string;
  assignedCarerUserId?: string;

  status: ReservationStatus;

  specialInstructions?: string;
  feedingInstructions?: string;
  medicationInstructions?: string;
  behaviourNotes?: string;

  requiresMedication: boolean;
  hasBehaviourConcerns: boolean;
  hasAllergies: boolean;

  pricePerNight: number;
  totalNights: number;
  totalPrice: number;
  currency: string;
  priceLockedAt: string;

  requiresPickup: boolean;
  requiresDropOff: boolean;
  pickupRequestId?: string;
  dropOffRequestId?: string;

  checkedInBy?: string;
  checkedOutBy?: string;

  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;

  petName?: string;
  customerName?: string;

  daycareBookingId?: string;

  includeInDaycareAttendance: boolean;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface OvernightEvent {
  id: string;
  stayId: string;
  eventType: OvernightEventType;
  actorUserId: string;
  actorName: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface OvernightCarerInfo {
  userId: string;
  name: string;
  locationId: string;
  maxCapacity: number;
  currentLoad: number;
  isOnRota: boolean;
  rotaPublished: boolean;
}

export interface TransitionRequest {
  type: 'daycare_to_overnight' | 'overnight_to_daycare';
  petId: string;
  locationId: string;
  sourceBookingId?: string;
  reservationId?: string;
  assignedCarerUserId?: string;
}

export interface SleepingArea {
  id: string;
  locationId: string;

  name: string;
  type: SleepingAreaType;

  maxOccupancy: number;

  isIndoor: boolean;
  hasHeating: boolean;
  hasCooling: boolean;
  size: 'small' | 'medium' | 'large' | 'xl';

  isActive: boolean;
  isUnderMaintenance: boolean;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface NightlyCareLog {
  id: string;

  reservationId: string;
  petId: string;
  locationId: string;

  logDate: string;

  feedingCompleted: boolean;
  feedingTime?: string;
  feedingNotes?: string;

  medicationAdministered: boolean;
  medicationTime?: string;
  medicationDetails?: string;

  toiletBreakCompleted: boolean;
  toiletBreakTime?: string;
  toiletBreakNotes?: string;

  behaviourNotes?: string;
  healthObservations?: string;

  sleepQuality?: 'excellent' | 'good' | 'restless' | 'poor';

  hasIncident: boolean;
  incidentId?: string;

  completedBy: string;
  completedAt: string;

  createdAt: string;
  updatedAt: string;
}

export interface ShiftHandover {
  id: string;
  locationId: string;

  handoverDate: string;
  fromShift: 'day' | 'night';
  toShift: 'day' | 'night';

  generalNotes: string;

  dogNotes: DogHandoverNote[];

  alertsCount: number;
  actionsRequired: string[];

  handedOverBy: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;

  createdAt: string;
  updatedAt: string;
}

export interface DogHandoverNote {
  petId: string;
  petName: string;
  notes: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface OvernightsCapacity {
  id: string;
  locationId: string;

  maxOvernightCapacity: number;

  bufferSlots: number;

  isActive: boolean;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface CapacitySnapshot {
  date: string;
  locationId: string;

  maxCapacity: number;
  currentOccupancy: number;
  availableSlots: number;

  reservations: OvernightReservation[];
}

export interface OvernightsRule {
  id: string;
  locationId?: string;

  type: OvernightsRuleType;
  name: string;
  description?: string;

  config: Record<string, any>;

  isActive: boolean;
  severity: 'info' | 'warning' | 'error' | 'blocker';

  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type OvernightsRuleType =
  | 'block_checkin_expired_vaccinations'
  | 'require_nightly_log_completion'
  | 'escalate_high_severity_incidents'
  | 'enforce_quiet_hours'
  | 'enforce_feeding_cutoff';

export interface TonightsBoarders {
  date: string;
  locationId: string;

  totalInStay: number;
  maxCapacity: number;
  alertsCount: number;

  boarders: BoarderSummary[];
}

export interface BoarderSummary {
  reservationId: string;
  petId: string;
  petName: string;
  customerId: string;
  customerName: string;

  sleepingAreaName?: string;
  assignedCarerName?: string;
  assignedCarerUserId?: string;

  requiresMedication: boolean;
  hasBehaviourConcerns: boolean;
  hasAllergies: boolean;

  careLogCompleted: boolean;

  specialNotes?: string;
}

export interface CheckInRequest {
  reservationId: string;

  vaccinationValid: boolean;
  waiverSigned: boolean;

  behaviourWarningsAcknowledged: boolean;
  medicalWarningsAcknowledged: boolean;

  checkInNotes?: string;

  checkedInBy: string;
}

export interface CheckOutRequest {
  reservationId: string;

  handedOverTo: string;

  checkOutNotes?: string;
  nextVisitNotes?: string;

  checkedOutBy: string;
}

export interface OvernightBillingBreakdown {
  reservationId: string;
  totalNights: number;
  pricePerNight: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  lineItems: BillingLineItem[];
}

export interface BillingLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  date: string;
}

export interface OvernightsCommTemplate {
  type: 'checked_in' | 'night_update' | 'ready_for_pickup' | 'checked_out';
  subject: string;
  body: string;
  variables: string[];
}
