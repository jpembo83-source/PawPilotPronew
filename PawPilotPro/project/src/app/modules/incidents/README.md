# Incidents Module - MDC Operations Centre

## Overview

The Incidents module provides comprehensive incident reporting, tracking, management, and resolution capabilities for the MDC Operations Centre. It supports fast incident creation during operations, consistent classification, severity-based escalation, assignment workflows, evidence capture, and full audit trails.

## Features

### Incident Management
- **Quick Incident Creation**: Optimised 60-second reporting form with mobile-friendly interface
- **Severity Classification**: Low, Medium, High, Critical with automatic escalation rules
- **Status Workflow**: New → In Review → Action Required → Awaiting Customer → Resolved → Closed
- **Category System**: 11 predefined incident categories covering all operational areas
- **Module Context**: Links to Daycare, Grooming, Boutique, Transport, Overnights

### Workflow & Assignment
- **Assignment System**: Assign incidents to staff members with due dates
- **Action Items**: Create and track follow-up action checklists
- **Escalation Rules**: Automatic escalation for High/Critical severity incidents
- **Closure Requirements**: Mandatory root cause analysis and outcome documentation
- **Reopen Capability**: Admin/Manager can reopen closed incidents with reasoning

### Evidence & Documentation
- **Notes/Comments**: Internal communication thread for each incident
- **Attachments**: Photo and file upload support
- **People Tracking**: Record involved staff, witnesses, reporters
- **Audit Trail**: Immutable log of all changes and actions

### Permissions & RBAC

**Admin**
- Full access across all locations
- Can close, reopen, and delete incidents
- Can export all incidents

**Manager**
- Manage incidents for assigned locations
- Can assign, escalate, and close incidents
- Can export incident reports for their scope

**Assistant Manager**
- View and manage incidents for assigned locations
- Can assign incidents
- Cannot close High/Critical incidents

**Staff**
- Create incidents
- View incidents for their location
- Update incidents they created (until closed)
- Add notes and evidence

**Driver** (if Transportation enabled)
- Create transport-related incidents
- View incidents tied to their routes

**Night Shift** (if Overnights enabled)
- Create overnight-related incidents
- Can close Low severity incidents
- Must escalate Medium+ severity

## Incident Categories

1. **Injury (Dog)** - Any injury to a pet
2. **Injury (Human/Staff)** - Staff or visitor injury
3. **Behaviour / Aggression** - Aggressive or concerning behaviour
4. **Escape / Lost Dog** - Pet escape or missing pet
5. **Illness / Medical Concern** - Health or medical issues
6. **Property Damage** - Damage to facility or equipment
7. **Transport Incident** - Pickup/drop-off issues, vehicle problems
8. **Overnight Welfare Issue** - Issues during overnight stays
9. **Customer Complaint** - Customer complaints or concerns
10. **Near Miss (Safety)** - Safety near-misses requiring documentation
11. **Other** - Requires detailed description

## Severity Levels

### Low
- Minor issue, no harm, no escalation required
- No mandatory fields beyond summary
- Staff can create and close

### Medium
- Requires attention and follow-up, but not urgent
- **Requires**: Description, Immediate Actions
- Automatically marked for follow-up
- Manager/Admin approval to close

### High
- Urgent operational risk, management action required
- **Requires**: Description, Immediate Actions
- Automatically escalated to management
- Manager/Admin approval to close

### Critical
- Severe harm/legal risk, immediate escalation required
- **Requires**: Description, Immediate Actions
- Automatically escalated with urgent alert
- Manager/Admin approval to close

## Data Model

### Incidents Table
- Core incident details (summary, description, severity, status)
- Location, module, and category classification
- Timestamps (occurred_at, created_at, updated_at, closed_at)
- Links to pet, household, booking, transport, overnight
- Assignment and workflow fields
- Closure fields (root cause, outcome, preventative action)

### Related Tables
- **incident_people**: Staff/witnesses involved
- **incident_actions**: Follow-up action items/checklist
- **incident_notes**: Comment thread
- **incident_attachments**: Evidence files
- **incident_audit_log**: Immutable change history

## API Routes

All routes are under `/make-server-fc003b23/incidents`

### Incidents
- `GET /` - List incidents (filtered by permissions)
- `GET /:id` - Get incident details with related data
- `POST /` - Create incident
- `PUT /:id` - Update incident
- `POST /:id/assign` - Assign incident to user
- `POST /:id/close` - Close incident with closure data
- `POST /:id/reopen` - Reopen closed incident

### Notes
- `POST /:id/notes` - Add note to incident

### Actions
- `POST /:id/actions` - Add action item
- `PUT /:id/actions/:actionId` - Update action status

### Reporting
- `GET /stats` - Get incident statistics
- `GET /export` - Export incidents (permission gated)

## Zustand Store

### State
```typescript
{
  incidents: Incident[];
  selectedIncident: Incident | null;
  stats: IncidentStats | null;
  filters: IncidentFilters;
  isLoading: boolean;
  error: string | null;
}
```

