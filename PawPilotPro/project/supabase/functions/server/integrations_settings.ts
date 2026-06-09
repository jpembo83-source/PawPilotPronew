// Integrations Settings Backend - MDC Operations Centre
// Manages third-party and internal system integrations with secure credential handling

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth } from './_shared/auth.ts';

const app = new Hono();

// Every integrations-settings route requires a validated user (handles credentials).
app.use('*', requireAuth);

// --- Utility Functions ---

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function hashSecret(secret: string): string {
  // In production, use proper encryption (e.g., AES-256)
  return `hashed_${secret.split('').reverse().join('')}`;
}

// --- Statistics ---

app.get('/stats', async (c) => {
  const integrations = await kv.getByPrefix('integration:connected:');
  const webhooks = await kv.getByPrefix('integration:webhook:');
  const syncJobs = await kv.getByPrefix('integration:sync_job:');
  const alerts = await kv.getByPrefix('integration:alert:');
  const credentials = await kv.getByPrefix('integration:credential:');

  const activeIntegrations = (integrations || []).filter((i: any) => i.status === 'active');
  const errorIntegrations = (integrations || []).filter((i: any) => i.status === 'error');

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentSyncJobs = (syncJobs || []).filter(
    (job: any) => new Date(job.started_at) > twentyFourHoursAgo
  );
  const failedSyncJobs = recentSyncJobs.filter((job: any) => job.status === 'failed');

  const unresolvedAlerts = (alerts || []).filter((a: any) => !a.is_resolved);

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const expiringCredentials = (credentials || []).filter(
    (cred: any) => cred.expires_at && new Date(cred.expires_at) < thirtyDaysFromNow
  );

  return c.json({
    total_integrations: (integrations || []).length,
    active_integrations: activeIntegrations.length,
    integrations_with_errors: errorIntegrations.length,
    webhooks_configured: (webhooks || []).length,
    sync_jobs_last_24h: recentSyncJobs.length,
    failed_sync_jobs_last_24h: failedSyncJobs.length,
    unresolved_alerts: unresolvedAlerts.length,
    credential_expiring_soon: expiringCredentials.length,
  });
});

// --- Integration Catalogue ---

app.get('/catalogue', async (c) => {
  const catalogue = await kv.getByPrefix('integration:catalogue:');
  return c.json(catalogue || []);
});

app.post('/catalogue', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `integration:catalogue:${id}`;

  const entry = {
    id,
    ...data,
    created_at: getCurrentTimestamp(),
  };

  await kv.set(key, entry);
  return c.json(entry, 201);
});

// --- Connected Integrations ---

app.get('/integrations', async (c) => {
  const integrations = await kv.getByPrefix('integration:connected:');
  return c.json(integrations || []);
});

app.get('/integrations/:id', async (c) => {
  const id = c.req.param('id');
  const integration = await kv.get(`integration:connected:${id}`);
  if (!integration) {
    return c.json({ error: 'Integration not found' }, 404);
  }
  return c.json(integration);
});

app.post('/integrations', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `integration:connected:${id}`;

  const integration = {
    id,
    ...data,
    status: 'active',
    health_status: 'healthy',
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, integration);

  // Audit log
  await kv.set(`integration:audit:${generateId()}`, {
    action_type: 'integration_created',
    integration_id: id,
    integration_name: data.name,
    user_id: data.created_by || 'system',
    user_name: 'Admin User',
    user_role: 'admin',
    changes: { after: integration },
    created_at: getCurrentTimestamp(),
  });

  return c.json(integration, 201);
});

