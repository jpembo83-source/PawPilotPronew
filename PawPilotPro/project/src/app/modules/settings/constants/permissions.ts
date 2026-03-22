// ============================================================================
// PERMISSION TEMPLATES & ROLE DEFINITIONS
// ============================================================================

export interface PermissionTemplate {
  id: string;
  label: string;
  description: string;
  role: 'staff' | 'manager' | 'admin';
  permissions: string[];
  module?: string; // Optional: associates template with specific module
}

// ============================================================================
// CORE PERMISSIONS
// ============================================================================

const CORE_PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard:view',
  
  // Customers
  CUSTOMERS_VIEW: 'customers:view',
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',
  
  // Pets
  PETS_VIEW: 'pets:view',
  PETS_CREATE: 'pets:create',
  PETS_UPDATE: 'pets:update',
  PETS_DELETE: 'pets:delete',
  
  // Documents
  DOCUMENTS_VIEW: 'documents:view',
  DOCUMENTS_UPLOAD: 'documents:upload',
  DOCUMENTS_DELETE: 'documents:delete',
  
  // Incidents
  INCIDENTS_VIEW: 'incidents:view',
  INCIDENTS_CREATE: 'incidents:create',
  INCIDENTS_UPDATE: 'incidents:update',
  INCIDENTS_CLOSE: 'incidents:close',
  
  // Messaging
  MESSAGING_VIEW: 'messaging:view',
  MESSAGING_CREATE: 'messaging:create',
  
  // Billing
  BILLING_VIEW: 'billing:view',
  BILLING_CREATE: 'billing:create',
  BILLING_UPDATE: 'billing:update',
  
  // Settings (Admin only)
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',
};

// ============================================================================
// MODULE-SPECIFIC PERMISSIONS
// ============================================================================

const DAYCARE_PERMISSIONS = {
  DAYCARE_VIEW: 'daycare:view',
  DAYCARE_CREATE: 'daycare:create',
  DAYCARE_UPDATE: 'daycare:update',
  DAYCARE_CHECKIN: 'daycare:checkin',
  DAYCARE_CHECKOUT: 'daycare:checkout',
};

const GROOMING_PERMISSIONS = {
  GROOMING_VIEW: 'grooming:view',
  GROOMING_CREATE: 'grooming:create',
  GROOMING_UPDATE: 'grooming:update',
  GROOMING_CANCEL: 'grooming:cancel',
};

const TRANSPORT_PERMISSIONS = {
  TRANSPORT_VIEW: 'transport:view',
  TRANSPORT_CREATE: 'transport:create',
  TRANSPORT_UPDATE: 'transport:update',
  TRANSPORT_COMPLETE: 'transport:complete',
};

const OVERNIGHTS_PERMISSIONS = {
  OVERNIGHTS_VIEW: 'overnights:view',
  OVERNIGHTS_CREATE: 'overnights:create',
  OVERNIGHTS_UPDATE: 'overnights:update',
  OVERNIGHTS_APPROVE: 'overnights:approve',
  OVERNIGHTS_CHECKIN: 'overnights:checkin',
  OVERNIGHTS_CHECKOUT: 'overnights:checkout',
  OVERNIGHTS_CARE_LOG: 'overnights:care_log',
};

// ============================================================================
// PERMISSION TEMPLATES
// ============================================================================

