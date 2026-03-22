# Operational Rules Engine

## Overview

The Operational Rules Engine is a production-grade, configuration-driven rules system that allows Admins and Managers to define, enforce, and audit operational policies without code changes.

**Key principle**: This is NOT a generic scripting engine. It is a controlled, safe rule builder with predefined rule types.

## Core Capabilities

### ✅ Implemented (Phase 1)

- **Backend API**: Full CRUD operations for rules, evaluation engine, audit logging
- **Rule Management UI**: List, view, filter, enable/disable, delete rules
- **Server-Side Enforcement**: Rule evaluation API with condition matching
- **Audit Trail**: Complete change history with reasons
- **Location Overrides**: Infrastructure for location-specific rule customisation
- **Rule Templates**: 3 predefined templates to get started quickly
- **Multi-Module Support**: Daycare, Grooming, Transport, Boutique, Incidents, Communications, Billing
- **Safe Evaluation**: Predefined operators (no arbitrary code execution)

### 🚧 To Be Implemented (Phase 2+)

- **Visual Rule Builder**: Step-by-step wizard for creating/editing rules
- **Test Mode**: Simulate rule evaluation with sample inputs
- **Location Override UI**: Full interface for managers to override org rules
- **Advanced Templates**: More predefined rule patterns
- **Rule Dependencies**: Rules that depend on other rules
- **Time-Based Rules**: Rules active only during specific hours/days
- **Integration Hooks**: Auto-trigger rules from booking/check-in/etc. events

## Architecture

### Data Model

```
operational_rule:{ruleId}        - Complete rule definition
rule_override:{orgRuleId}:{locId} - Location override mappings
rule_audit:{auditId}             - Audit log entries
```

### Rule Structure

Every rule has:
- **Identity**: Name, description, module, category, type
- **Scope**: Organisation-wide or location-specific
- **Trigger**: Event that causes evaluation (e.g., daycare.check_in)
- **Conditions**: What must be true for the rule to fire
- **Actions**: What happens when rule fires (warn/block/escalate/auto-update)

## Rule Categories

### 1. Booking & Cancellation

**Use cases:**
- Cancellation windows (must cancel X hours before)
- No-show tracking and penalties
- Booking cut-off times (same-day bookings until 09:00)
- Waitlist automation

### 2. Check-In / Check-Out Guardrails

**Use cases:**
- Block check-in if vaccination expired
- Warn if vaccination expires soon
- Show behaviour flag warnings
- Require field completion (feeding notes, medication consent)

### 3. Grooming Rules

**Use cases:**
- Appointment buffer times (prep/cleanup)
- Late arrival thresholds
- Mandatory pre-check questions
- Service-specific requirements

### 4. Transportation Rules

**Use cases:**
- Route finalisation deadlines
- Pickup/drop-off time windows
- Capacity constraints per vehicle
- Failed pickup handling

### 5. Boutique Rules

**Use cases:**
- Discount limits by role
- Refund approval thresholds
- Stock movement controls

### 6. Incident & Safety

**Use cases:**
- Severity-based escalation (auto-notify managers for High/Critical)
- Lock incident editing after closure
- Mandatory fields based on severity
- Emergency mode behaviour

### 7. Communications

**Use cases:**
- Response SLA enforcement (2-hour response target)
- Auto-notifications (booking confirmed, service completed)
- Consent enforcement (block if opted out)

### 8. Billing & Fees

**Use cases:**
- Late pickup fee calculation
- Cancellation/no-show fees
- Refund approval workflows
- Membership credit usage limits

## Rule Types (Safe, Predefined)

### Threshold Rule
IF metric crosses threshold THEN warn/block/escalate

**Example**: Block check-in if vaccination expired
```typescript
{
  type: 'threshold',
  conditions: [
    { field: 'pet.vaccination.isExpired', operator: 'equals', value: true }
  ],
  actions: [
    { type: 'block', message: 'Cannot check in - vaccination expired' }
  ]
}
```

### Time Window Rule
IF action outside allowed time window THEN warn/block

**Example**: Warn if cancelling less than 24 hours before booking
```typescript
{
  type: 'time_window',
  conditions: [
    { field: 'hoursUntilBooking', operator: 'less_than', value: 24 }
  ],
  actions: [
    { type: 'warn', message: 'Late cancellation - fee may apply' }
  ]
}
```

### Requirement Rule
IF required condition not met THEN block

**Example**: Require feeding notes at check-in
```typescript
{
  type: 'requirement',
  conditions: [
    { field: 'feedingNotes', operator: 'is_empty', value: true }
  ],
  actions: [
    { type: 'block', message: 'Feeding notes are required' }
  ]
}
```

### Limit Rule
IF count/usage exceeds limit THEN restrict