app.put('/integrations/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `integration:connected:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`integration:audit:${generateId()}`, {
    action_type: 'integration_updated',
    integration_id: id,
    integration_name: updated.name,
    user_id: data.updated_by || 'system',
    user_name: 'Admin User',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

app.delete('/integrations/:id', async (c) => {
  const id = c.req.param('id');
  const key = `integration:connected:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Integration not found' }, 404);
  }

  await kv.del(key);

  // Audit log
  await kv.set(`integration:audit:${generateId()}`, {
    action_type: 'integration_disabled',
    integration_id: id,
    integration_name: existing.name,
    user_id: 'system',
    user_name: 'Admin User',
    user_role: 'admin',
    changes: { before: existing },
    created_at: getCurrentTimestamp(),
  });

  return c.json({ success: true });
});

// --- Credentials & Secrets ---

app.get('/credentials', async (c) => {
  const credentials = await kv.getByPrefix('integration:credential:');
  // Never return actual credential values
  const sanitised = (credentials || []).map((cred: any) => ({
    ...cred,
    credential_value: undefined, // Never expose
  }));
  return c.json(sanitised);
});

app.post('/credentials', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `integration:credential:${id}`;

  const credential = {
    id,
    ...data,
    credential_value: hashSecret(data.credential_value), // Encrypt in production
    is_encrypted: true,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, credential);

  // Audit log
  await kv.set(`integration:audit:${generateId()}`, {
    action_type: 'credential_rotated',
    integration_id: data.integration_id,
    integration_name: 'Integration',
    user_id: data.created_by || 'system',
    user_name: 'Admin User',
    user_role: 'admin',
    created_at: getCurrentTimestamp(),
  });

  // Return without credential value
  const { credential_value, ...sanitised } = credential;
  return c.json(sanitised, 201);
});

app.delete('/credentials/:id', async (c) => {
  const id = c.req.param('id');
  const key = `integration:credential:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Credential not found' }, 404);
  }

  await kv.del(key);
  return c.json({ success: true });
});

// --- Data Scopes ---

app.get('/scopes', async (c) => {
  const scopes = await kv.getByPrefix('integration:scope:');
  return c.json(scopes || []);
});

app.post('/scopes', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `integration:scope:${id}`;

  const scope = {
    id,
    ...data,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, scope);

  // Audit log
  await kv.set(`integration:audit:${generateId()}`, {
    action_type: 'scope_changed',
    integration_id: data.integration_id,
    integration_name: 'Integration',
    user_id: data.updated_by || 'system',
    user_name: 'Admin User',
    user_role: 'admin',
    changes: { after: scope },
    created_at: getCurrentTimestamp(),
  });

  return c.json(scope, 201);
});

app.put('/scopes/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `integration:scope:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Scope not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`integration:audit:${generateId()}`, {
    action_type: 'scope_changed',
    integration_id: updated.integration_id,
    integration_name: 'Integration',
    user_id: data.updated_by || 'system',
    user_name: 'Admin User',
    user_role: 'admin',
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// --- Webhooks ---

app.get('/webhooks', async (c) => {
  const webhooks = await kv.getByPrefix('integration:webhook:');
  return c.json(webhooks || []);
});

app.post('/webhooks', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `integration:webhook:${id}`;

  const webhook = {
    id,
    ...data,
    secret: hashSecret(data.secret),
    failure_count: 0,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, webhook);

  // Audit log
  await kv.set(`integration:audit:${generateId()}`, {
    action_type: 'webhook_configured',
    integration_id: data.integration_id,
    integration_name: 'Integration',
    user_id: 'system',
    user_name: 'Admin User',
    user_role: 'admin',
    changes: { after: webhook },
    created_at: getCurrentTimestamp(),
  });

  return c.json(webhook, 201);
});

app.put('/webhooks/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `integration:webhook:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);
  return c.json(updated);
});

app.delete('/webhooks/:id', async (c) => {
  const id = c.req.param('id');
  await kv.del(`integration:webhook:${id}`);
  return c.json({ success: true });
});

// --- Sync Configurations ---

app.get('/sync-configs', async (c) => {
  const configs = await kv.getByPrefix('integration:sync_config:');
  return c.json(configs || []);
});

app.post('/sync-configs', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `integration:sync_config:${id}`;

  const config = {
    id,
    ...data,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, config);
  return c.json(config, 201);
});

// --- Sync Jobs ---

