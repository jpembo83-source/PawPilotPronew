# Billing & Finance Settings Module

**MDC Operations Centre - Production-Grade Financial Configuration & Governance**

## Overview

The Billing & Finance Settings module serves as the comprehensive configuration and governance layer for all financial operations within the MDC Operations Platform. This is not a billing execution module - it defines **how money flows through the system**.

All operational billing behaviour must be driven by settings defined here and enforced server-side.

## Access Control

### Admin
- Full access to all Billing & Finance settings
- Can configure providers, tax rules, invoice behaviour, and approvals
- Can override all restrictions

### Manager
- Can manage location-level billing rules and operational settings if permitted
- Cannot change global financial providers unless explicitly allowed
- Subject to approval thresholds

### Assistant Manager & Staff
- **No access** to Billing & Finance Settings
- All access enforced server-side

## Architecture

### Module Structure
```
/src/app/modules/billing-finance-settings/
├── BillingFinanceSettingsPage.tsx    # Main page with tabbed interface
├── types.ts                          # TypeScript type definitions
├── api.ts                            # API layer for backend communication
├── store.ts                          # Zustand state management
├── index.ts                          # Module exports
├── components/
│   ├── PaymentProvidersSection.tsx
│   ├── InvoiceConfigSection.tsx
│   ├── TaxesVATSection.tsx
│   ├── FeesPenaltiesSection.tsx
│   ├── RefundsCreditsSection.tsx
│   ├── MembershipBillingSection.tsx
│   ├── FinancialPermissionsSection.tsx
│   ├── AccountingExportsSection.tsx
│   ├── AuditControlsSection.tsx
│   └── modals/
│       ├── TaxRuleDialog.tsx
│       └── FeeDialog.tsx
└── README.md
```

### Backend Routes
```
/supabase/functions/server/billing_finance_settings.ts
```

All routes prefixed with: `/make-server-fc003b23/billing-finance`

## 9 Configuration Sections

### 1. Payment Providers
**Purpose:** Define how customers pay

- **Stripe** (primary) - Cards, Apple Pay, Google Pay, SEPA Direct Debit
- **Bank Transfer** (manual)

**Features:**
- Enable/disable providers
- Environment switching (live/test)
- Currency support configuration
- Payment method restrictions per location

### 2. Invoice Configuration
**Purpose:** Control how and when invoices are created

**Settings:**
- Invoice numbering format (prefix, sequence, next number)
- Invoice timing (immediate, monthly consolidated, hybrid)
- Due terms (immediate, net 7/14/30/60 days)
- Default language (EN, DE, FR, IT)
- Custom footer text

**Rules:**
- Invoice behaviour applies per location with optional overrides
- Settings affect future invoices only
- Historical invoices retain original configurations

### 3. Taxes & VAT
**Purpose:** Ensure compliant tax handling

**Configuration:**
- Tax registration details (VAT number)
- Default tax rates
- Tax categories per service type (Daycare, Grooming, Boutique, Transport, Overnights)
- Location-based tax overrides
- Effective date ranges

**Rules:**
- Tax applied at invoice time using resolved pricing
- Historical invoices retain original tax calculations
- Multiple active rules supported with date-based precedence

### 4. Fees & Penalties
**Purpose:** Define operational fees that affect billing

**Configurable Fees:**
- **Late Pickup Fee** - Per minute/block with grace period
- **No-Show Fee** - Fixed amount
- **Late Cancellation Fee** - Fixed or percentage
- **Transport Failure Fee** - Custom configuration

**Rules:**
- Fees implemented as billable service line items
- Fee application rules align with Operational Rules
- Permissions required to waive or override fees
- Approval workflows for waivers

### 5. Refunds & Credits
**Purpose:** Control how money is returned or credited

**Settings:**
- Refund methods (original payment method, account credit)
- Refund limits by role (Admin, Manager, Assistant Manager)
- Approval thresholds
- Credit expiry rules
- Credit transferability

**Workflow:**
- All refunds and credits must be explicitly created
- Linked to invoice or booking
- Fully auditable with justification requirements

### 6. Membership Billing Rules
**Purpose:** Control recurring billing behaviour

**Settings:**
- Billing cycle (monthly fixed date, rolling from signup)
- Proration rules (mid-cycle joins, pauses)
- Failed payment handling (retry schedule, grace period, auto-suspend)
- Multi-dog discount configuration (2nd dog %, 3rd+ dog %)

**Features:**
- Configurable, not hardcoded
- Location-specific overrides supported
- Integration with payment providers

### 7. Financial Permissions & Approvals
**Purpose:** Control who can perform financial actions

**Configurable Permissions:**
- View financial data
- Issue refunds
- Apply credits
- Waive fees
- Export financial reports
- Modify invoices

**Approval Rules:**
- Refunds above threshold (e.g., CHF 100)
- Manual invoice adjustments
- Fee waivers
- Large credit applications

**Features:**
- Role-based permission matrix
- Threshold-based approvals
- Approval bypass for authorized roles

### 8. Accounting & Exports
**Purpose:** Support reconciliation and reporting

**Export Formats:**
- CSV
- DATEV (German accounting)
- Xero
- QuickBooks

**Export Scope:**
- Per location
- Organisation-wide
- Custom date ranges

**Scheduled Exports:**
- Daily
- Weekly
- Monthly
- Manual on-demand

**Rules:**
- Exports are read-only snapshots
- Export actions are logged
- Email delivery to configured recipients

### 9. Audit & Controls
**Purpose:** Ensure financial traceability

**Audit Coverage:**
- Invoice creation and edits
- Payment receipts
- Refunds and credits
- Fee application and waivers
- Settings changes

