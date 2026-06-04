// System Menu Backend - MDC Operations Centre
// Highest-privilege area for global system control, safety, and governance

import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';

const app = new Hono();

// --- Auth Gate (interim, until 1B.1 ships the shared requireAuth middleware) ---
// Validates the user's access token server-side with SERVICE_ROLE_KEY and confirms
// app_metadata.role === 'admin'. No fallbacks, no ANON_KEY validation, no user_metadata
// role reads. Returns a Response on failure; the caller short-circuits with it.
async function requireAdmin(c: any): Promise<Response | null> {
  const token = c.req.header('X-User-Token')?.replace('Bearer ', '');
  if (!token) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('[system requireAdmin] SUPABASE_SERVICE_ROLE_KEY missing — refusing to validate');
    return c.json({ error: 'auth_unavailable' }, 503);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const role = data.user.app_metadata?.role;
  if (role !== 'admin') {
    return c.json({ error: 'forbidden' }, 403);
  }

  return null;
}

// --- Utility Functions ---

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

function createAuditLog(actionType: string, entityType: string, entityId: string, userId: string, description: string, changes?: any) {
  return kv.set(`system:audit:${generateId()}`, {
    timestamp: getCurrentTimestamp(),
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId,
    user_id: userId,
    user_name: 'System Admin',
    action_description: description,
    changes,
  });
}

// --- System Overview ---

app.get('/overview', async (c) => {
  const organisations = await kv.getByPrefix('system:organisation:');
  const users = await kv.getByPrefix('user:');
  const jobs = await kv.getByPrefix('system:job:');
  const logs = await kv.getByPrefix('system:log:');
  
  const activeOrgs = (organisations || []).filter((org: any) => org.status === 'active');
  const suspendedOrgs = (organisations || []).filter((org: any) => org.status === 'suspended');
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentlyActiveUsers = (users || []).filter(
    (user: any) => user.last_login && new Date(user.last_login) > twentyFourHoursAgo
  );

  const runningJobs = (jobs || []).filter((job: any) => job.status === 'running');
  const pausedJobs = (jobs || []).filter((job: any) => job.status === 'paused');
  const failedJobsRecent = (jobs || []).filter(
    (job: any) => job.last_run_status === 'failure' && job.last_run_at && new Date(job.last_run_at) > twentyFourHoursAgo
  );

  const criticalLogs = (logs || []).filter(
    (log: any) => log.level === 'critical' && new Date(log.timestamp) > twentyFourHoursAgo
  );

  // Module usage across organisations
  const enabledModules = {
    daycare: activeOrgs.filter((org: any) => org.enabled_modules?.includes('daycare')).length,
    grooming: activeOrgs.filter((org: any) => org.enabled_modules?.includes('grooming')).length,
    boutique: activeOrgs.filter((org: any) => org.enabled_modules?.includes('boutique')).length,
    transport: activeOrgs.filter((org: any) => org.enabled_modules?.includes('transport')).length,
    overnights: activeOrgs.filter((org: any) => org.enabled_modules?.includes('overnights')).length,
    compliance: activeOrgs.filter((org: any) => org.enabled_modules?.includes('compliance')).length,
  };

  return c.json({
    active_organisations: activeOrgs.length,
    suspended_organisations: suspendedOrgs.length,
    total_users: (users || []).length,
    active_users_24h: recentlyActiveUsers.length,
    enabled_modules: enabledModules,
    integration_health: {
      total: 5,
      healthy: 4,
      degraded: 1,
      down: 0,
    },
    background_jobs: {
      running: runningJobs.length,
      paused: pausedJobs.length,
      failed_last_24h: failedJobsRecent.length,
    },
    recent_critical_events: criticalLogs.length,
  });
});

// --- Organisation Management ---

app.get('/organisations', async (c) => {
  const organisations = await kv.getByPrefix('system:organisation:');
  return c.json(organisations || []);
});

app.get('/organisations/:id', async (c) => {
  const id = c.req.param('id');
  const org = await kv.get(`system:organisation:${id}`);
  if (!org) {
    return c.json({ error: 'Organisation not found' }, 404);
  }
  return c.json(org);
});