**Example**: Limit discount to 20% for staff
```typescript
{
  type: 'limit',
  conditions: [
    { field: 'discountPercentage', operator: 'greater_than', value: 20 },
    { field: 'userRole', operator: 'equals', value: 'staff' }
  ],
  actions: [
    { type: 'block', message: 'Maximum discount for staff is 20%' }
  ]
}
```

### Workflow Rule
IF event occurs THEN update status + notify

**Example**: Auto-escalate high severity incidents
```typescript
{
  type: 'workflow',
  conditions: [
    { field: 'severity', operator: 'in_list', value: ['high', 'critical'] }
  ],
  actions: [
    { 
      type: 'escalate', 
      notifyRoles: ['manager', 'admin'],
      createTask: true 
    }
  ]
}
```

## Condition Operators

Safe, predefined operators:
- `equals`, `not_equals`
- `greater_than`, `less_than`, `greater_than_or_equal`, `less_than_or_equal`
- `contains`, `not_contains`
- `in_list`, `not_in_list`
- `is_expired`, `expires_within` (for dates)
- `is_empty`, `is_not_empty`

## Rule Evaluation

### Server-Side Enforcement

**Critical**: Rules are ALWAYS evaluated server-side. The UI may pre-emptively warn/block, but the API is the source of truth.

### Evaluation Flow

1. Event triggered (e.g., check-in attempted)
2. Find all active rules for that event + module + location
3. Apply location overrides (if any)
4. Sort rules by priority (highest first)
5. Evaluate each rule's conditions
6. Execute actions for triggered rules
7. Return combined result (allow/block + warnings + escalations)

### API Call Example

```typescript
import { evaluateRules } from '@/modules/operational-rules/api';

const result = await evaluateRules({
  event: 'daycare.check_in',
  module: 'daycare',
  locationId: 'loc_123',
  userId: user.id,
  data: {
    bookingId: 'booking_456'
  },
  pet: {
    id: 'pet_789',
    vaccination: {
      expiryDate: '2024-01-15',
      isExpired: true
    },
    behaviourFlags: ['reactive']
  },
  timestamp: new Date().toISOString()
});

if (result.blocked) {
  alert(result.blockReason);
  return; // Prevent action
}

if (result.warnings.length > 0) {
  // Show warnings, require acknowledgement if needed
  showWarnings(result.warnings);
}

if (result.escalations.length > 0) {
  // Process escalations (notify, create tasks, etc.)
  handleEscalations(result.escalations);
}

// Proceed with action
```

## Access Control

### Roles

**Admin:**
- Create/edit/disable any rule (org-wide or location-specific)
- Set whether location overrides are allowed
- View full audit log

**Manager:**
- Create/edit location overrides (only for assigned locations, only if allowed by org rule)
- View rules for their locations
- View audit log for their locations

**Staff:**
- View rules (read-only)
- See rule evaluation results (warnings, blocks)

### Permissions

- `operational_rules.read` - View rules
- `operational_rules.create` - Create new rules
- `operational_rules.update` - Edit/enable/disable rules
- `operational_rules.delete` - Delete rules (admin only)

## Audit Trail

Every rule change requires:
- **Actor**: Who made the change
- **Timestamp**: When it occurred
- **Before/After**: What changed
- **Reason**: Why (required for disable/delete)

Audit entries are immutable and stored indefinitely.

### Required Reasons

- **Disabling a rule**: Must provide reason (e.g., "Temporary policy change during holiday period")
- **Deleting a rule**: Must provide reason (e.g., "Policy no longer applicable")
- **Tightening a rule**: Recommended to provide reason for operational context

## Scoping & Overrides

### Organisation-Level Rules

- Apply to ALL locations by default
- Admin can set `allowLocationOverride: true` to permit customisation

### Location-Level Rules

- **Overrides**: Location-specific version of an org rule (only if allowed)
- **Location-only**: Rules that exist only at a specific location (not overrides)

### Conflict Resolution

1. Location override takes precedence over org rule
2. If module is disabled at a location, module rules are inactive
3. Rules are evaluated by priority (highest first)

## Predefined Templates

### 1. Block Check-in if Vaccination Expired

```typescript
{
  module: 'daycare',
  category: 'check_in_out',
  event: 'daycare.check_in',
  conditions: [
    { field: 'pet.vaccination.isExpired', operator: 'equals', value: true }
  ],
  actions: [
    { 
      type: 'block',
      message: 'Cannot check in - vaccination has expired',
      requireAcknowledgement: true
    }
  ]
}
```

### 2. Warn if Vaccination Expiring Soon

```typescript
{
  module: 'daycare',
  category: 'check_in_out',
  event: 'daycare.check_in',
  conditions: [
    { field: 'pet.vaccination.expiryDate', operator: 'expires_within', value: 7 }
  ],
  actions: [
    { 
      type: 'warn',
      message: 'Vaccination expires soon. Please remind owner to renew.'
    }
  ]
}
```

