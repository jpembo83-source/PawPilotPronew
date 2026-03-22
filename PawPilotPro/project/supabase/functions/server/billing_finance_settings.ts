// Billing & Finance Settings Backend - MDC Operations Centre
// Handles all financial configuration and governance

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// --- Utility Functions ---

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// --- Payment Providers ---

app.get('/payment-providers', async (c) => {
  const providers = await kv.getByPrefix('billing:provider:');
  return c.json(providers || []);
});

app.put('/payment-providers/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `billing:provider:${id}`;
  
  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Provider not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'payment_provider',
    entity_id: id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// --- Invoice Settings ---

app.get('/invoice-settings', async (c) => {
  const settings = await kv.getByPrefix('billing:invoice_settings:');
  return c.json(settings || []);
});

app.get('/invoice-settings/:id', async (c) => {
  const id = c.req.param('id');
  const settings = await kv.get(`billing:invoice_settings:${id}`);
  if (!settings) {
    return c.json({ error: 'Invoice settings not found' }, 404);
  }
  return c.json(settings);
});

app.put('/invoice-settings/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `billing:invoice_settings:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Invoice settings not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'invoice_settings',
    entity_id: id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// --- Tax Rules ---

app.get('/tax-rules', async (c) => {
  const rules = await kv.getByPrefix('billing:tax:');
  return c.json(rules || []);
});

app.post('/tax-rules', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `billing:tax:${id}`;

  const taxRule = {
    id,
    ...data,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, taxRule);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'tax_rule',
    entity_id: id,
    user_id: data.created_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { after: taxRule },
    created_at: getCurrentTimestamp(),
  });

  return c.json(taxRule, 201);
});

