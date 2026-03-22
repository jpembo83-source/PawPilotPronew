# Communications Settings

## Overview

Communications Settings is the **configuration and governance layer** for all customer communications across the MDC Operations Platform. This module defines how communication works platform-wide and directly controls behavior in:

- Messaging inbox
- Automated messages  
- Quick links in Dashboard
- Operational rules
- Dashboard widgets

**Critical Principle:** Nothing in Messaging may be configurable outside this section. All communication behavior is defined here.

---

## Architecture

### Purpose

This module allows Admins and authorised Managers to:

1. **Configure channels** (Email, SMS, WhatsApp)
2. **Define sender identities** 
3. **Manage consent behavior**
4. **Define message templates**
5. **Control automation rules and SLAs**
6. **Control who can communicate and how**

All changes are:
- Database-backed (via KV store)
- Auditable (comprehensive audit trail)
- Enforced server-side (no client-side workarounds)

---

## Access Control

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all communications settings |
| **Manager** | Can manage templates and SLAs for assigned locations (if permitted) |
| **Staff** | No access to Communications Settings |

---

## 8 Main Sections

### 1. Channels

**Purpose:** Define which communication channels are available and where.

**Features:**
- Enable/disable channels at organisation level
- Configure channel availability per location
- Status indicators (active / misconfigured / disabled)

**Enforcement:**
- If a channel is disabled here, it cannot be used anywhere in Messaging
- Channel availability is enforced server-side

### 2. Sender Identity

**Purpose:** Control how messages appear to customers.

**Features:**
- Organisation-level sender identity (default)
- Location-specific overrides
- Channel-specific configuration:
  - Email: sender name, sender email, reply-to
  - SMS: sender ID, phone number
  - WhatsApp: phone number, display name

**Resolution Logic:**
- Location identity first, then organisation default

### 3. Consent & Preferences

**Purpose:** Define how customer consent is interpreted and enforced.

**Features:**
- Default opt-in behavior for new contacts
- Required consent per message type:
  - **Operational** (always required, non-negotiable)
  - Informational (reminders, document expiry)
  - Promotional (marketing, offers)
- Block sending when consent missing (always enforced)

**Enforcement:**
- Consent is stored per contact, per channel
- Messaging tool clearly explains when sending is blocked
- All consent changes are logged

### 4. Message Templates

**Purpose:** Define reusable, approved message content.

**Features:**
- Templates grouped by module and event type
- Variable support (petName, customerName, date, etc.)
- Channel-specific formatting
- Template states: Draft, Active, Archived
- Role-based permissions

**Rules:**
- Automated messages must always use templates
- Archived templates cannot be selected
- Staff can only use active templates

### 5. Automation & Triggers

**Purpose:** Control when messages are sent automatically.

**Features:**
- Enable/disable automation per event
- Map events to templates and channels
- Timing configuration (immediate / delayed)
- Conditional triggers (optional)

**Events Supported:**
- Daycare check-in/check-out
- Grooming completed
- Overnight updates
- Transport pickup/drop-off
- Document expiring
- And more...

**Enforcement:**
- Automation respects consent and channel availability
- All automated messages are logged

### 6. Response SLAs

**Purpose:** Define expected response times for inbound customer messages.

**Features:**
- Organisation default + location overrides
- Business hours configuration
- Channel-specific SLA overrides
- Priority settings

**Integration:**
- Messaging inbox highlights SLA breaches
- Dashboard widgets use SLA data
- Response time tracking

### 7. Permissions & Safeguards

**Purpose:** Control who can communicate and how.

**Settings:**
- Role-based permissions
- Channel restrictions per role
- Template requirements
- Approval workflows (if needed)
- Driver and Night Shift restrictions

**Enforcement:**
- All permissions are checked server-side
- UI hiding alone is insufficient
- Backend validates every message send

### 8. Audit & Logs

**Purpose:** Ensure traceability and compliance.

**Features:**
- **Configuration Audit:**
  - All settings changes logged
  - Who, what, when, before/after
  - Filterable by entity type and action

- **Delivery Logs:**
  - Message delivery tracking
  - Sent / delivered / failed status
  - Provider response codes
  - Consent verification status

**Exports:**
- Message history for GDPR requests (future)
- Consent history per contact (future)

---

## Integration with Messaging Tool

Communications Settings directly controls:

✅ Available channels in Compose Message  
✅ Which templates appear  
✅ Whether automation fires  
✅ SLA indicators in inbox  
✅ Sender identity on outbound messages  
✅ Blocking behavior for missing consent  

**No duplication of logic is allowed.**

---

## Data Model

### Backend Storage (KV Store)

All data is stored in the KV store with the following prefixes:

- `communications_settings:channels:*`
- `communications_settings:sender_identities:*`
- `communications_settings:consent_policy`
- `communications_settings:templates:*`
- `communications_settings:automation:*`
- `communications_settings:slas:*`
- `communications_settings:permissions:*`
- `communications_settings:delivery_logs:*`
- `communications_settings:audit:*`

