# Staff Policy Portal

## Overview

The Staff Policy Portal is a production-grade, legally defensible system for managing company policies and requiring staff acknowledgement as part of their employment obligations. It ensures compliance with employment law, provides a complete audit trail, and supports periodic re-acknowledgement cycles.

## Purpose

The Staff Policy Portal exists to ensure that:
- Staff are formally informed of company policies
- Staff explicitly acknowledge they have read and understood them
- Managers can demonstrate compliance for audits, disputes, or inspections
- Policies can be re-issued periodically or when updated

## Access & Navigation

### For Staff
Navigate to **Policies** in the main sidebar to access "My Policies" view.

### For Managers/Admins
Navigate to **Policies** in the main sidebar to access the full Policy Management interface, or access via **Staff → Policies & Acknowledgements** tab.

## Features

### 1. Policy Management (Manager View)

#### Upload Policies
- Upload PDF or DOCX files (max 10MB)
- Define policy name, category, and effective date
- Optional expiry/review date
- Each upload creates a new policy version
- Previous versions remain immutable and auditable

#### Policy Categories
- Health & Safety
- Company Handbook
- Daycare SOP
- Grooming SOP
- Transport SOP
- Overnight SOP
- HR Policy
- Disciplinary Procedures
- Data Protection
- Regulatory & Legal
- Other

#### Policy Status Lifecycle
1. **Draft** - Newly uploaded, not yet visible to staff
2. **Published** - Active and assignable to staff
3. **Archived** - Retired but retained for audit purposes

### 2. Policy Assignment

Managers can assign policies to:
- **Individual staff members** - specific users
- **All staff** - entire organisation
- **By role** - all users with a specific role
- **By location** - all staff at specific locations

#### Assignment Options
- **Due date** - when acknowledgement must be completed
- **Blocking status** - whether overdue policies block work scheduling
- **Reminder schedule** - configurable reminders (7 days, 3 days, 1 day before due)
- **Manager note** - additional context for staff
- **Repeat cycle** - for periodic re-acknowledgement

### 3. Repeat Acknowledgement Cycles

Policies can require re-acknowledgement on a schedule:
- **One-time only** - single acknowledgement
- **Annual** - every 12 months
- **Bi-annual** - every 6 months
- **Quarterly** - every 3 months
- **Monthly** - every month
- **On policy update** - when a new version is published
- **On role/location change** - when staff assignment changes

Grace period can be configured for each cycle.

### 4. Staff Experience (My Policies)

Staff members see:
- List of all assigned policies
- Policy category and version
- Due date and days remaining
- Status (Pending, Viewed, Acknowledged, Overdue)
- Blocking indicator for critical policies

#### Acknowledgement Process
1. Click "View & Acknowledge" to open the policy
2. Document opens in new tab for review
3. Confirm reading by checking the acknowledgement box
4. For blocking policies: type full name as electronic signature
5. Click "I Acknowledge This Policy"

#### Acknowledgement Record Includes:
- User ID and name
- Policy ID and version
- Exact timestamp (UTC)
- Acknowledgement text
- Typed name (if required)
- IP address and user agent (forensic metadata)

### 5. Blocking Policies

Critical policies can be marked as "blocking", which means:
- Overdue blocking policies trigger urgent alerts
- Staff cannot be scheduled on rotas while overdue
- Dashboard shows prominent critical compliance warnings
- Cannot be dismissed until acknowledged

### 6. Compliance Dashboard

Managers can view:
- Total policies and assignments
- Completion rate percentage
- Overdue count and trend
- Due soon (within 7 days)
- Blocking overdue (critical)
- Per-policy compliance breakdown

### 7. Audit Trail

Complete, immutable audit logging of:
- Policy uploads and publishes
- Version changes
- Assignments created
- Policy views and downloads
- Acknowledgements (with forensic metadata)
- Exports and compliance checks

### 8. Export Capabilities

Export formats available:
- **Acknowledgements CSV** - all acknowledgement records
- **Compliance Summary CSV** - per-policy compliance stats
- **Audit Trail CSV** - complete audit log
- **JSON** - machine-readable formats

Exports include timestamp and are logged in audit trail.

## Security & Legal Considerations

### Data Protection
- Policy documents stored in private Supabase Storage
- Access granted only to assigned staff
- Signed URLs expire after 1 hour

### Immutability
- Acknowledgements are write-once records
- No retroactive modification possible
- All timestamps in UTC with timezone awareness
- Audit trail cannot be deleted

### Access Control
- Staff: view and acknowledge assigned policies only
- Managers: upload, assign, view compliance
- Admins: full access including audit trail and archiving
- RLS enforced at database/KV level

## Technical Implementation

### Frontend Components
- `PolicyPortal` - Role-based view switcher
- `MyPoliciesPage` - Staff acknowledgement interface
- `PoliciesManagementPage` - Manager compliance dashboard
- `BlockingPolicyWarning` - Reusable warning components
- `usePolicyCompliance` - Compliance checking hook

### Backend Endpoints
- `GET /staff/my-policies` - Staff's assigned policies
- `POST /staff/policies` - Create new policy
- `POST /staff/policies/:id/versions` - Upload version
- `POST /staff/policies/assign` - Create assignment
- `POST /staff/policies/acknowledge` - Record acknowledgement
- `GET /staff/policies/compliance/stats` - Compliance statistics
- `GET /staff/policies/blocking/:userId` - Check blocking status
- `GET /staff/policies/export/acknowledgements` - Export records
- `GET /staff/policies/audit` - Audit trail

### Data Model (KV Store Keys)
```
staff:{tenant}:policy:{id}                    - Policy document
staff:{tenant}:policy:{id}:version:{id}       - Policy version
staff:{tenant}:assignment:{id}                - Assignment record
staff:{tenant}:assignment:user:{uid}:{id}     - User assignment index
staff:{tenant}:acknowledgement:{id}           - Acknowledgement record
staff:{tenant}:audit:{id}                     - Audit event
```

## Usage Examples

### Manager: Upload and Assign Policy

1. Navigate to Policies → "Upload Policy"
2. Enter title: "Health & Safety Policy 2026"
3. Select category: "Health & Safety"
4. Upload PDF document
5. Click "Upload Policy" (creates draft)
6. From policy list, click "Assign"
7. Select "All Staff" or individual members
8. Set due date: 14 days from now
9. Enable "Blocking" if critical
10. Click "Assign"

### Staff: Acknowledge Policy

1. See alert banner on dashboard
2. Navigate to Policies
3. Click "View & Acknowledge" on pending policy
4. Read document that opens in new tab
5. Check "I confirm I have read and understood..."
6. Type full name (for blocking policies)
7. Click "I Acknowledge This Policy"

### Manager: Export Compliance Report

1. Navigate to Policies
2. Click "Export Acknowledgements"
3. CSV file downloads with all records
4. Use for audit or dispute resolution

## Definition of Done ✓

The Staff Policy Portal is complete when:
- ✅ Managers can upload and version policies
- ✅ Managers can assign policies with deadlines and repeat cycles
- ✅ Staff can view and acknowledge assigned policies
- ✅ Overdue and blocking policies are enforced
- ✅ Acknowledgements are auditable and exportable
- ✅ The system can be relied upon as part of employment compliance

## British English

All UI text uses British English spelling and terminology (e.g., "organisation" not "organization", "colour" not "color").