app.post('/organisations', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `system:organisation:${id}`;

  const organisation = {
    id,
    ...data,
    status: 'active',
    created_at: getCurrentTimestamp(),
  };

  await kv.set(key, organisation);
  await createAuditLog('organisation_created', 'organisation', id, 'system', `Created organisation: ${data.name}`);

  return c.json(organisation, 201);
});

app.put('/organisations/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `system:organisation:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Organisation not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
  };

  await kv.set(key, updated);
  await createAuditLog('organisation_updated', 'organisation', id, data.updated_by || 'system', `Updated organisation: ${existing.name}`, { before: existing, after: updated });

  return c.json(updated);
});

app.post('/organisations/:id/suspend', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `system:organisation:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Organisation not found' }, 404);
  }

  const updated = {
    ...existing,
    status: 'suspended',
    suspended_at: getCurrentTimestamp(),
    suspended_reason: data.reason,
    suspended_by: data.suspended_by || 'system',
  };

  await kv.set(key, updated);
  await createAuditLog('organisation_suspended', 'organisation', id, data.suspended_by || 'system', `Suspended organisation: ${existing.name}. Reason: ${data.reason}`, { before: existing, after: updated });

  return c.json(updated);
});

app.post('/organisations/:id/reactivate', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `system:organisation:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Organisation not found' }, 404);
  }

  const updated = {
    ...existing,
    status: 'active',
    suspended_at: undefined,
    suspended_reason: undefined,
    suspended_by: undefined,
  };

  await kv.set(key, updated);
  await createAuditLog('organisation_reactivated', 'organisation', id, data.reactivated_by || 'system', `Reactivated organisation: ${existing.name}`, { before: existing, after: updated });

  return c.json(updated);
});

// --- Feature Flags & Modules ---

app.get('/feature-flags', async (c) => {
  const flags = await kv.getByPrefix('system:feature_flag:');
  return c.json(flags || []);
});

app.post('/feature-flags', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `system:feature_flag:${id}`;

  const flag = {
    id,
    ...data,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, flag);
  await createAuditLog('feature_flag_created', 'feature_flag', id, data.updated_by || 'system', `Created feature flag: ${data.display_name}`);

  return c.json(flag, 201);
});

app.put('/feature-flags/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `system:feature_flag:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Feature flag not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);
  await createAuditLog('feature_flag_changed', 'feature_flag', id, data.updated_by || 'system', `Updated feature flag: ${existing.display_name}`, { before: existing, after: updated });

  return c.json(updated);
});

app.get('/modules', async (c) => {
  const modules = await kv.getByPrefix('system:module:');
  return c.json(modules || []);
});

app.put('/modules/:name', async (c) => {
  const name = c.req.param('name');
  const data = await c.req.json();
  const key = `system:module:${name}`;

  const existing = await kv.get(key);
  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);
  await createAuditLog('module_enabled', 'module', name, data.updated_by || 'system', `Updated module: ${name}`, { before: existing, after: updated });

  return c.json(updated);
});

// --- Global Defaults ---

app.get('/defaults', async (c) => {
  const defaults = await kv.getByPrefix('system:default:');
  return c.json(defaults || []);
});

app.post('/defaults', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `system:default:${id}`;

  const defaultSetting = {
    id,
    ...data,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, defaultSetting);
  await createAuditLog('default_setting_created', 'setting', id, data.updated_by || 'system', `Created default setting: ${data.display_name}`);

  return c.json(defaultSetting, 201);
});

app.put('/defaults/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `system:default:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Default setting not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);
  await createAuditLog('default_setting_updated', 'setting', id, data.updated_by || 'system', `Updated default setting: ${existing.display_name}`, { before: existing, after: updated });

  return c.json(updated);
});

// --- Environment & Security ---

app.get('/environment', async (c) => {
  const settings = await kv.get('system:environment_settings');
  return c.json(settings || {
    environment: 'production',
    is_maintenance_mode: false,
    rate_limit_per_minute: 100,
    rate_limit_per_hour: 5000,
    session_timeout_minutes: 60,
    password_min_length: 8,
    password_require_special_chars: true,
    password_require_numbers: true,
    password_require_uppercase: true,
    mfa_required_for_admins: true,
    updated_at: getCurrentTimestamp(),
  });
});

