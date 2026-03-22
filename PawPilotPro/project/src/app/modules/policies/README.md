# Staff Policy Portal

## Overview

The Staff Policy Portal is a legally defensible, auditable system for distributing company policies and requiring staff acknowledgement as part of their employment obligations.

## Key Features

### For Managers/Admins
- **Upload Policies**: Upload PDF or DOCX files with versioning
- **Assign Policies**: Assign to individuals, roles, locations, or all staff
- **Compliance Dashboard**: Real-time view of acknowledgement status
- **Repeat Cycles**: Annual, bi-annual, quarterly, or on-update re-acknowledgement
- **Blocking Policies**: Critical policies that restrict operations if overdue
- **Audit Trail**: Complete, immutable log of all actions
- **Export**: Export acknowledgements and assignments for compliance audits

### For Staff
- **My Policies**: Clear view of assigned policies requiring acknowledgement
- **Status Indicators**: Not started, Viewed, Acknowledged, Overdue
- **Document Access**: Download/view policy documents
- **Acknowledgement**: Explicit confirmation with typed name and timestamp

## Architecture

### Frontend Components

```
src/app/modules/policies/
├── pages/
│   ├── PolicyPortal.tsx         # Unified entry point (auto-switches by role)
│   ├── MyPoliciesPage.tsx       # Staff view
│   └── PoliciesManagementPage.tsx # Manager/Admin view
├── components/
│   └── PolicyModals.tsx         # Upload & Assign modals
├── store.ts                     # Zustand store
└── index.ts                     # Module exports
```

### Backend Routes

```
supabase/functions/server/
├── staff_routes_new.tsx         # Primary policy API (recommended)
└── policies_routes.tsx          # Legacy policy API
```

### API Endpoints (Staff Routes)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/staff/policies` | GET | List all policies |
| `/staff/policies` | POST | Create new policy |
| `/staff/policies/:id` | GET | Get policy details |
| `/staff/policies/:id/versions` | POST | Create new version |
| `/staff/policies/:id/versions/:vid/download` | GET | Get download URL |
| `/staff/policies/assign` | POST | Assign policy to staff |
| `/staff/policies/acknowledge` | POST | Record acknowledgement |
| `/staff/my-policies` | GET | Staff's assigned policies |
| `/staff/policies/compliance/stats` | GET | Compliance statistics |
| `/staff/policies/blocking/:userId` | GET | Check blocking status |
| `/staff/policies/export/acknowledgements` | GET | Export for audit |
| `/staff/policies/audit` | GET | View audit trail |

## Data Model

### Policy
```typescript
{
  id: string;              // pol_xxx
  tenant_id: string;
  title: string;
  category: string;        // 'Health & Safety', 'HR', etc.
  status: 'draft' | 'active' | 'archived';
  created_by: string;
  created_at: string;
  versions_count: number;
  latest_version?: PolicyVersion;
}
```

### Policy Version (Immutable)
```typescript
{
  id: string;              // pv_xxx
  policy_id: string;
  version_number: number;
  file_path: string;
  file_name: string;
  file_type: 'pdf' | 'doc' | 'docx';
  effective_date: string;
  expiry_date?: string;
  created_at: string;
}
```

### Policy Assignment
```typescript
{
  id: string;              // pa_xxx
  policy_id: string;
  policy_version_id: string;
  user_id: string;         // Target staff member
  assigned_by: string;
  due_date: string;
  is_blocking: boolean;    // Critical policy flag
  repeat_cycle: 'none' | 'annual' | 'biannual' | 'quarterly' | 'on_update';
  grace_period_days?: number;
  reminder_schedule: {
    days_before: number[];
    overdue_reminder: boolean;
  };
  status: 'pending' | 'viewed' | 'acknowledged' | 'overdue';
}
```

### Policy Acknowledgement (Write-Once, Immutable)
```typescript
{
  id: string;              // pack_xxx
  assignment_id: string;
  policy_id: string;
  policy_version_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  acknowledged_at: string;
  typed_name?: string;
  metadata: {
    ip_address?: string;
    user_agent?: string;
  };
  next_acknowledgement_due?: string; // For repeat cycles
}
```

## Usage

### Route Configuration (App.tsx)
```tsx
import { PolicyPortal } from './modules/policies';

<Route path="policies" element={<PolicyPortal />} />
```

### Navigation (modules.ts)
```tsx
{
  id: 'core',
  navItems: [
    { label: 'Policies', path: '/policies', icon: FileCheck },
  ]
}
```

### Programmatic Access
```tsx
import { useStaffStore } from '../staff/store';

const { 
  fetchMyPolicies,
  acknowledgePolicy,
  createPolicy,
  assignPolicy,
} = useStaffStore();
```

## Repeat Cycles

| Cycle | Description |
|-------|-------------|
| `none` | One-time acknowledgement only |
| `annual` | Re-acknowledge every 12 months |
| `biannual` | Re-acknowledge every 6 months |
| `quarterly` | Re-acknowledge every 3 months |
| `on_update` | Re-acknowledge when new version published |
| `on_role_change` | Re-acknowledge when staff changes role/location |

## Blocking Policies

Critical policies marked as "blocking" enforce compliance:

1. Staff with overdue blocking policies show warnings
2. Managers see blocking policy counts in compliance dashboard
3. Optional: Can prevent scheduling on rotas (enforcement point)
4. Visual indicator on all operational dashboards

### Checking Blocking Status
```tsx
// API call
GET /staff/policies/blocking/:userId

// Response
{
  user_id: "...",
  is_blocked: true,
  blocking_count: 2,
  blocking_policies: [...],
  message: "Staff member has 2 overdue blocking policies"
}
```

## Audit Trail

All actions are logged immutably:

- Policy uploads and version creation
- Assignments (who assigned, to whom, when)
- Acknowledgements (timestamp, IP, user agent)
- Exports (who exported, when, what)

Managers can export the full audit trail for compliance reviews.

## Legal Defensibility

The system ensures legal defensibility through:

1. **Immutable Records**: Acknowledgements cannot be edited or deleted
2. **Timestamping**: All actions have UTC timestamps
3. **Identity Tracking**: User ID, name, email recorded
4. **Forensic Metadata**: IP address, user agent captured
5. **Version Control**: All policy versions retained
6. **Export Capability**: Full audit export for legal proceedings

## Security

- **Tenant Isolation**: All data scoped by tenant_id
- **Role-Based Access**: Staff see only their assignments
- **Private Storage**: Documents stored in private Supabase bucket
- **Signed URLs**: Time-limited access to documents
- **Audit Logging**: All access logged

## Policy Categories

Default categories (configurable):
- Health & Safety
- Data Protection
- Operations
- HR
- Customer Service
- Finance
- Daycare
- Grooming
- Transport
- Legal & Compliance
- Other
