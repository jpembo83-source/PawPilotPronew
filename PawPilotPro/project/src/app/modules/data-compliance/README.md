# Data & Compliance Module

**MDC Operations Centre - Production-Grade Compliance Operations**

## Overview

The Data & Compliance module is a **functional, operational module** (not just settings) that provides day-to-day workflows for GDPR compliance, data protection, and regulatory audit readiness. It enables controlled execution of data subject requests, exports, access monitoring, retention automation, and breach management — all enforced server-side with complete audit trails.

## Purpose

This module exists to:
- Execute GDPR and data protection workflows operationally
- Provide audit-ready visibility into data handling activities
- Manage data subject requests end-to-end (access, rectification, erasure, restriction)
- Monitor sensitive data access in real-time
- Support incident and breach handling with regulatory notification tracking
- Provide evidence for regulators, auditors, and internal reviews

## Access Control

### Admin
- **Full access** to all Data & Compliance functions
- Can execute all workflows and view all data
- Can create requests, exports, and breaches
- Can execute retention jobs manually

### Manager
- **Limited access** (read-only by default)
- Can be granted permissions to:
  - Initiate GDPR requests
  - Run exports for assigned locations
  - View audit logs for assigned locations
- Subject to approval workflows

### Assistant Manager / Staff
- **No access** unless explicitly granted (rare)
- All access is enforced server-side and logged

## Module Structure

```
/src/app/modules/data-compliance/
├── DataCompliancePage.tsx          # Main module page with 7-tab interface
├── types.ts                        # TypeScript definitions
├── api.ts                          # Backend API communication
├── store.ts                        # Zustand state management
├── index.ts                        # Module exports
├── pages/
│   ├── OverviewPage.tsx            # Compliance dashboard
│   ├── DataSubjectRequestsPage.tsx # GDPR request workflows
│   ├── DataExportsPage.tsx         # Secure data exports
│   ├── AccessLogsPage.tsx          # Sensitive data access monitoring
│   ├── RetentionJobsPage.tsx       # Automated retention/deletion
│   ├── IncidentsBreachesPage.tsx   # Breach management
│   └── AuditLogPage.tsx            # Compliance audit trail
├── components/
│   ├── CreateRequestDialog.tsx
│   ├── RequestDetailsDialog.tsx
│   ├── CreateExportDialog.tsx
│   └── CreateBreachDialog.tsx
└── README.md
```

### Backend Routes
```
/supabase/functions/server/data_compliance.ts
```

All routes prefixed with: `/make-server-fc003b23/data-compliance`

## 7 Module Sections

### 1. Overview Dashboard
**Purpose:** High-level compliance health view

**Widgets:**
- Open GDPR requests (by type: access, rectification, erasure, restriction)
- Recent data exports
- Sensitive data access events (7-day and 30-day metrics)
- Upcoming and failed retention jobs
- Open data breaches
- Last compliance configuration change

**Features:**
- Real-time statistics
- Location-scoped metrics
- Permission-gated visibility

---

### 2. Data Subject Requests (GDPR Workflows)
**Purpose:** Handle GDPR requests end-to-end

**Supported Request Types:**
1. **Right of Access** - Export all data for a household
2. **Right to Rectification** - Correct inaccurate data
3. **Right to Erasure** (Right to be Forgotten) - Delete/anonymise data
4. **Restriction of Processing** - Temporarily restrict data usage

**Workflow:**
1. **Create Request**
   - Select request type
   - Identify data subject (household/contact)
   - Define scope (all data or selected categories)
   - Record source (customer, regulator, internal)

2. **Review Affected Data**
   - View which data categories are involved
   - Highlight legal retention constraints
   - Identify processing dependencies

3. **Execute Action**
   - Export data package
   - Anonymise records (where deletion not legally allowed)
   - Restrict processing

4. **Close Request**
   - Record outcome and notes
   - Upload response documents (optional)
   - All steps timestamped and auditable

**Rules:**
- Erasure defaults to anonymisation where deletion is not legally permitted
- All workflow steps are immutably logged
- Requests cannot be deleted (compliance requirement)

---

### 3. Data Exports (Operational)
**Purpose:** Execute controlled, secure data exports