export const PERMISSION_TEMPLATES: PermissionTemplate[] = [
  // ========================================================================
  // ADMIN
  // ========================================================================
  {
    id: 'admin',
    label: 'Administrator',
    description: 'Full system access including settings and user management',
    role: 'admin',
    permissions: [
      ...Object.values(CORE_PERMISSIONS),
      ...Object.values(DAYCARE_PERMISSIONS),
      ...Object.values(GROOMING_PERMISSIONS),
      ...Object.values(TRANSPORT_PERMISSIONS),
      ...Object.values(OVERNIGHTS_PERMISSIONS),
    ],
  },
  
  // ========================================================================
  // MANAGERS
  // ========================================================================
  {
    id: 'manager',
    label: 'Manager',
    description: 'Full operational access without settings management',
    role: 'manager',
    permissions: [
      CORE_PERMISSIONS.DASHBOARD_VIEW,
      CORE_PERMISSIONS.CUSTOMERS_VIEW,
      CORE_PERMISSIONS.CUSTOMERS_CREATE,
      CORE_PERMISSIONS.CUSTOMERS_UPDATE,
      CORE_PERMISSIONS.PETS_VIEW,
      CORE_PERMISSIONS.PETS_CREATE,
      CORE_PERMISSIONS.PETS_UPDATE,
      CORE_PERMISSIONS.DOCUMENTS_VIEW,
      CORE_PERMISSIONS.DOCUMENTS_UPLOAD,
      CORE_PERMISSIONS.INCIDENTS_VIEW,
      CORE_PERMISSIONS.INCIDENTS_CREATE,
      CORE_PERMISSIONS.INCIDENTS_UPDATE,
      CORE_PERMISSIONS.INCIDENTS_CLOSE,
      CORE_PERMISSIONS.MESSAGING_VIEW,
      CORE_PERMISSIONS.MESSAGING_CREATE,
      CORE_PERMISSIONS.BILLING_VIEW,
      CORE_PERMISSIONS.BILLING_CREATE,
      CORE_PERMISSIONS.BILLING_UPDATE,
      ...Object.values(DAYCARE_PERMISSIONS),
      ...Object.values(GROOMING_PERMISSIONS),
      ...Object.values(TRANSPORT_PERMISSIONS),
      ...Object.values(OVERNIGHTS_PERMISSIONS),
    ],
  },
  
  // ========================================================================
  // DAYCARE STAFF
  // ========================================================================
  {
    id: 'daycare_staff',
    label: 'Daycare Staff',
    description: 'Daycare operations, check-in/out, and basic customer access',
    role: 'staff',
    module: 'daycare',
    permissions: [
      CORE_PERMISSIONS.DASHBOARD_VIEW,
      CORE_PERMISSIONS.CUSTOMERS_VIEW,
      CORE_PERMISSIONS.PETS_VIEW,
      CORE_PERMISSIONS.DOCUMENTS_VIEW,
      CORE_PERMISSIONS.INCIDENTS_VIEW,
      CORE_PERMISSIONS.INCIDENTS_CREATE,
      CORE_PERMISSIONS.MESSAGING_VIEW,
      ...Object.values(DAYCARE_PERMISSIONS),
    ],
  },
  
  // ========================================================================
  // GROOMING STAFF
  // ========================================================================
  {
    id: 'grooming_staff',
    label: 'Grooming Staff',
    description: 'Grooming appointments, services, and client interactions',
    role: 'staff',
    module: 'grooming',
    permissions: [
      CORE_PERMISSIONS.DASHBOARD_VIEW,
      CORE_PERMISSIONS.CUSTOMERS_VIEW,
      CORE_PERMISSIONS.PETS_VIEW,
      CORE_PERMISSIONS.DOCUMENTS_VIEW,
      CORE_PERMISSIONS.INCIDENTS_VIEW,
      CORE_PERMISSIONS.INCIDENTS_CREATE,
      CORE_PERMISSIONS.MESSAGING_VIEW,
      ...Object.values(GROOMING_PERMISSIONS),
    ],
  },
  
  // ========================================================================
  // DRIVER (TRANSPORT ONLY)
  // ========================================================================
  {
    id: 'driver',
    label: 'Driver',
    description: 'Transportation requests and route management only',
    role: 'staff',
    module: 'transport',
    permissions: [
      CORE_PERMISSIONS.DASHBOARD_VIEW,
      CORE_PERMISSIONS.CUSTOMERS_VIEW, // Limited to pickup/dropoff customers
      CORE_PERMISSIONS.PETS_VIEW, // Limited to transported pets
      CORE_PERMISSIONS.MESSAGING_VIEW,
      ...Object.values(TRANSPORT_PERMISSIONS),
    ],
  },
  
  // ========================================================================
  // NIGHT SHIFT (OVERNIGHTS PRIMARY)
  // ========================================================================
  {
    id: 'night_shift',
    label: 'Night Shift',
    description: 'Overnight care logs, shift handovers, and nightly operations',
    role: 'staff',
    module: 'overnights',
    permissions: [
      CORE_PERMISSIONS.DASHBOARD_VIEW,
      CORE_PERMISSIONS.CUSTOMERS_VIEW, // Limited to boarding customers
      CORE_PERMISSIONS.PETS_VIEW, // Including medical/behavior flags
      CORE_PERMISSIONS.DOCUMENTS_VIEW, // Vaccination status
      CORE_PERMISSIONS.INCIDENTS_VIEW, // Overnight-related incidents
      CORE_PERMISSIONS.INCIDENTS_CREATE,
      CORE_PERMISSIONS.MESSAGING_VIEW, // Limited
      CORE_PERMISSIONS.MESSAGING_CREATE, // Send updates if permitted
      OVERNIGHTS_PERMISSIONS.OVERNIGHTS_VIEW,
      OVERNIGHTS_PERMISSIONS.OVERNIGHTS_UPDATE,
      OVERNIGHTS_PERMISSIONS.OVERNIGHTS_CARE_LOG,
      // No billing access unless explicitly added
    ],
  },
  
  // ========================================================================
  // OVERNIGHT LEAD (SENIOR NIGHT SHIFT)
  // ========================================================================
  {
    id: 'overnight_lead',
    label: 'Overnight Lead',
    description: 'Senior night shift with reservations, approvals, and incident closure',
    role: 'staff',
    module: 'overnights',
    permissions: [
      CORE_PERMISSIONS.DASHBOARD_VIEW,
      CORE_PERMISSIONS.CUSTOMERS_VIEW,
      CORE_PERMISSIONS.PETS_VIEW,
      CORE_PERMISSIONS.DOCUMENTS_VIEW,
      CORE_PERMISSIONS.INCIDENTS_VIEW,
      CORE_PERMISSIONS.INCIDENTS_CREATE,
      CORE_PERMISSIONS.INCIDENTS_CLOSE, // Can close overnight incidents
      CORE_PERMISSIONS.MESSAGING_VIEW,
      CORE_PERMISSIONS.MESSAGING_CREATE,
      ...Object.values(OVERNIGHTS_PERMISSIONS),
    ],
  },
  
  // ========================================================================
  // FRONT DESK
  // ========================================================================
  {
    id: 'front_desk',
    label: 'Front Desk',
    description: 'Customer service, bookings, and general operations',
    role: 'staff',
    permissions: [
      CORE_PERMISSIONS.DASHBOARD_VIEW,
      CORE_PERMISSIONS.CUSTOMERS_VIEW,
      CORE_PERMISSIONS.CUSTOMERS_CREATE,
      CORE_PERMISSIONS.CUSTOMERS_UPDATE,
      CORE_PERMISSIONS.PETS_VIEW,
      CORE_PERMISSIONS.PETS_CREATE,
      CORE_PERMISSIONS.PETS_UPDATE,
      CORE_PERMISSIONS.DOCUMENTS_VIEW,
      CORE_PERMISSIONS.DOCUMENTS_UPLOAD,
      CORE_PERMISSIONS.INCIDENTS_VIEW,
      CORE_PERMISSIONS.MESSAGING_VIEW,
      CORE_PERMISSIONS.MESSAGING_CREATE,
      CORE_PERMISSIONS.BILLING_VIEW,
      DAYCARE_PERMISSIONS.DAYCARE_VIEW,
      DAYCARE_PERMISSIONS.DAYCARE_CREATE,
      DAYCARE_PERMISSIONS.DAYCARE_CHECKIN,
      DAYCARE_PERMISSIONS.DAYCARE_CHECKOUT,
      GROOMING_PERMISSIONS.GROOMING_VIEW,
      GROOMING_PERMISSIONS.GROOMING_CREATE,
      OVERNIGHTS_PERMISSIONS.OVERNIGHTS_VIEW,
      OVERNIGHTS_PERMISSIONS.OVERNIGHTS_CREATE,
      OVERNIGHTS_PERMISSIONS.OVERNIGHTS_CHECKIN,
      OVERNIGHTS_PERMISSIONS.OVERNIGHTS_CHECKOUT,
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getPermissionTemplateById(id: string): PermissionTemplate | undefined {
  return PERMISSION_TEMPLATES.find(t => t.id === id);
}

export function getPermissionTemplatesByModule(module: string): PermissionTemplate[] {
  return PERMISSION_TEMPLATES.filter(t => t.module === module);
}

export function getAllPermissions(): string[] {
  return Array.from(new Set(
    PERMISSION_TEMPLATES.flatMap(t => t.permissions)
  ));
}