**Controls:**
- Invoice soft-lock (prevent edits after X days)
- Prevent deletion of financial records
- Require justification for manual adjustments
- Enforce sequential invoice numbering
- Alert on large refunds

**Features:**
- Comprehensive audit log
- Immutable financial records
- Compliance-ready reporting
- Real-time change tracking

## Integration with Other Modules

### Services & Pricing
All invoice line items originate from resolved pricing rules defined in Services & Pricing module.

### Bookings (Daycare / Grooming / Overnights)
Billing rules determine invoice timing and structure for all booking types.

### Messaging
Payment confirmations and overdue reminders respect Communications Settings templates and consent policies.

### Dashboard
Financial widgets use these settings to calculate metrics and display accurate financial data.

### Operational Rules
Fee application rules can reference operational rules (e.g., late pickup triggers fee after grace period).

## Data Model (High Level)

- `payment_providers` - Payment method configurations
- `invoice_settings` - Invoice generation rules
- `tax_rules` - VAT/tax rate definitions
- `fees` - Fee and penalty definitions
- `refunds` - Refund transaction records
- `credits` - Account credit records
- `memberships` - Recurring billing rules
- `billing_permissions` - Role-based financial permissions
- `approvals` - Approval rule configurations
- `financial_exports` - Export configurations and records
- `audit_log` - Complete financial audit trail

## Key Features

### ✅ Configuration-Driven
- No hardcoded billing logic
- All behaviour defined through settings
- Server-side enforcement

### ✅ Multi-Location Support
- Global defaults with location overrides
- Per-location provider restrictions
- Location-specific tax rates

### ✅ Role-Based Governance
- Granular permission control
- Approval workflows
- Audit trail for accountability

### ✅ Compliance-Ready
- Immutable financial records
- Complete audit logging
- Sequential invoice numbering
- Tax calculation preservation

### ✅ Historical Data Protection
- Settings changes affect future transactions only
- Historical invoices never altered
- Complete version history

## Usage

### Seeding Default Data
```typescript
import { useBillingFinanceSettingsStore } from './modules/billing-finance-settings';

const { seedData } = useBillingFinanceSettingsStore();

// Creates default providers, tax rules, fees, permissions, etc.
await seedData();
```

### Loading Settings
```typescript
const { loadAll, paymentProviders, taxRules, fees } = useBillingFinanceSettingsStore();

useEffect(() => {
  loadAll(); // Loads all settings on mount
}, [loadAll]);
```

### Updating Configuration
```typescript
const { updateInvoiceSettings } = useBillingFinanceSettingsStore();

await updateInvoiceSettings('global', {
  due_terms: 'net_30',
  updated_by: 'current-user-id',
});
```

### Creating Tax Rules
```typescript
const { createTaxRule } = useBillingFinanceSettingsStore();

await createTaxRule({
  name: 'Reduced VAT (Food)',
  tax_type: 'VAT',
  rate: 2.5,
  service_categories: ['boutique'],
  effective_from: '2024-01-01',
  is_active: true,
  created_by: 'current-user-id',
});
```

## API Endpoints

### Payment Providers
- `GET /billing-finance/payment-providers`
- `PUT /billing-finance/payment-providers/:id`

### Invoice Settings
- `GET /billing-finance/invoice-settings`
- `PUT /billing-finance/invoice-settings/:id`

### Tax Rules
- `GET /billing-finance/tax-rules`
- `POST /billing-finance/tax-rules`
- `PUT /billing-finance/tax-rules/:id`
- `DELETE /billing-finance/tax-rules/:id`

### Fees
- `GET /billing-finance/fees`
- `POST /billing-finance/fees`
- `PUT /billing-finance/fees/:id`
- `DELETE /billing-finance/fees/:id`

### Refunds & Credits
- `GET /billing-finance/refund-settings`
- `PUT /billing-finance/refund-settings`
- `GET /billing-finance/refunds`
- `POST /billing-finance/refunds`
- `GET /billing-finance/credits`
- `POST /billing-finance/credits`

### Permissions & Approvals
- `GET /billing-finance/permissions`
- `PUT /billing-finance/permissions/:id`
- `GET /billing-finance/approval-rules`
- `POST /billing-finance/approval-rules`
- `PUT /billing-finance/approval-rules/:id`
- `DELETE /billing-finance/approval-rules/:id`

### Exports & Audit
- `GET /billing-finance/export-configs`
- `POST /billing-finance/export-configs`
- `GET /billing-finance/audit-controls`
- `PUT /billing-finance/audit-controls`
- `GET /billing-finance/audit-logs`

### Statistics
- `GET /billing-finance/stats`

### Seeding
- `POST /billing-finance/seed`

## Acceptance Criteria

✅ Billing behaviour is fully driven by settings, not code  
✅ Financial data is consistent, auditable, and immutable where required  
✅ Permissions and approvals prevent accidental financial actions  
✅ Multi-location billing works correctly  
✅ Historical invoices and payments are never altered by settings changes  
✅ All actions are logged with user, timestamp, and justification  
✅ Role-based access control enforced server-side  
✅ British English throughout  

## Future Enhancements

- Advanced approval workflows with multi-level sign-off
- Integration with external accounting systems (API sync)
- Payment provider webhooks for real-time status updates
- Advanced financial reporting and analytics
- Automated VAT/tax filing preparation
- Currency conversion and multi-currency support
- Payment plans and installment configurations
- Dunning workflows for overdue payments

## Support

For questions or issues with the Billing & Finance Settings module, contact the development team or refer to the main platform documentation.

---

**Last Updated:** December 2024  
**Module Version:** 1.0.0  
**Compliance:** Swiss VAT, GDPR, Financial Data Protection