### Actions
- **Incidents**: fetchIncidents, fetchIncidentById, createIncident, updateIncident, assignIncident, closeIncident, reopenIncident
- **Notes**: addNote
- **Actions**: addAction, updateAction
- **Statistics**: fetchStats
- **Export**: exportIncidents
- **Filters**: setFilters, clearFilters

## UI Components

### Pages
- **IncidentsListPage**: Main incidents list with filters and stats
- **IncidentDetailPage**: Full incident view with tabbed interface

### Modals/Dialogs
- **CreateIncidentModal**: Quick incident creation form
- **AssignIncidentDialog**: Assign to user with due date
- **CloseIncidentDialog**: Close with root cause and outcome
- **ReopenIncidentDialog**: Reopen with reason

### Tabs (Detail View)
- **IncidentDetailsTab**: Full incident details and closure information
- **IncidentActionsTab**: Action items/checklist management
- **IncidentNotesTab**: Notes and comments thread
- **IncidentAuditTab**: Complete audit trail

## Integration Points

### Dashboard
- Quick Incident action in Quick Links widget
- Incident statistics widgets
- High/Critical incident alerts

### Customers Module
- Create incident from pet profile
- Create incident from household profile
- Auto-link pet and household data

### Operational Rules
- Rules can force incident creation on triggers
- Enforce required fields by severity
- Define escalation recipients and timelines
- Block closure unless required fields filled

### Messaging
- Template-based customer communications
- Incident follow-up notifications
- Respects customer consent preferences

### Data & Compliance
- Permission-gated viewing and export
- Retention governed by compliance settings
- Export logged and controlled
- No incident deletion (immutable audit trail)

## Escalation Logic

### Automatic Escalation Triggers
- High or Critical severity assignment
- Overdue follow-up actions
- Reopened incidents
- Transport incidents (notify driver coordinator)
- Overnight incidents (notify night shift lead + manager)

### Notification Channels
- Dashboard urgent banner (High/Critical)
- Manager notification (High/Critical)
- Admin notification (Critical only)
- Module-specific coordinators (Transport, Overnights)

## Closure Requirements

### All Incidents
- Root cause category (required)
- Outcome summary (required)
- Preventative action (recommended)

### Role-Based Closure
- **Low Severity**: Staff, Night Shift, Manager, Admin
- **Medium Severity**: Manager, Admin
- **High Severity**: Manager, Admin
- **Critical Severity**: Admin only (configurable)

## Reporting & Export

### Statistics Dashboard
- Total incidents count
- Open incidents count
- High/Critical incidents count
- Overdue follow-ups count
- Assigned to me count
- Breakdown by severity, status, category
- Recent 30-day trend

### CSV Export
- Full incident data export
- Filtered by permissions
- Includes all metadata
- Logged in audit trail
- Permission-gated (Manager/Admin only)

## Best Practices

### For Staff
1. Report incidents immediately when they occur
2. Provide clear, factual summaries
3. Document immediate actions taken
4. Link to affected pet/customer when applicable
5. Add photos/evidence as soon as possible

### For Managers
1. Review new incidents within 24 hours
2. Assign High/Critical incidents immediately
3. Ensure proper follow-up actions are defined
4. Verify closure documentation is complete
5. Review trends monthly for prevention planning

### For Admins
1. Monitor escalated incidents dashboard
2. Review Critical incidents immediately
3. Ensure compliance with closure requirements
4. Conduct monthly trend analysis
5. Update operational rules based on patterns

## Future Enhancements

### Planned Features
- Photo upload to Supabase Storage
- Scheduled reminder notifications
- Trend analysis and pattern detection
- Integration with Training modules (learnings from incidents)
- Customer-facing incident disclosure workflow
- Insurance claim documentation export
- Mobile app optimisations

### Integration Opportunities
- Calendar integration for follow-up due dates
- Email notifications for assignments
- SMS alerts for critical incidents
- Slack/Teams integration for team alerts
- PDF report generation
- Integration with Health & Safety compliance systems

## Technical Notes

### Performance
- Incidents indexed by location, severity, status, pet, household
- Efficient filtering with multiple KV prefix patterns
- Lazy loading of related data (notes, actions, audit logs)
- Pagination support for large datasets (future)

### Security
- All operations server-side permission checked
- Token-based authentication via Supabase Auth
- RBAC enforced at API level
- Audit trail for all modifications
- No client-side permission bypasses

### Data Retention
- Incidents are immutable (cannot be deleted)
- Audit logs retained indefinitely
- Governed by Data & Compliance settings
- Export and archive capabilities
- GDPR-compliant data handling

## Compliance

### Data Protection
- Permission-gated access to sensitive information
- Audit logging of all views and exports
- Secure storage of evidence/attachments
- Customer consent respected for communications
- GDPR right-to-access support

### Health & Safety
- Incident categorisation aligns with HSE requirements
- Root cause analysis mandatory
- Preventative action tracking
- Trend analysis for risk management
- Reportable incident identification

## Support

For technical support or feature requests, contact the development team.

For operational questions about incident reporting, refer to your facility's Standard Operating Procedures or contact your Location Manager.

---

**Last Updated**: December 2024  
**Version**: 1.0.0  
**Module Status**: Production-Ready