### 3. Late Cancellation Warning

```typescript
{
  module: 'daycare',
  category: 'booking_cancellation',
  event: 'booking.cancel',
  conditions: [
    { field: 'hoursUntilBooking', operator: 'less_than', value: 24 }
  ],
  actions: [
    { 
      type: 'warn',
      message: 'Late cancellation - less than 24 hours notice. Fee may apply.',
      requireAcknowledgement: true
    }
  ]
}
```

## Integration with Modules

### Daycare Module

**Events to trigger**:
- `daycare.check_in` - Before checking in a pet
- `daycare.check_out` - Before checking out a pet
- `daycare.capacity_check` - When checking capacity

**Example integration**:
```typescript
// In check-in flow
const ruleResult = await evaluateRules({
  event: 'daycare.check_in',
  module: 'daycare',
  locationId: selectedLocation.id,
  data: { bookingId },
  pet: petData
});

if (ruleResult.blocked) {
  toast.error(ruleResult.blockReason);
  return;
}

// Proceed with check-in...
```

### Grooming Module

**Events**: `grooming.appointment.create`, `grooming.start`, `grooming.complete`

### Transport Module

**Events**: `transport.route.finalise`, `transport.stop.complete`, `transport.failed_pickup`

### Incidents Module

**Events**: `incident.create`, `incident.escalate`, `incident.close`

### Communications Module

**Events**: `message.inbound`, `message.reply`, `message.sla_breach`

## Development

### Creating Rules Programmatically

```typescript
import { createRule } from '@/modules/operational-rules/api';

const rule = await createRule({
  name: 'Block expired vaccination check-ins',
  description: 'Prevent daycare check-in if pet vaccination is expired',
  module: 'daycare',
  category: 'check_in_out',
  type: 'requirement',
  scope: 'organisation',
  scopeId: 'ORG',
  scopeName: 'MDC Operations',
  event: 'daycare.check_in',
  conditions: [
    {
      id: 'cond_1',
      field: 'pet.vaccination.isExpired',
      operator: 'equals',
      value: true,
      description: 'Vaccination is expired'
    }
  ],
  actions: [
    {
      id: 'act_1',
      type: 'block',
      message: 'Cannot check in - vaccination has expired. Please update records.',
      requireAcknowledgement: true
    }
  ],
  status: 'active',
  priority: 100,
  createdBy: user.id,
  createdByName: user.user_metadata.name
});
```

### Updating Rules

```typescript
import { updateRule } from '@/modules/operational-rules/api';

await updateRule(ruleId, {
  status: 'disabled',
  updatedBy: user.id,
  updatedByName: user.user_metadata.name,
  disabledReason: 'Policy change - temporary suspension during renovation'
});
```

### Store Usage

```typescript
import { useOperationalRulesStore } from '@/modules/operational-rules';

const {
  rules,
  filters,
  setFilters,
  openBuilder,
  selectRule
} = useOperationalRulesStore();

// Filter to active daycare rules
setFilters({ module: 'daycare', status: 'active' });

// Open rule builder with a template
openBuilder(template);
```

## Security

### Server-Side Enforcement

- **Never trust the client**: All rule evaluation happens server-side
- **API validates** scope, permissions, and rule integrity
- **Audit logs** are append-only and immutable

### Permission Checks

- Creating org-wide rules requires `admin` role
- Location overrides require `manager` role + assignment to that location
- Disabling/deleting rules requires explicit permissions

## Best Practices

1. **Start with templates**: Use predefined templates and customise
2. **Test thoroughly**: Use test mode (Phase 2) before activating
3. **Document reasons**: Always provide clear reasons for disabling/deleting
4. **Monitor audit log**: Review changes regularly
5. **Use priority carefully**: Higher priority = evaluated first
6. **Be specific**: Narrow scope to relevant modules/events
7. **Keep messages clear**: Users see these messages - make them actionable
8. **Avoid over-blocking**: Prefer warnings with acknowledgement over hard blocks where possible

## Troubleshooting

**Rules not triggering:**
- Check rule status is 'active'
- Verify event name matches exactly
- Confirm location/module scope is correct
- Check priority order (higher priority first)

**Unexpected blocks:**
- Review conditions carefully (all must be true)
- Check for location overrides
- View audit log for recent changes

**Can't create location override:**
- Verify org rule has `allowLocationOverride: true`
- Confirm user is manager for that location
- Check `operational_rules.create` permission

---

**Status**: ✅ Phase 1 Complete - Core engine and management UI operational  
**Next Phase**: Visual rule builder wizard + integration with live module events  
**Owner**: MDC Operations Platform Team  
**Last Updated**: December 2024