**Export Types:**
- Customer/household data
- Pet records
- Operational data (bookings, attendance, transport)
- Financial data (permission-gated)
- Audit data

**Export Controls:**
- **Scope:** Household, Location, Organisation
- **Format:** CSV, PDF, JSON
- **Security:**
  - Password-protected downloads (auto-generated)
  - Expiry on download links (7 days default)
  - One-time password display

**Rules:**
- Exports respect data classification
- User permissions enforced
- Location scoping applied
- Every export action logged

---

### 4. Access Logs (Sensitive Data Monitoring)
**Purpose:** Visibility into sensitive data access

**Tracked Events:**
- Viewing personal data
- Viewing medical/behaviour notes
- Viewing financial data
- Exporting data

**Filters:**
- User
- Data category (personal, medical, behavioural, financial, operational)
- Location
- Date range
- Entity type

**Features:**
- Drill-down to see what was accessed and why
- Module source tracking
- Immutable logs

**Rules:**
- Logs cannot be edited or deleted
- Access logs respect retention policies
- All access is timestamped with user, role, and IP

---

### 5. Retention & Deletion Jobs
**Purpose:** Operationalise data retention rules

**Functionality:**
- View scheduled retention/anonymisation jobs
- See next run time and affected data categories
- View last run results
- Manual execution (Admin only)
- Failure alerts

**Job Types:**
- **Anonymisation** - Replace PII with anonymised data
- **Deletion** - Permanent removal (where legally permitted)
- **Archival** - Move to cold storage

**Rules:**
- Jobs run automatically based on configured schedules
- All actions fully logged
- No manual deletion of protected data
- Legal retention constraints enforced

---

### 6. Incidents & Breaches
**Purpose:** Handle data-related security incidents

**Capabilities:**
- Create data breach records
- Track:
  - Severity (low, medium, high, critical)
  - Data categories involved
  - Locations affected
  - Estimated affected count
- Notification tracking:
  - Customer notification required/completed
  - Regulator notification required/completed
- Mitigation actions
- Investigation status

**Workflow:**
1. Discovery and reporting
2. Assessment and severity classification
3. Notification decisions (72-hour GDPR requirement)
4. Mitigation and remediation
5. Closure and lessons learned

**Integration:**
- Linked to Incident Reporting module
- Escalation rules via Operational Rules

**Rules:**
- Breach records cannot be deleted (regulatory requirement)
- All status changes logged
- Critical breaches trigger immediate alerts

---

### 7. Audit Log (Compliance View)
**Purpose:** Compliance-focused audit trail

**Includes:**
- Data subject request creation and actions
- Export generation and downloads
- Retention job executions
- Data access events
- Breach reports and updates
- Settings changes

**Capabilities:**
- Full-text search
- Multi-field filtering
- Export (permission-gated)
- Time-ordered display

**Features:**
- Immutable and tamper-proof
- Complete change tracking (before/after)
- User attribution with role and IP

---

## Data Model

### Key Entities
- `data_subject_requests` - GDPR request records
- `data_request_actions` - Actions taken on requests
- `data_exports` - Export generation and download tracking
- `data_access_logs` - Sensitive data access monitoring
- `retention_jobs` - Automated retention/deletion jobs
- `job_executions` - Job run history
- `breach_records` - Data breach incidents
- `compliance_audit_log` - Complete audit trail

---

## Integration with Other Modules

### Customers & Pets
- GDPR workflows link to household and pet records
- Request actions can trigger data exports

### Users & Access
- Permission checks enforced throughout
- Role-based action restrictions

### Communications
- Responses to data subject requests logged
- Breach notifications tracked

### Billing & Finance
- Financial data exports governed here
- Access to financial data monitored

### Operational Rules
- Compliance-related rules enforced consistently
- Retention policies driven by rule engine

---

## Security & Enforcement

### Non-Negotiable Principles
- **No client-side execution** - All compliance actions server-side
- **Explicit permissions** - All actions require explicit role permission
- **Complete traceability** - Every action logged with user, timestamp, justification
- **Immutability** - Audit logs and breach records cannot be deleted
- **Encryption** - Exports are password-protected
- **Access control** - Multi-layer permission gating

---

## API Endpoints

### Dashboard
- `GET /data-compliance/stats`