app.put('/environment', async (c) => {
  const data = await c.req.json();
  const existing = await kv.get('system:environment_settings');

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set('system:environment_settings', updated);
  await createAuditLog('security_setting_changed', 'setting', 'environment', data.updated_by || 'system', 'Updated environment and security settings', { before: existing, after: updated });

  return c.json(updated);
});

// --- Background Jobs ---

app.get('/jobs', async (c) => {
  const jobs = await kv.getByPrefix('system:job:');
  return c.json(jobs || []);
});

app.post('/jobs/:id/pause', async (c) => {
  const id = c.req.param('id');
  const key = `system:job:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Job not found' }, 404);
  }

  const updated = {
    ...existing,
    status: 'paused',
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);
  await createAuditLog('job_paused', 'job', id, 'system', `Paused job: ${existing.job_name}`);

  return c.json(updated);
});

app.post('/jobs/:id/resume', async (c) => {
  const id = c.req.param('id');
  const key = `system:job:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Job not found' }, 404);
  }

  const updated = {
    ...existing,
    status: 'running',
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);
  await createAuditLog('job_resumed', 'job', id, 'system', `Resumed job: ${existing.job_name}`);

  return c.json(updated);
});

app.post('/jobs/:id/execute', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const job = await kv.get(`system:job:${id}`);

  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  const executionId = generateId();
  const execution = {
    id: executionId,
    job_id: id,
    job_name: job.job_name,
    started_at: getCurrentTimestamp(),
    status: 'running',
    records_processed: 0,
    triggered_by: data.triggered_by,
  };

  await kv.set(`system:job_execution:${executionId}`, execution);
  await createAuditLog('job_executed', 'job', id, data.triggered_by || 'system', `Manually executed job: ${job.job_name}`);

  // Simulate completion
  setTimeout(async () => {
    const completed = {
      ...execution,
      status: 'completed',
      completed_at: getCurrentTimestamp(),
      records_processed: Math.floor(Math.random() * 1000) + 100,
    };
    await kv.set(`system:job_execution:${executionId}`, completed);
  }, 3000);

  return c.json(execution, 201);
});

// --- System Health ---

app.get('/health', async (c) => {
  const health = {
    timestamp: getCurrentTimestamp(),
    api_availability: 'healthy',
    api_response_time_ms: Math.floor(Math.random() * 100) + 50,
    database_health: 'healthy',
    database_connection_pool: {
      active: 5,
      idle: 15,
      total: 20,
    },
    integration_health: 'healthy',
    active_integrations: 4,
    failed_integrations: 0,
    error_rate_percent: 0.2,
    requests_per_minute: 450,
  };

  return c.json(health);
});

// --- Logs & Diagnostics ---