### Key Entities

See `types.ts` for full type definitions:

- `ChannelConfig` - Channel configuration
- `SenderIdentity` - Sender identity per scope
- `ConsentPolicy` - Consent enforcement rules
- `CommunicationTemplate` - Message templates
- `AutomationRule` - Automation triggers
- `SLADefinition` - Response time targets
- `CommunicationPermission` - Role-based permissions
- `CommunicationDeliveryLog` - Message delivery tracking
- `CommunicationAuditLog` - Configuration changes

---

## API Endpoints

All endpoints are prefixed with `/make-server-fc003b23/communications/`

### Channels
- `GET /channels` - List all channels
- `PUT /channels/:id` - Update channel config

### Sender Identities
- `GET /sender-identities` - List all sender identities
- `POST /sender-identities` - Create sender identity
- `PUT /sender-identities/:id` - Update sender identity
- `DELETE /sender-identities/:id` - Delete sender identity

### Consent Policy
- `GET /consent-policy` - Get current policy
- `PUT /consent-policy` - Update policy

### Templates
- `GET /templates` - List all templates
- `GET /templates/:id` - Get template by ID
- `POST /templates` - Create template
- `PUT /templates/:id` - Update template
- `DELETE /templates/:id` - Delete template

### Automation
- `GET /automation` - List automation rules
- `GET /automation/:id` - Get automation rule
- `POST /automation` - Create automation rule
- `PUT /automation/:id` - Update automation rule
- `DELETE /automation/:id` - Delete automation rule

### SLAs
- `GET /slas` - List SLA definitions
- `POST /slas` - Create SLA
- `PUT /slas/:id` - Update SLA
- `DELETE /slas/:id` - Delete SLA

### Permissions
- `GET /permissions` - List all permissions
- `PUT /permissions/:id` - Update permission

### Logs
- `GET /delivery-logs` - Get delivery logs
- `GET /audit-logs` - Get audit logs

### Statistics
- `GET /stats` - Get communication statistics

---

## State Management (Zustand)

The `useCommunicationsSettingsStore` provides:

- All data entities (channels, templates, rules, etc.)
- Loading and error states
- CRUD operations for all entities
- Filter management for lists
- Audit trail access

**Initialization:**
```typescript
const { initialize } = useCommunicationsSettingsStore();

useEffect(() => {
  initialize(); // Loads all data on mount
}, []);
```

---

## UI Components

### Main Page
- `CommunicationsSettingsPage.tsx` - Tabbed interface with 8 sections

### Section Components
- `ChannelsSection.tsx` - Channel configuration
- `SenderIdentitySection.tsx` - Sender identity management
- `ConsentSection.tsx` - Consent policy settings
- `TemplatesSection.tsx` - Template library
- `AutomationSection.tsx` - Automation rules
- `SLASection.tsx` - SLA definitions
- `PermissionsSection.tsx` - Role permissions
- `AuditLogsSection.tsx` - Audit trail and delivery logs

### Modal Dialogs
- `SenderIdentityDialog.tsx` - Create/edit sender identity
- `TemplateBuilderDialog.tsx` - Template builder (stub)
- `AutomationRuleDialog.tsx` - Automation rule builder (stub)
- `SLADialog.tsx` - SLA configuration (stub)

---

## Acceptance Criteria

✅ Messaging behavior always reflects Communications Settings  
✅ Channels can be enabled/disabled without code changes  
✅ Consent is enforced without exception  
✅ Templates and automation are configurable and safe  
✅ SLA breaches are visible and measurable  
✅ All changes are auditable and reversible  

---

## Future Enhancements

1. **Template Builder**
   - Visual template editor
   - Variable insertion UI
   - Multi-channel preview
   - Template testing

2. **Advanced Automation**
   - Conditional logic builder
   - Multi-step workflows
   - A/B testing support

3. **Analytics Dashboard**
   - Message delivery rates
   - SLA performance metrics
   - Template effectiveness
   - Consent trend analysis

4. **GDPR Compliance**
   - Message history export
   - Consent history export
   - Data retention policies

5. **Integration Testing**
   - Provider sandbox testing
   - Template preview emails
   - Automation dry-run mode

---

## Development Notes

- All modal dialogs currently show stubs except `SenderIdentityDialog`
- Default data is created on first API call if not present
- All audit logs are automatic (no manual logging required)
- Channel availability is cached in store for performance
- Template variables are validated before send (future)

---

## Related Modules

- **Messaging** - Consumes all settings from this module
- **Operational Rules** - Can trigger automated messages
- **Customers** - Contact consent management
- **Dashboard** - Displays SLA and delivery metrics

---

## Migration Notes

When migrating to production database:
- KV store data will need migration scripts
- Audit logs should be preserved
- Default permissions must be recreated
- Channel provider credentials must be configured