app.get('/sync-jobs', async (c) => {
  const jobs = await kv.getByPrefix('integration:sync_job:');
  const sorted = (jobs || []).sort(
    (a: any, b: any) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
  return c.json(sorted);
});

app.post('/sync-jobs/trigger', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `integration:sync_job:${id}`;

  const job = {
    id,
    integration_id: data.integration_id,
    sync_config_id: data.sync_config_id,
    status: 'running',
    started_at: getCurrentTimestamp(),
    records_processed: 0,
    records_succeeded: 0,
    records_failed: 0,
    is_manual: true,
    triggered_by: data.triggered_by,
  };

  await kv.set(key, job);

  // Simulate completion
  setTimeout(async () => {
    const completed = {
      ...job,
      status: 'completed',
      completed_at: getCurrentTimestamp(),
      records_processed: Math.floor(Math.random() * 500) + 50,
      records_succeeded: Math.floor(Math.random() * 450) + 50,
      records_failed: Math.floor(Math.random() * 10),
    };
    await kv.set(key, completed);
  }, 3000);

  // Audit log
  await kv.set(`integration:audit:${generateId()}`, {
    action_type: 'manual_sync',
    integration_id: data.integration_id,
    integration_name: 'Integration',
    user_id: data.triggered_by || 'system',
    user_name: 'Admin User',
    user_role: 'admin',
    created_at: getCurrentTimestamp(),
  });

  return c.json(job, 201);
});

// --- Integration Logs ---

app.get('/logs', async (c) => {
  const logs = await kv.getByPrefix('integration:log:');
  const sorted = (logs || []).sort(
    (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return c.json(sorted.slice(0, 100)); // Last 100 logs
});

// --- Integration Alerts ---

app.get('/alerts', async (c) => {
  const alerts = await kv.getByPrefix('integration:alert:');
  const sorted = (alerts || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return c.json(sorted);
});

app.put('/alerts/:id/resolve', async (c) => {
  const id = c.req.param('id');
  const key = `integration:alert:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Alert not found' }, 404);
  }

  const updated = {
    ...existing,
    is_resolved: true,
    resolved_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);
  return c.json(updated);
});

// --- Audit Logs ---

app.get('/audit-logs', async (c) => {
  const logs = await kv.getByPrefix('integration:audit:');
  const sorted = (logs || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return c.json(sorted);
});

// --- Seed Data ---

app.post('/seed', async (c) => {
  // Catalogue entries
  const catalogueEntries = [
    {
      id: 'stripe',
      name: 'Stripe',
      provider: 'Stripe Inc.',
      category: 'payment',
      description: 'Payment processing for cards, Apple Pay, Google Pay, and SEPA',
      supported_modules: ['billing', 'invoicing', 'payments'],
      supported_directions: ['read', 'write'],
      required_permissions: ['billing.manage', 'payments.process'],
      status: 'available',
      logo_url: 'https://stripe.com/logo.png',
      created_at: getCurrentTimestamp(),
    },
    {
      id: 'twilio',
      name: 'Twilio',
      provider: 'Twilio Inc.',
      category: 'messaging',
      description: 'SMS and WhatsApp messaging',
      supported_modules: ['messaging', 'communications'],
      supported_directions: ['write'],
      required_permissions: ['messaging.send'],
      status: 'available',
      logo_url: 'https://twilio.com/logo.png',
      created_at: getCurrentTimestamp(),
    },
    {
      id: 'xero',
      name: 'Xero',
      provider: 'Xero Limited',
      category: 'accounting',
      description: 'Accounting and financial reporting integration',
      supported_modules: ['billing', 'finance', 'reporting'],
      supported_directions: ['read', 'write'],
      required_permissions: ['finance.export', 'accounting.sync'],
      status: 'coming_soon',
      created_at: getCurrentTimestamp(),
    },
  ];

  for (const entry of catalogueEntries) {
    await kv.set(`integration:catalogue:${entry.id}`, entry);
  }

  // Sample connected integration (Stripe)
  await kv.set('integration:connected:stripe-001', {
    id: 'stripe-001',
    catalogue_id: 'stripe',
    name: 'Stripe Payment Gateway',
    provider: 'Stripe Inc.',
    category: 'payment',
    status: 'active',
    scope: 'organisation',
    health_status: 'healthy',
    configuration: {
      environment: 'test',
      currency: 'CHF',
    },
    enabled_modules: ['billing', 'invoicing'],
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    created_by: 'system',
    updated_by: 'system',
  });

  // Sample logs
  for (let i = 0; i < 10; i++) {
    await kv.set(`integration:log:log-${i}`, {
      id: `log-${i}`,
      integration_id: 'stripe-001',
      log_type: 'request',
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      method: 'POST',
      endpoint: '/v1/charges',
      status_code: 200,
      duration_ms: Math.floor(Math.random() * 500) + 100,
    });
  }

  return c.json({ success: true, message: 'Integrations settings seeded successfully' });
});

export default app;