### Data Subject Requests
- `GET /data-compliance/requests`
- `GET /data-compliance/requests/:id`
- `POST /data-compliance/requests`
- `PUT /data-compliance/requests/:id`
- `GET /data-compliance/requests/:id/actions`
- `POST /data-compliance/requests/:id/actions`

### Data Exports
- `GET /data-compliance/exports`
- `POST /data-compliance/exports`
- `PUT /data-compliance/exports/:id/download`

### Access Logs
- `GET /data-compliance/access-logs`
- `POST /data-compliance/access-logs`

### Retention Jobs
- `GET /data-compliance/retention-jobs`
- `GET /data-compliance/retention-jobs/:id`
- `POST /data-compliance/retention-jobs`
- `POST /data-compliance/retention-jobs/:id/execute`

### Breaches
- `GET /data-compliance/breaches`
- `GET /data-compliance/breaches/:id`
- `POST /data-compliance/breaches`
- `PUT /data-compliance/breaches/:id`

### Audit Logs
- `GET /data-compliance/audit-logs`

### Seeding
- `POST /data-compliance/seed`

---

## Usage Examples

### Loading Module Data
```typescript
import { useDataComplianceStore } from './modules/data-compliance';

const { loadAll, stats, requests, breaches } = useDataComplianceStore();

useEffect(() => {
  loadAll(); // Loads all compliance data
}, [loadAll]);
```

### Creating a GDPR Request
```typescript
const { createRequest } = useDataComplianceStore();

await createRequest({
  request_type: 'access',
  request_source: 'customer',
  household_id: 'household-001',
  household_name: 'Smith Family',
  data_categories: ['personal', 'operational'],
  scope_description: 'All personal and booking data',
  created_by: 'current-user-id',
});
```

### Creating a Secure Export
```typescript
const { createExport } = useDataComplianceStore();

await createExport({
  export_type: 'customer',
  scope: 'household',
  format: 'csv',
  scope_description: 'Smith Family - All Data',
  data_categories: ['personal', 'medical', 'operational'],
  created_by: 'current-user-id',
});
```

### Executing a Retention Job
```typescript
const { executeRetentionJob } = useDataComplianceStore();

await executeRetentionJob('job-id');
// Job runs asynchronously
// Results appear in job execution history
```

### Reporting a Data Breach
```typescript
const { createBreach } = useDataComplianceStore();

await createBreach({
  title: 'Unauthorised Access to Customer Records',
  description: 'External party gained temporary access...',
  severity: 'high',
  data_categories: ['personal', 'medical'],
  affected_locations: ['location-1'],
  estimated_affected_count: 150,
  discovery_date: '2024-12-20',
  notification_required: true,
  mitigation_actions: 'Access revoked, passwords reset...',
  reported_by: 'current-user-id',
});
```

---

## Acceptance Criteria

✅ Data & Compliance module provides full operational control over compliance tasks  
✅ GDPR requests can be handled end-to-end without manual intervention  
✅ Sensitive data access is visible and traceable  
✅ Retention rules execute safely and automatically  
✅ Breach incidents are tracked with regulatory notification requirements  
✅ Platform is audit-ready at any point in time  
✅ All actions are server-side enforced and fully logged  
✅ Exports are password-protected and time-limited  
✅ Historical compliance data is immutable  
✅ British English throughout  

---

## Compliance Standards

This module supports compliance with:
- **GDPR** (General Data Protection Regulation - EU)
- **UK Data Protection Act 2018**
- **Swiss Federal Act on Data Protection (FADP)**
- **ISO 27001** (Information Security Management)
- **SOC 2** (Service Organization Control)

---

## Future Enhancements

- Automated breach risk assessment
- Integration with external DPO tools
- Advanced anonymisation techniques
- Data mapping and flow visualisation
- Privacy impact assessments (PIAs)
- Consent management integration
- Multi-language support for GDPR responses
- Machine learning for access pattern anomalies

---

## Support

For questions or issues with the Data & Compliance module, contact the development team or refer to the main platform documentation.

---

**Last Updated:** December 2024  
**Module Version:** 1.0.0  
**Compliance:** GDPR, UK DPA 2018, Swiss FADP, ISO 27001