app.put('/tax-rules/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `billing:tax:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Tax rule not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'tax_rule',
    entity_id: id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

app.delete('/tax-rules/:id', async (c) => {
  const id = c.req.param('id');
  const key = `billing:tax:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Tax rule not found' }, 404);
  }

  await kv.del(key);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'tax_rule',
    entity_id: id,
    user_id: 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing },
    created_at: getCurrentTimestamp(),
  });

  return c.json({ success: true });
});

// --- Fees & Penalties ---

app.get('/fees', async (c) => {
  const fees = await kv.getByPrefix('billing:fee:');
  return c.json(fees || []);
});

app.post('/fees', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `billing:fee:${id}`;

  const fee = {
    id,
    ...data,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, fee);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'fee',
    entity_id: id,
    user_id: data.created_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { after: fee },
    created_at: getCurrentTimestamp(),
  });

  return c.json(fee, 201);
});

app.put('/fees/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `billing:fee:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Fee not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'fee',
    entity_id: id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

app.delete('/fees/:id', async (c) => {
  const id = c.req.param('id');
  const key = `billing:fee:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Fee not found' }, 404);
  }

  await kv.del(key);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'fee',
    entity_id: id,
    user_id: 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing },
    created_at: getCurrentTimestamp(),
  });

  return c.json({ success: true });
});

// --- Refund Settings ---

app.get('/refund-settings', async (c) => {
  const settings = await kv.get('billing:refund_settings');
  return c.json(settings || null);
});

app.put('/refund-settings', async (c) => {
  const data = await c.req.json();
  const key = 'billing:refund_settings';

  const existing = await kv.get(key);

  const updated = {
    id: existing?.id || generateId(),
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'refund_settings',
    entity_id: updated.id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// --- Refund Records ---

app.get('/refunds', async (c) => {
  const refunds = await kv.getByPrefix('billing:refund_record:');
  return c.json(refunds || []);
});

app.post('/refunds', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `billing:refund_record:${id}`;

  const refund = {
    id,
    ...data,
    status: 'pending_approval',
    created_at: getCurrentTimestamp(),
  };

  await kv.set(key, refund);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'refund_issued',
    entity_type: 'refund',
    entity_id: id,
    user_id: data.requested_by || 'system',
    user_name: 'User',
    user_role: 'staff',
    justification: data.reason,
    created_at: getCurrentTimestamp(),
  });

  return c.json(refund, 201);
});

// --- Credit Records ---

app.get('/credits', async (c) => {
  const credits = await kv.getByPrefix('billing:credit_record:');
  return c.json(credits || []);
});

app.post('/credits', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `billing:credit_record:${id}`;

  const credit = {
    id,
    ...data,
    remaining_balance: data.amount,
    created_at: getCurrentTimestamp(),
  };

  await kv.set(key, credit);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'credit_applied',
    entity_type: 'credit',
    entity_id: id,
    user_id: data.created_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    justification: data.reason,
    created_at: getCurrentTimestamp(),
  });

  return c.json(credit, 201);
});

// --- Membership Billing Rules ---

app.get('/membership-billing-rules', async (c) => {
  const rules = await kv.get('billing:membership_billing_rules');
  return c.json(rules || null);
});

app.put('/membership-billing-rules', async (c) => {
  const data = await c.req.json();
  const key = 'billing:membership_billing_rules';

  const existing = await kv.get(key);

  const updated = {
    id: existing?.id || generateId(),
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'membership_billing_rules',
    entity_id: updated.id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// --- Financial Permissions ---

app.get('/permissions', async (c) => {
  const permissions = await kv.getByPrefix('billing:permission:');
  return c.json(permissions || []);
});

app.put('/permissions/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `billing:permission:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Permission not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'permission',
    entity_id: id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// --- Approval Rules ---

app.get('/approval-rules', async (c) => {
  const rules = await kv.getByPrefix('billing:approval:');
  return c.json(rules || []);
});

app.post('/approval-rules', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `billing:approval:${id}`;

  const rule = {
    id,
    ...data,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, rule);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'approval_rule',
    entity_id: id,
    user_id: data.created_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { after: rule },
    created_at: getCurrentTimestamp(),
  });

  return c.json(rule, 201);
});

app.put('/approval-rules/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `billing:approval:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Approval rule not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'approval_rule',
    entity_id: id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

app.delete('/approval-rules/:id', async (c) => {
  const id = c.req.param('id');
  const key = `billing:approval:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Approval rule not found' }, 404);
  }

  await kv.del(key);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'approval_rule',
    entity_id: id,
    user_id: 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing },
    created_at: getCurrentTimestamp(),
  });

  return c.json({ success: true });
});

// --- Export Configurations ---

app.get('/export-configs', async (c) => {
  const configs = await kv.getByPrefix('billing:export_config:');
  return c.json(configs || []);
});

app.post('/export-configs', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `billing:export_config:${id}`;

  const config = {
    id,
    ...data,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, config);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'export_config',
    entity_id: id,
    user_id: data.created_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { after: config },
    created_at: getCurrentTimestamp(),
  });

  return c.json(config, 201);
});

app.put('/export-configs/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `billing:export_config:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Export configuration not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'export_config',
    entity_id: id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

app.delete('/export-configs/:id', async (c) => {
  const id = c.req.param('id');
  const key = `billing:export_config:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Export configuration not found' }, 404);
  }

  await kv.del(key);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'export_config',
    entity_id: id,
    user_id: 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing },
    created_at: getCurrentTimestamp(),
  });

  return c.json({ success: true });
});

// --- Export Records ---

app.get('/exports', async (c) => {
  const exports = await kv.getByPrefix('billing:export_record:');
  return c.json(exports || []);
});

app.post('/exports', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `billing:export_record:${id}`;

  const exportRecord = {
    id,
    ...data,
    generated_at: getCurrentTimestamp(),
  };

  await kv.set(key, exportRecord);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'export_generated',
    entity_type: 'export',
    entity_id: id,
    user_id: data.generated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    created_at: getCurrentTimestamp(),
  });

  return c.json(exportRecord, 201);
});

// --- Audit Controls ---

app.get('/audit-controls', async (c) => {
  const controls = await kv.get('billing:audit_controls');
  return c.json(controls || null);
});

app.put('/audit-controls', async (c) => {
  const data = await c.req.json();
  const key = 'billing:audit_controls';

  const existing = await kv.get(key);

  const updated = {
    id: existing?.id || generateId(),
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`billing:audit:${generateId()}`, {
    action_type: 'settings_changed',
    entity_type: 'audit_controls',
    entity_id: updated.id,
    user_id: data.updated_by || 'system',
    user_name: 'System Admin',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// --- Audit Logs ---

app.get('/audit-logs', async (c) => {
  const logs = await kv.getByPrefix('billing:audit:');
  // Sort by created_at descending
  const sorted = (logs || []).sort((a: any, b: any) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return c.json(sorted);
});

// --- Statistics ---

app.get('/stats', async (c) => {
  const providers = await kv.getByPrefix('billing:provider:');
  const taxRules = await kv.getByPrefix('billing:tax:');
  const fees = await kv.getByPrefix('billing:fee:');
  const refunds = await kv.getByPrefix('billing:refund_record:');
  const credits = await kv.getByPrefix('billing:credit_record:');
  const exportConfigs = await kv.getByPrefix('billing:export_config:');
  const auditLogs = await kv.getByPrefix('billing:audit:');

  const enabledProviders = (providers || []).filter((p: any) => p.enabled);
  const activeTaxRules = (taxRules || []).filter((r: any) => r.is_active);
  const activeFees = (fees || []).filter((f: any) => f.is_active);
  const pendingRefunds = (refunds || []).filter((r: any) => r.status === 'pending_approval');
  const totalCredits = (credits || []).reduce((sum: number, c: any) => sum + c.remaining_balance, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentAuditLogs = (auditLogs || []).filter(
    (log: any) => new Date(log.created_at) > thirtyDaysAgo
  );

  return c.json({
    total_providers_enabled: enabledProviders.length,
    total_tax_rules_active: activeTaxRules.length,
    total_fees_defined: activeFees.length,
    pending_refund_approvals: pendingRefunds.length,
    total_credits_outstanding: totalCredits,
    export_configurations: (exportConfigs || []).length,
    audit_log_entries_last_30_days: recentAuditLogs.length,
  });
});

// --- Initialize Seed Data ---

app.post('/seed', async (c) => {
  // Payment Providers
  await kv.set('billing:provider:stripe', {
    id: 'stripe',
    provider_name: 'stripe',
    enabled: true,
    environment: 'test',
    supported_currencies: ['CHF', 'EUR', 'GBP'],
    supported_payment_methods: ['card', 'apple_pay', 'google_pay', 'sepa_direct_debit'],
    stripe_config: {},
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    created_by: 'system',
    updated_by: 'system',
  });

  await kv.set('billing:provider:bank_transfer', {
    id: 'bank_transfer',
    provider_name: 'bank_transfer',
    enabled: true,
    environment: 'live',
    supported_currencies: ['CHF', 'EUR'],
    supported_payment_methods: ['bank_transfer'],
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    created_by: 'system',
    updated_by: 'system',
  });

  // Global Invoice Settings
  await kv.set('billing:invoice_settings:global', {
    id: 'global',
    location_id: null,
    numbering_format: {
      prefix: 'INV',
      sequence: 'global',
      next_number: 1001,
    },
    timing: {
      mode: 'hybrid',
      consolidation_day: 1,
    },
    due_terms: 'net_30',
    default_language: 'en',
    footer_text: 'Thank you for your business.',
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    updated_by: 'system',
  });

  // Default VAT Rule
  await kv.set('billing:tax:default_vat', {
    id: 'default_vat',
    name: 'Standard VAT (Switzerland)',
    tax_type: 'VAT',
    rate: 7.7,
    service_categories: ['daycare', 'grooming', 'boutique', 'transport', 'overnights'],
    location_id: null,
    effective_from: getCurrentTimestamp(),
    effective_until: null,
    vat_number: 'CHE-123.456.789 MWST',
    is_active: true,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    created_by: 'system',
    updated_by: 'system',
  });

  // Default Fees
  const feeTypes = [
    {
      id: 'late_pickup',
      fee_type: 'late_pickup',
      name: 'Late Pickup Fee',
      description: 'Charged per 15-minute block after grace period',
      calculation_method: 'per_block',
      amount: 20,
      block_size_minutes: 15,
      grace_period_minutes: 10,
      location_id: null,
      requires_approval_to_waive: true,
      is_active: true,
    },
    {
      id: 'no_show',
      fee_type: 'no_show',
      name: 'No-Show Fee',
      description: 'Charged when customer fails to show for booking',
      calculation_method: 'fixed',
      amount: 50,
      location_id: null,
      requires_approval_to_waive: true,
      is_active: true,
    },
    {
      id: 'late_cancellation',
      fee_type: 'late_cancellation',
      name: 'Late Cancellation Fee',
      description: 'Charged for cancellations within 24 hours',
      calculation_method: 'percentage',
      amount: 50,
      location_id: null,
      requires_approval_to_waive: false,
      is_active: true,
    },
  ];

  for (const fee of feeTypes) {
    await kv.set(`billing:fee:${fee.id}`, {
      ...fee,
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
      created_by: 'system',
      updated_by: 'system',
    });
  }

  // Refund Settings
  await kv.set('billing:refund_settings', {
    id: 'default',
    refund_methods: ['original_payment_method', 'account_credit'],
    approval_threshold_chf: 100,
    max_refund_amount_by_role: {
      admin: 999999,
      manager: 500,
      assistant_manager: 100,
    },
    credit_expiry_days: 365,
    credits_transferable: false,
    require_justification: true,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    updated_by: 'system',
  });

  // Membership Billing Rules
  await kv.set('billing:membership_billing_rules', {
    id: 'default',
    billing_cycle: 'monthly_fixed',
    billing_day: 1,
    proration_enabled: true,
    proration_rules: {
      mid_cycle_join: 'prorated',
      pause_handling: 'pause_billing',
    },
    failed_payment_handling: {
      retry_schedule: [1, 3, 7],
      grace_period_days: 7,
      auto_suspend_after_days: 14,
    },
    multi_dog_discount_enabled: true,
    multi_dog_discount_config: {
      second_dog_discount_percent: 10,
      third_plus_discount_percent: 15,
    },
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    updated_by: 'system',
  });

  // Financial Permissions
  const roles = ['admin', 'manager', 'assistant_manager', 'staff'];
  const permissions = [
    {
      role: 'admin',
      can_view_financial_data: true,
      can_issue_refunds: true,
      can_apply_credits: true,
      can_waive_fees: true,
      can_export_reports: true,
      can_modify_invoices: true,
      max_refund_amount: null,
      bypass_approvals: true,
    },
    {
      role: 'manager',
      can_view_financial_data: true,
      can_issue_refunds: true,
      can_apply_credits: true,
      can_waive_fees: true,
      can_export_reports: true,
      can_modify_invoices: false,
      max_refund_amount: 500,
      bypass_approvals: false,
    },
    {
      role: 'assistant_manager',
      can_view_financial_data: true,
      can_issue_refunds: true,
      can_apply_credits: false,
      can_waive_fees: false,
      can_export_reports: false,
      can_modify_invoices: false,
      max_refund_amount: 100,
      bypass_approvals: false,
    },
    {
      role: 'staff',
      can_view_financial_data: false,
      can_issue_refunds: false,
      can_apply_credits: false,
      can_waive_fees: false,
      can_export_reports: false,
      can_modify_invoices: false,
      max_refund_amount: 0,
      bypass_approvals: false,
    },
  ];

  for (const perm of permissions) {
    await kv.set(`billing:permission:${perm.role}`, {
      id: perm.role,
      ...perm,
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
      updated_by: 'system',
    });
  }

  // Approval Rules
  await kv.set('billing:approval:refund_100', {
    id: 'refund_100',
    action_type: 'refund',
    threshold_amount: 100,
    currency: 'CHF',
    requires_approval: true,
    approver_roles: ['admin', 'manager'],
    notification_enabled: true,
    is_active: true,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    created_by: 'system',
    updated_by: 'system',
  });

  // Audit Controls
  await kv.set('billing:audit_controls', {
    id: 'default',
    invoice_soft_lock_enabled: true,
    invoice_lock_after_days: 7,
    prevent_financial_record_deletion: true,
    require_justification_for_adjustments: true,
    enforce_sequential_invoice_numbering: true,
    alert_on_large_refunds: true,
    large_refund_threshold: 500,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    updated_by: 'system',
  });

  return c.json({ success: true, message: 'Billing & Finance settings seeded successfully' });
});

export default app;
