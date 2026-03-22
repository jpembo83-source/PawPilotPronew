// ============================================================================
// ROLES & PERMISSIONS - TYPE DEFINITIONS
// ============================================================================

export type PermissionAction = 
  // Pricing permissions
  | 'pricing:view'
  | 'pricing:propose'
  | 'pricing:approve'
  | 'pricing:activate'
  | 'pricing:override'
  | 'pricing:emergency_override'
  // Service permissions
  | 'services:view'
  | 'services:create'
  | 'services:update'
  | 'services:delete'
  // General permissions
  | 'dashboard:view'
  | 'customers:view'
  | 'customers:create'
  | 'customers:update'
  | 'billing:view'
  | 'billing:create'
  | 'settings:view'
  | 'settings:update'
  | 'users:manage'
  | 'roles:manage';

export type RoleScope = 'organisation' | 'location';

export interface Role {
  id: string;
  name: string;
  description: string;
  scope: RoleScope;
  
  // Permissions
  permissions: PermissionAction[];
  
  // System roles cannot be deleted
  isSystemRole: boolean;
  
  // Status
  isActive: boolean;
  
  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface UserRole {
  userId: string;
  roleId: string;
  
  // Scope (if role is location-scoped)
  locationId?: string;
  
  // Audit
  assignedAt: string;
  assignedBy: string;
}

// ============================================================================
// DEFAULT SYSTEM ROLES
// ============================================================================

export const SYSTEM_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  ASSISTANT_MANAGER: 'assistant_manager',
  STAFF: 'staff',
} as const;

export const DEFAULT_ROLE_DEFINITIONS: Omit<Role, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>[] = [
  {
    name: 'Admin',
    description: 'System owner with full access and emergency override capabilities',
    scope: 'organisation',
    permissions: [
      'pricing:view',
      'pricing:propose',
      'pricing:approve',
      'pricing:activate',
      'pricing:override',
      'pricing:emergency_override',
      'services:view',
      'services:create',
      'services:update',
      'services:delete',
      'dashboard:view',
      'customers:view',
      'customers:create',
      'customers:update',
      'billing:view',
      'billing:create',
      'settings:view',
      'settings:update',
      'users:manage',
      'roles:manage',
    ],
    isSystemRole: true,
    isActive: true,
  },
  {
    name: 'Manager (Pricing Authority)',
    description: 'Owns pricing strategy. Can approve, activate price books, and apply location overrides',
    scope: 'organisation',
    permissions: [
      'pricing:view',
      'pricing:approve',
      'pricing:activate',
      'pricing:override',
      'services:view',
      'services:create',
      'services:update',
      'dashboard:view',
      'customers:view',
      'customers:create',
      'customers:update',
      'billing:view',
      'billing:create',
      'settings:view',
    ],
    isSystemRole: true,
    isActive: true,
  },
  {
    name: 'Assistant Manager (Pricing Proposer)',
    description: 'Can propose pricing changes, create draft price books, but cannot activate or approve',
    scope: 'organisation',
    permissions: [
      'pricing:view',
      'pricing:propose',
      'services:view',
      'services:create',
      'dashboard:view',
      'customers:view',
      'customers:create',
      'customers:update',
      'billing:view',
      'settings:view',
    ],
    isSystemRole: true,
    isActive: true,
  },
  {
    name: 'Staff',
    description: 'Operational staff with no pricing edit access',
    scope: 'location',
    permissions: [
      'pricing:view',
      'services:view',
      'dashboard:view',
      'customers:view',
      'customers:create',
      'billing:view',
    ],
    isSystemRole: true,
    isActive: true,
  },
];
