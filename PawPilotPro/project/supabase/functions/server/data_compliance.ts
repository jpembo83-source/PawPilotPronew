// Data & Compliance Module Backend - MDC Operations Centre
// Handles operational compliance workflows, GDPR requests, exports, and audit

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth, requireRole } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';
import {
  EXPORT_SIGNED_URL_TTL_SECONDS,
  runSubjectExport,
} from './lib/compliance_export.ts';
import { makeExportStorage } from './lib/compliance_storage.ts';
import { executeRetention, type RetentionJobConfig } from './lib/compliance_retention.ts';

const app = new Hono();

// Every data & compliance route requires a validated user. GDPR / breach /
// audit-log surfaces must never be reachable unauthenticated.
app.use('*', requireAuth);

// --- Utility Functions ---

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// --- Dashboard Statistics ---

app.get('/stats', async (c) => {
  const requests = await kv.getByPrefix('compliance:request:');
  const exports = await kv.getByPrefix('compliance:export:');
  const accessLogs = await kv.getByPrefix('compliance:access_log:');
  const jobs = await kv.getByPrefix('compliance:job:');
  const breaches = await kv.getByPrefix('compliance:breach:');
  const auditLogs = await kv.getByPrefix('compliance:audit:');

  const openRequests = (requests || []).filter((r: any) => 
    ['pending', 'in_review', 'in_progress'].includes(r.status)
  );

  const openRequestsByType = {
    access: openRequests.filter((r: any) => r.request_type === 'access').length,
    rectification: openRequests.filter((r: any) => r.request_type === 'rectification').length,
    erasure: openRequests.filter((r: any) => r.request_type === 'erasure').length,
    restriction: openRequests.filter((r: any) => r.request_type === 'restriction').length,
  };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentAccessLogs = accessLogs || [];
  const accessLogs7Days = recentAccessLogs.filter(
    (log: any) => new Date(log.accessed_at) > sevenDaysAgo
  );
  const accessLogs30Days = recentAccessLogs.filter(
    (log: any) => new Date(log.accessed_at) > thirtyDaysAgo
  );

  const recentExports = (exports || []).filter(
    (exp: any) => new Date(exp.created_at) > sevenDaysAgo
  );

  const activeJobs = (jobs || []).filter((j: any) => j.is_active);
  const failedJobs = activeJobs.filter((j: any) => j.last_run_status === 'failed');

  const openBreaches = (breaches || []).filter((b: any) => 
    ['open', 'under_investigation'].includes(b.status)
  );

  const sortedAuditLogs = (auditLogs || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const lastSettingsChange = sortedAuditLogs.find(
    (log: any) => log.action_type === 'settings_changed'
  )?.created_at;

  return c.json({
    open_requests_by_type: openRequestsByType,
    recent_exports_count: recentExports.length,
    sensitive_access_events_7_days: accessLogs7Days.length,
    sensitive_access_events_30_days: accessLogs30Days.length,
    upcoming_retention_jobs: activeJobs.length,
    failed_retention_jobs: failedJobs.length,
    open_breaches: openBreaches.length,
    last_settings_change: lastSettingsChange,
  });
});

// --- Data Subject Requests (GDPR) ---

app.get('/requests', async (c) => {
  const requests = await kv.getByPrefix('compliance:request:');
  const sorted = (requests || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return c.json(sorted);
});

app.get('/requests/:id', async (c) => {
  const id = c.req.param('id');
  const request = await kv.get(`compliance:request:${id}`);
  if (!request) {
    return c.json({ error: 'Request not found' }, 404);
  }
  return c.json(request);
});

app.post('/requests', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `compliance:request:${id}`;

  const request = {
    id,
    ...data,
    status: 'pending',
    created_at: getCurrentTimestamp(),
  };

  await kv.set(key, request);

  // Audit log
  await kv.set(`compliance:audit:${generateId()}`, {
    action_type: 'data_request',
    entity_type: 'request',
    entity_id: id,
    user_id: data.created_by || 'system',
    user_name: 'User',
    user_role: 'admin',
    action_description: `Created ${data.request_type} request for ${data.household_name}`,
    created_at: getCurrentTimestamp(),
  });

  return c.json(request, 201);
});

app.put('/requests/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `compliance:request:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Request not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`compliance:audit:${generateId()}`, {
    action_type: 'data_request',
    entity_type: 'request',
    entity_id: id,
    user_id: data.updated_by || 'system',
    user_name: 'User',
    user_role: 'admin',
    action_description: `Updated request status to ${data.status}`,
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// Request Actions

app.get('/requests/:id/actions', async (c) => {
  const requestId = c.req.param('id');
  const actions = await kv.getByPrefix('compliance:request_action:');
  const filtered = (actions || []).filter((a: any) => a.request_id === requestId);
  return c.json(filtered);
});

app.post('/requests/:id/actions', async (c) => {
  const requestId = c.req.param('id');
  const data = await c.req.json();
  const id = generateId();
  const key = `compliance:request_action:${id}`;

  const action = {
    id,
    request_id: requestId,
    ...data,
    performed_at: getCurrentTimestamp(),
  };

  await kv.set(key, action);

  // Audit log
  await kv.set(`compliance:audit:${generateId()}`, {
    action_type: 'data_request',
    entity_type: 'request',
    entity_id: requestId,
    user_id: data.performed_by || 'system',
    user_name: 'User',
    user_role: 'admin',
    action_description: `Performed ${data.action_type} action: ${data.action_description}`,
    created_at: getCurrentTimestamp(),
  });

  return c.json(action, 201);
});

// --- Data Exports ---

app.get('/exports', async (c) => {
  const exports = await kv.getByPrefix('compliance:export:');
  const sorted = (exports || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return c.json(sorted);
});

// Exports assemble a subject's complete personal data set — restricted to
// admin/manager, generated synchronously into the PRIVATE exports bucket,
// and served only via short-lived signed URLs (never a stored URL).
app.post('/exports', requireRole('admin', 'manager'), async (c) => {
  const data = await c.req.json();
  const user = c.get('user');

  if (data.scope !== 'household') {
    return c.json(
      { error: 'Only household-scoped (data subject) exports are supported' },
      400,
    );
  }
  const householdId = typeof data.scope_id === 'string' ? data.scope_id.trim() : '';
  if (!householdId) {
    return c.json({ error: 'scope_id (household id) is required' }, 400);
  }
  const household = await kv.get(`customer:${user.tenantId}:household:${householdId}`);
  if (!household) {
    return c.json({ error: 'Household not found' }, 404);
  }

  const id = generateId();
  const key = `compliance:export:${id}`;

  try {
    const result = await runSubjectExport({
      tenantId: user.tenantId,
      householdId,
      exportId: id,
      requestedBy: user.name,
      storage: makeExportStorage(),
    });

    const exportRecord = {
      id,
      ...data,
      scope_id: householdId,
      status: 'ready',
      // Storage object paths in the private bucket — a download URL is only
      // ever minted on demand by GET /exports/:id/download-url.
      file_path: result.file_path,
      summary_path: result.summary_path,
      file_url: null,
      file_size_bytes: result.file_size_bytes,
      record_counts: result.record_counts,
      total_records: result.total_records,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      created_at: getCurrentTimestamp(),
      created_by: user.id,
    };

    await kv.set(key, exportRecord);

    // Audit log
    await kv.set(`compliance:audit:${generateId()}`, {
      action_type: 'export',
      entity_type: 'export',
      entity_id: id,
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action_description: `Generated ${data.export_type} export (${data.scope}) for household ${householdId}: ${result.total_records} records, ${result.file_size_bytes} bytes`,
      created_at: getCurrentTimestamp(),
    });

    return c.json(exportRecord, 201);
  } catch (err) {
    return internalError(c, 'compliance.export_failed', err);
  }
});

// Mint short-lived signed URLs for an export's files. The bucket is private;
// this is the only way an export ever becomes downloadable.
app.get('/exports/:id/download-url', requireRole('admin', 'manager'), async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const exportRecord = await kv.get(`compliance:export:${id}`);
  if (!exportRecord) {
    return c.json({ error: 'Export not found' }, 404);
  }
  if (typeof exportRecord.file_path !== 'string' || !exportRecord.file_path) {
    return c.json({ error: 'Export has no generated file' }, 409);
  }
  if (exportRecord.expires_at && exportRecord.expires_at < getCurrentTimestamp()) {
    return c.json({ error: 'Export has expired' }, 410);
  }

  try {
    const storage = makeExportStorage();
    const url = await storage.createSignedUrl(
      exportRecord.file_path,
      EXPORT_SIGNED_URL_TTL_SECONDS,
    );
    const summaryUrl =
      typeof exportRecord.summary_path === 'string' && exportRecord.summary_path
        ? await storage.createSignedUrl(
            exportRecord.summary_path,
            EXPORT_SIGNED_URL_TTL_SECONDS,
          )
        : null;
    if (!url) {
      return c.json({ error: 'Export file unavailable' }, 404);
    }

    // Audit log — minting a download link is access to the full data set.
    await kv.set(`compliance:audit:${generateId()}`, {
      action_type: 'export',
      entity_type: 'export',
      entity_id: id,
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action_description: 'Issued signed download URL for export file',
      created_at: getCurrentTimestamp(),
    });

    return c.json({
      url,
      summary_url: summaryUrl,
      expires_in_seconds: EXPORT_SIGNED_URL_TTL_SECONDS,
    });
  } catch (err) {
    return internalError(c, 'compliance.export_download_url_failed', err);
  }
});

app.put('/exports/:id/download', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `compliance:export:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Export not found' }, 404);
  }

  const updated = {
    ...existing,
    status: 'downloaded',
    downloaded_at: getCurrentTimestamp(),
    downloaded_by: data.downloaded_by,
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`compliance:audit:${generateId()}`, {
    action_type: 'export',
    entity_type: 'export',
    entity_id: id,
    user_id: data.downloaded_by || 'system',
    user_name: 'User',
    user_role: 'admin',
    action_description: 'Downloaded export file',
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// --- Access Logs ---

app.get('/access-logs', async (c) => {
  const logs = await kv.getByPrefix('compliance:access_log:');
  const sorted = (logs || []).sort(
    (a: any, b: any) => new Date(b.accessed_at).getTime() - new Date(a.accessed_at).getTime()
  );
  return c.json(sorted);
});

app.post('/access-logs', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `compliance:access_log:${id}`;

  const log = {
    id,
    ...data,
    accessed_at: getCurrentTimestamp(),
  };

  await kv.set(key, log);
  return c.json(log, 201);
});

// --- Retention & Deletion Jobs ---

app.get('/retention-jobs', async (c) => {
  const jobs = await kv.getByPrefix('compliance:job:');
  return c.json(jobs || []);
});

app.get('/retention-jobs/:id', async (c) => {
  const id = c.req.param('id');
  const job = await kv.get(`compliance:job:${id}`);
  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }
  return c.json(job);
});

app.post('/retention-jobs', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `compliance:job:${id}`;

  const job = {
    id,
    ...data,
    is_active: true,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, job);

  // Audit log
  await kv.set(`compliance:audit:${generateId()}`, {
    action_type: 'retention_action',
    entity_type: 'job',
    entity_id: id,
    user_id: 'system',
    user_name: 'System',
    user_role: 'admin',
    action_description: `Created retention job: ${data.job_name}`,
    created_at: getCurrentTimestamp(),
  });

  return c.json(job, 201);
});

// The purge is destructive: admin/manager only, DRY-RUN by default, and a
// real run demands an explicit `confirm: true`. The worker audit-logs every
// execution (including dry runs) itself.
app.post('/retention-jobs/:id/execute', requireRole('admin', 'manager'), async (c) => {
  const jobId = c.req.param('id');
  const job = await kv.get(`compliance:job:${jobId}`);

  if (!job) {
    return c.json({ error: 'Job not found' }, 404);
  }

  const body = await c.req.json().catch(() => ({}));
  const dryRun = body.dry_run !== false; // anything short of an explicit false rehearses
  if (!dryRun && body.confirm !== true) {
    return c.json(
      { error: 'A real purge is destructive: pass dry_run: false AND confirm: true' },
      400,
    );
  }

  const user = c.get('user');
  const executionId = generateId();
  const startedAt = getCurrentTimestamp();

  try {
    const result = await executeRetention({
      tenantId: user.tenantId,
      job: job as RetentionJobConfig,
      dryRun,
      actor: { id: user.id, name: user.name, role: user.role },
    });

    const execution = {
      id: executionId,
      job_id: jobId,
      status: 'completed',
      dry_run: dryRun,
      started_at: startedAt,
      completed_at: getCurrentTimestamp(),
      records_affected: result.records_affected,
      records_failed: result.records_failed,
      would_affect: result.candidates.length,
      cutoff: result.cutoff,
      candidates: result.candidates.map((cand) => ({
        entity_type: cand.entity_type,
        entity_id: cand.entity_id,
        record_date: cand.record_date,
        action: cand.action,
      })),
      skipped: result.skipped,
      categories_evaluated: result.categories_evaluated,
      categories_unsupported: result.categories_unsupported,
    };

    await kv.set(`compliance:job_execution:${executionId}`, execution);

    // Only a real run moves the job's last-run metrics — a rehearsal doesn't
    // count as the job having run.
    if (!dryRun) {
      await kv.set(`compliance:job:${jobId}`, {
        ...job,
        last_run_at: getCurrentTimestamp(),
        last_run_status: result.records_failed > 0 ? 'failed' : 'completed',
        last_run_records_affected: result.records_affected,
        updated_at: getCurrentTimestamp(),
      });
    }

    return c.json(execution, 201);
  } catch (err) {
    await kv.set(`compliance:job_execution:${executionId}`, {
      id: executionId,
      job_id: jobId,
      status: 'failed',
      dry_run: dryRun,
      started_at: startedAt,
      completed_at: getCurrentTimestamp(),
      records_affected: 0,
      records_failed: 0,
    });
    return internalError(c, 'compliance.retention_execute_failed', err);
  }
});

// --- Incidents & Breaches ---

app.get('/breaches', async (c) => {
  const breaches = await kv.getByPrefix('compliance:breach:');
  const sorted = (breaches || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return c.json(sorted);
});

app.get('/breaches/:id', async (c) => {
  const id = c.req.param('id');
  const breach = await kv.get(`compliance:breach:${id}`);
  if (!breach) {
    return c.json({ error: 'Breach record not found' }, 404);
  }
  return c.json(breach);
});

app.post('/breaches', async (c) => {
  const data = await c.req.json();
  const id = generateId();
  const key = `compliance:breach:${id}`;

  const breach = {
    id,
    ...data,
    status: 'open',
    regulator_notified: false,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, breach);

  // Audit log
  await kv.set(`compliance:audit:${generateId()}`, {
    action_type: 'breach_reported',
    entity_type: 'breach',
    entity_id: id,
    user_id: data.reported_by || 'system',
    user_name: 'User',
    user_role: 'admin',
    action_description: `Reported data breach: ${data.title} (${data.severity})`,
    created_at: getCurrentTimestamp(),
  });

  return c.json(breach, 201);
});

app.put('/breaches/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const key = `compliance:breach:${id}`;

  const existing = await kv.get(key);
  if (!existing) {
    return c.json({ error: 'Breach record not found' }, 404);
  }

  const updated = {
    ...existing,
    ...data,
    updated_at: getCurrentTimestamp(),
  };

  await kv.set(key, updated);

  // Audit log
  await kv.set(`compliance:audit:${generateId()}`, {
    action_type: 'breach_reported',
    entity_type: 'breach',
    entity_id: id,
    user_id: data.updated_by || 'system',
    user_name: 'User',
    user_role: 'admin',
    action_description: `Updated breach record: ${data.title}`,
    changes: { before: existing, after: updated },
    created_at: getCurrentTimestamp(),
  });

  return c.json(updated);
});

// --- Compliance Audit Log ---

app.get('/audit-logs', async (c) => {
  const logs = await kv.getByPrefix('compliance:audit:');
  const sorted = (logs || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return c.json(sorted);
});

// --- Seed Data ---

app.post('/seed', async (c) => {
  // Sample Data Subject Request
  await kv.set('compliance:request:sample1', {
    id: 'sample1',
    request_type: 'access',
    request_source: 'customer',
    status: 'pending',
    household_id: 'household-001',
    household_name: 'Smith Family',
    data_categories: ['personal', 'operational'],
    scope_description: 'All personal and booking data',
    created_at: getCurrentTimestamp(),
    created_by: 'system',
  });

  // Sample Retention Job
  await kv.set('compliance:job:job1', {
    id: 'job1',
    job_name: 'Inactive Customer Anonymisation',
    job_type: 'anonymisation',
    data_categories: ['personal'],
    retention_period_days: 730,
    next_run_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: getCurrentTimestamp(),
    updated_at: getCurrentTimestamp(),
  });

  // Sample Access Logs
  for (let i = 0; i < 10; i++) {
    await kv.set(`compliance:access_log:log${i}`, {
      id: `log${i}`,
      user_id: 'user-001',
      user_name: 'Sarah Johnson',
      user_role: 'manager',
      access_type: 'view',
      data_category: 'medical',
      entity_type: 'pet',
      entity_id: `pet-00${i}`,
      entity_description: `Max - Medical Notes`,
      module: 'Customers',
      accessed_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return c.json({ success: true, message: 'Data & Compliance module seeded successfully' });
});

export default app;