app.get('/logs', async (c) => {
  const logs = await kv.getByPrefix('system:log:');
  const sorted = (logs || []).sort(
    (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return c.json(sorted.slice(0, 100));
});

app.get('/audit-logs', async (c) => {
  const logs = await kv.getByPrefix('system:audit:');
  const sorted = (logs || []).sort(
    (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return c.json(sorted);
});

// --- System Actions ---

app.post('/actions/emergency-disable', async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const data = await c.req.json();
  const actionId = generateId();

  const execution = {
    id: actionId,
    action_type: 'emergency_disable',
    executed_by: data.executed_by,
    executed_at: getCurrentTimestamp(),
    reason: data.reason,
    result: 'success',
    affected_entities: 1,
    duration_ms: 150,
    is_reversed: false,
  };

  await kv.set(`system:action:${actionId}`, execution);
  await createAuditLog('emergency_action', 'action', actionId, data.executed_by, `Emergency disable executed. Reason: ${data.reason}`);

  return c.json(execution, 201);
});

app.post('/actions/force-logout', async (c) => {
  const denied = await requireAdmin(c);
  if (denied) return denied;

  const data = await c.req.json();
  const actionId = generateId();

  const users = await kv.getByPrefix('user:');
  const affectedCount = (users || []).length;

  const execution = {
    id: actionId,
    action_type: 'force_logout',
    executed_by: data.executed_by,
    executed_at: getCurrentTimestamp(),
    reason: data.reason,
    result: 'success',
    affected_entities: affectedCount,
    duration_ms: 250,
    is_reversed: false,
  };

  await kv.set(`system:action:${actionId}`, execution);
  await createAuditLog('emergency_action', 'action', actionId, data.executed_by, `Forced logout of all users. Reason: ${data.reason}`);

  return c.json(execution, 201);
});

app.post('/actions/maintenance-mode', async (c) => {
  const data = await c.req.json();
  const actionId = generateId();

  const envSettings = await kv.get('system:environment_settings') || {};
  const updated = {
    ...envSettings,
    is_maintenance_mode: data.enable,
    maintenance_message: data.message,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set('system:environment_settings', updated);

  const execution = {
    id: actionId,
    action_type: 'enable_maintenance',
    executed_by: data.executed_by,
    executed_at: getCurrentTimestamp(),
    reason: data.reason,
    result: 'success',
    affected_entities: 1,
    duration_ms: 100,
    is_reversed: !data.enable,
  };

  await kv.set(`system:action:${actionId}`, execution);
  await createAuditLog('emergency_action', 'action', actionId, data.executed_by, `${data.enable ? 'Enabled' : 'Disabled'} maintenance mode. Reason: ${data.reason}`);

  return c.json(execution, 201);
});

// --- Seed Data ---

app.post('/seed', async (c) => {
  // Sample organisations
  await kv.set('system:organisation:org1', {
    id: 'org1',
    name: 'Happy Paws Daycare',
    legal_name: 'Happy Paws Limited',
    status: 'active',
    created_at: getCurrentTimestamp(),
    enabled_modules: ['daycare', 'grooming', 'transport'],
    location_count: 3,
    user_count: 15,
    subscription_tier: 'professional',
    contact_email: 'admin@happypaws.com',
  });

  await kv.set('system:organisation:org2', {
    id: 'org2',
    name: 'Pampered Pets Spa',
    status: 'active',
    created_at: getCurrentTimestamp(),
    enabled_modules: ['grooming', 'boutique'],
    location_count: 1,
    user_count: 5,
    subscription_tier: 'starter',
  });

  // Sample feature flags
  await kv.set('system:feature_flag:flag1', {
    id: 'flag1',
    flag_key: 'enable_ai_scheduling',
    display_name: 'AI-Powered Scheduling',
    description: 'Use machine learning to optimise daycare scheduling',
    scope: 'beta',
    is_enabled: false,
    affects_modules: ['daycare'],
    rollout_percentage: 10,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
    updated_by: 'system',
  });

  // Sample modules
  const modules = ['daycare', 'grooming', 'boutique', 'transport', 'overnights', 'compliance'];
  for (const mod of modules) {
    await kv.set(`system:module:${mod}`, {
      module_name: mod,
      is_enabled_globally: true,
      default_enabled_for_new_orgs: ['daycare', 'grooming'].includes(mod),
      organisations_enabled: Math.floor(Math.random() * 50) + 10,
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    });
  }

  // Sample background jobs
  await kv.set('system:job:job1', {
    id: 'job1',
    job_name: 'Daily Data Retention Cleanup',
    job_type: 'retention',
    schedule: '0 2 * * *',
    status: 'running',
    last_run_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    last_run_status: 'success',
    next_run_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    is_critical: true,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  });

  // Sample system logs
  for (let i = 0; i < 20; i++) {
    await kv.set(`system:log:log${i}`, {
      id: `log${i}`,
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      level: ['info', 'warning', 'error'][Math.floor(Math.random() * 3)],
      category: ['api', 'integration', 'job'][Math.floor(Math.random() * 3)],
      message: `System event ${i}`,
      details: { sample: 'data' },
    });
  }

  return c.json({ success: true, message: 'System data seeded successfully' });
});

export default app;
