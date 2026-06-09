// Incidents & Reporting Routes - MDC Operations Centre
// Production-grade incident management API with RBAC enforcement, escalation, and audit trails

import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';

const app = new Hono();

// Every incidents route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY; the ad-hoc ANON_KEY-validated
// getUserFromToken helper that used to live here has been removed.
app.use('*', requireAuth);

// ============================================================================
// TYPES
// ============================================================================

type IncidentCategory = 
  | 'injury_dog'
  | 'injury_human'
  | 'behaviour'
  | 'escape'
  | 'illness'
  | 'property_damage'
  | 'transport'
  | 'overnight'
  | 'complaint'
  | 'near_miss'
  | 'other';

type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

type IncidentStatus = 
  | 'new'
  | 'in_review'
  | 'action_required'
  | 'awaiting_customer'
  | 'resolved'
  | 'closed'
  | 'reopened';

type IncidentModule = 'daycare' | 'grooming' | 'boutique' | 'transport' | 'overnights';

interface Incident {
  id: string;
  location_id: string;
  location_name: string;
  module: IncidentModule;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  
  // Core details
  summary: string;
  description?: string;
  immediate_actions?: string;
  occurred_at: string;
  
  // Linked entities
  pet_id?: string;
  pet_name?: string;
  household_id?: string;
  household_name?: string;
  booking_id?: string;
  transport_id?: string;
  overnight_id?: string;
  
  // People involved
  created_by_id: string;
  created_by_name: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  
  // Workflow
  needs_follow_up: boolean;
  due_date?: string;
  escalated: boolean;
  escalated_at?: string;
  
  // Closure
  root_cause?: string;
  outcome_summary?: string;
  preventative_action?: string;
  closed_by_id?: string;
  closed_by_name?: string;
  closed_at?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

interface IncidentPerson {
  id: string;
  incident_id: string;
  user_id?: string;
  user_name: string;
  role: 'involved_staff' | 'witness' | 'reporter';
  notes?: string;
}

interface IncidentAction {
  id: string;
  incident_id: string;
  description: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completed_at?: string;
  completed_by_id?: string;
  completed_by_name?: string;
  notes?: string;
  created_at: string;
}

interface IncidentNote {
  id: string;
  incident_id: string;
  content: string;
  author_id: string;
  author_name: string;
  is_internal: boolean;
  created_at: string;
}

interface IncidentAttachment {
  id: string;
  incident_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by_id: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

interface IncidentAuditLog {
  id: string;
  incident_id: string;
  action: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  user_id: string;
  user_name: string;
  user_role: string;
  timestamp: string;
  details?: any;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get Supabase client
const getSupabase = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
};

// Check permissions for incident operations
const hasPermission = (
  userRole: string, 
  action: 'create' | 'view' | 'view_all' | 'assign' | 'close' | 'reopen' | 'export' | 'delete'
): boolean => {
  const permissions: Record<string, string[]> = {
    admin: ['create', 'view', 'view_all', 'assign', 'close', 'reopen', 'export', 'delete'],
    manager: ['create', 'view', 'view_all', 'assign', 'close', 'reopen', 'export'],
    assistant_manager: ['create', 'view', 'view_all', 'assign'],
    staff: ['create', 'view'],
    driver: ['create', 'view'],
    night_shift: ['create', 'view', 'close'], // Can close low severity
  };
  
  return permissions[userRole]?.includes(action) || false;
};

// Check if user can close incident based on severity
const canCloseIncident = (userRole: string, severity: IncidentSeverity): boolean => {
  if (userRole === 'admin') return true;
  if (userRole === 'manager') return true;
  if (userRole === 'night_shift' && severity === 'low') return true;
  return false;
};

// Generate unique ID
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Log audit event
const logAudit = async (log: Omit<IncidentAuditLog, 'id' | 'timestamp'>) => {
  const auditLog: IncidentAuditLog = {
    id: generateId('audit'),
    ...log,
    timestamp: new Date().toISOString(),
  };
  
  await kv.set(`incident:audit:${auditLog.id}`, auditLog);
  await kv.set(`incident:audit:incident:${log.incident_id}:${auditLog.id}`, auditLog.id);
  await kv.set(`incident:audit:by_time:${auditLog.timestamp}:${auditLog.id}`, auditLog.id);
};

// Check escalation rules and auto-escalate if needed
const checkEscalation = async (incident: Incident, user: any) => {
  if (incident.severity === 'high' || incident.severity === 'critical') {
    if (!incident.escalated) {
      incident.escalated = true;
      incident.escalated_at = new Date().toISOString();
      
      // Log escalation
      await logAudit({
        incident_id: incident.id,
        action: 'auto_escalate',
        user_id: 'system',
        user_name: 'System',
        user_role: 'system',
        details: {
          severity: incident.severity,
          trigger: 'automatic',
          reason: 'High/Critical severity incident',
        },
      });
      
      // In a real system, this would trigger notifications to managers
      console.log(`[ESCALATION] Incident ${incident.id} (${incident.severity}) auto-escalated`);
    }
  }
};

// Filter incidents by user permissions
const filterIncidentsByPermission = (incidents: Incident[], user: any): Incident[] => {
  if (user.role === 'admin') {
    return incidents; // Admins see all
  }
  
  if (user.role === 'manager' || user.role === 'assistant_manager') {
    // Managers see incidents in their locations
    return incidents.filter(i => user.locationIds.includes(i.location_id));
  }
  
  if (user.role === 'staff') {
    // Staff see incidents they created or in their location
    return incidents.filter(i => 
      i.created_by_id === user.id || user.locationIds.includes(i.location_id)
    );
  }
  
  if (user.role === 'driver') {
    // Drivers see only transport incidents
    return incidents.filter(i => 
      i.module === 'transport' && (i.created_by_id === user.id || user.locationIds.includes(i.location_id))
    );
  }
  
  if (user.role === 'night_shift') {
    // Night shift see overnight incidents
    return incidents.filter(i => 
      i.module === 'overnights' && (i.created_by_id === user.id || user.locationIds.includes(i.location_id))
    );
  }
  
  return [];
};

// ============================================================================
// ROUTES - INCIDENTS
// ============================================================================

// Get all incidents (with filters)
app.get('/', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }
    
    // Get query parameters for filtering
    const locationId = c.req.query('location_id');
    const module = c.req.query('module');
    const severity = c.req.query('severity');
    const status = c.req.query('status');
    const assignedToMe = c.req.query('assigned_to_me') === 'true';
    const openOnly = c.req.query('open_only') === 'true';
    const search = c.req.query('search');
    
    let incidents = (await kv.getByPrefix('incident:main:') as Incident[] | null) || [];
    
    // Apply permission-based filtering
    incidents = filterIncidentsByPermission(incidents, user);
    
    // Apply additional filters
    if (locationId && locationId !== 'ALL') {
      incidents = incidents.filter(i => i.location_id === locationId);
    }
    
    if (module) {
      incidents = incidents.filter(i => i.module === module);
    }
    
    if (severity) {
      incidents = incidents.filter(i => i.severity === severity);
    }
    
    if (status) {
      incidents = incidents.filter(i => i.status === status);
    }
    
    if (assignedToMe) {
      incidents = incidents.filter(i => i.assigned_to_id === user.id);
    }
    
    if (openOnly) {
      incidents = incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved');
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      incidents = incidents.filter(i => 
        i.summary?.toLowerCase().includes(searchLower) ||
        i.description?.toLowerCase().includes(searchLower) ||
        i.pet_name?.toLowerCase().includes(searchLower) ||
        i.household_name?.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by created_at descending (newest first)
    incidents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return c.json(incidents);
  } catch (error: any) {
    console.error('Get incidents error:', error);
    return c.json({ error: error.message || 'Failed to retrieve incidents' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// Get incident statistics - MUST come before /:id route
app.get('/stats', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const locationId = c.req.query('location_id');
    
    let incidents = (await kv.getByPrefix('incident:main:') as Incident[] | null) || [];
    
    // Apply permission filtering
    incidents = filterIncidentsByPermission(incidents, user);
    
    // Apply location filter if specified
    if (locationId && locationId !== 'ALL') {
      incidents = incidents.filter(i => i.location_id === locationId);
    }
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const stats = {
      total: incidents.length,
      open: incidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length,
      high_critical: incidents.filter(i => i.severity === 'high' || i.severity === 'critical').length,
      overdue: incidents.filter(i => {
        if (i.status === 'closed' || i.status === 'resolved') return false;
        if (!i.due_date) return false;
        return new Date(i.due_date) < now;
      }).length,
      assigned_to_me: incidents.filter(i => i.assigned_to_id === user.id && i.status !== 'closed').length,
      by_severity: {
        low: incidents.filter(i => i.severity === 'low').length,
        medium: incidents.filter(i => i.severity === 'medium').length,
        high: incidents.filter(i => i.severity === 'high').length,
        critical: incidents.filter(i => i.severity === 'critical').length,
      },
      by_status: {
        new: incidents.filter(i => i.status === 'new').length,
        in_review: incidents.filter(i => i.status === 'in_review').length,
        action_required: incidents.filter(i => i.status === 'action_required').length,
        awaiting_customer: incidents.filter(i => i.status === 'awaiting_customer').length,
        resolved: incidents.filter(i => i.status === 'resolved').length,
        closed: incidents.filter(i => i.status === 'closed').length,
        reopened: incidents.filter(i => i.status === 'reopened').length,
      },
      by_category: incidents.reduce((acc, i) => {
        acc[i.category] = (acc[i.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recent_30_days: incidents.filter(i => new Date(i.created_at) > thirtyDaysAgo).length,
    };
    
    return c.json(stats);
  } catch (error: any) {
    console.error('Get stats error:', error);
    return c.json({ error: error.message || 'Failed to retrieve statistics' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// Export incidents - MUST come before /:id route
app.get('/export', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'export')) {
      return c.json({ error: 'Access denied: insufficient permissions to export' }, 403);
    }
    
    let incidents = (await kv.getByPrefix('incident:main:') as Incident[] | null) || [];
    
    // Apply permission filtering
    incidents = filterIncidentsByPermission(incidents, user);
    
    // Log export
    await logAudit({
      incident_id: 'export',
      action: 'export',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: {
        count: incidents.length,
        timestamp: new Date().toISOString(),
      },
    });
    
    return c.json(incidents);
  } catch (error: any) {
    console.error('Export incidents error:', error);
    return c.json({ error: error.message || 'Failed to export incidents' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// Get single incident by ID
app.get('/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const incidentId = c.req.param('id');
    
    if (!hasPermission(user.role, 'view')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }
    
    const incident = await kv.get(`incident:main:${incidentId}`) as Incident | null;
    
    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }
    
    // Check if user has permission to view this specific incident
    const filtered = filterIncidentsByPermission([incident], user);
    if (filtered.length === 0) {
      return c.json({ error: 'Access denied: insufficient permissions for this incident' }, 403);
    }
    
    // Get related data
    const people = await kv.getByPrefix(`incident:people:${incidentId}:`) as IncidentPerson[];
    const actions = await kv.getByPrefix(`incident:actions:${incidentId}:`) as IncidentAction[];
    const notes = await kv.getByPrefix(`incident:notes:${incidentId}:`) as IncidentNote[];
    const attachments = await kv.getByPrefix(`incident:attachments:${incidentId}:`) as IncidentAttachment[];
    const auditLogs = await kv.getByPrefix(`incident:audit:incident:${incidentId}:`) as string[];
    
    // Fetch full audit logs
    const fullAuditLogs = await Promise.all(
      auditLogs.map(async (logId) => await kv.get(`incident:audit:${logId}`) as IncidentAuditLog)
    );
    
    // Log view
    await logAudit({
      incident_id: incidentId,
      action: 'view',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: { summary: incident.summary },
    });
    
    return c.json({
      ...incident,
      people,
      actions,
      notes,
      attachments,
      audit_logs: fullAuditLogs.filter(Boolean),
    });
  } catch (error: any) {
    console.error('Get incident error:', error);
    return c.json({ error: error.message || 'Failed to retrieve incident' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// Create incident
app.post('/', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'create')) {
      return c.json({ error: 'Access denied: insufficient permissions to create incidents' }, 403);
    }
    
    const body = await c.req.json();
    const {
      location_id,
      location_name,
      module,
      category,
      severity,
      summary,
      description,
      immediate_actions,
      occurred_at,
      pet_id,
      pet_name,
      household_id,
      household_name,
      booking_id,
      transport_id,
      overnight_id,
      needs_follow_up,
      due_date,
      involved_people,
    } = body;
    
    // Validation
    if (!location_id || !module || !category || !severity || !summary) {
      return c.json({ error: 'Missing required fields: location_id, module, category, severity, summary' }, 400);
    }
    
    // Severity-based required fields
    if ((severity === 'medium' || severity === 'high' || severity === 'critical') && !description) {
      return c.json({ error: 'Description required for Medium+ severity incidents' }, 400);
    }
    
    if ((severity === 'medium' || severity === 'high' || severity === 'critical') && !immediate_actions) {
      return c.json({ error: 'Immediate actions required for Medium+ severity incidents' }, 400);
    }
    
    const incidentId = generateId('inc');
    const now = new Date().toISOString();
    
    const incident: Incident = {
      id: incidentId,
      location_id,
      location_name: location_name || 'Unknown',
      module,
      category,
      severity,
      status: 'new',
      summary,
      description,
      immediate_actions,
      occurred_at: occurred_at || now,
      pet_id,
      pet_name,
      household_id,
      household_name,
      booking_id,
      transport_id,
      overnight_id,
      created_by_id: user.id,
      created_by_name: user.name,
      needs_follow_up: needs_follow_up !== false && (severity === 'medium' || severity === 'high' || severity === 'critical'),
      due_date,
      escalated: false,
      created_at: now,
      updated_at: now,
    };
    
    // Check escalation rules
    await checkEscalation(incident, user);
    
    // Store incident with multiple indexes
    await kv.set(`incident:main:${incidentId}`, incident);
    await kv.set(`incident:location:${location_id}:${incidentId}`, incidentId);
    await kv.set(`incident:severity:${severity}:${incidentId}`, incidentId);
    await kv.set(`incident:status:${incident.status}:${incidentId}`, incidentId);
    if (pet_id) {
      await kv.set(`incident:pet:${pet_id}:${incidentId}`, incidentId);
    }
    if (household_id) {
      await kv.set(`incident:household:${household_id}:${incidentId}`, incidentId);
    }
    
    // Store involved people
    if (involved_people && Array.isArray(involved_people)) {
      for (const person of involved_people) {
        const personId = generateId('person');
        const incidentPerson: IncidentPerson = {
          id: personId,
          incident_id: incidentId,
          user_id: person.user_id,
          user_name: person.user_name,
          role: person.role || 'involved_staff',
          notes: person.notes,
        };
        
        await kv.set(`incident:people:${incidentId}:${personId}`, incidentPerson);
      }
    }
    
    // Log audit
    await logAudit({
      incident_id: incidentId,
      action: 'create',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: {
        category,
        severity,
        summary,
        location_name,
      },
    });
    
    return c.json(incident, 201);
  } catch (error: any) {
    console.error('Create incident error:', error);
    return c.json({ error: error.message || 'Failed to create incident' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// Update incident
app.put('/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const incidentId = c.req.param('id');
    
    const incident = await kv.get(`incident:main:${incidentId}`) as Incident | null;
    
    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }
    
    // Check permissions - staff can only edit their own non-closed incidents
    if (incident.status === 'closed') {
      if (user.role !== 'admin' && user.role !== 'manager') {
        return c.json({ error: 'Cannot edit closed incidents' }, 403);
      }
    }
    
    if (user.role === 'staff' && incident.created_by_id !== user.id) {
      return c.json({ error: 'Access denied: can only edit incidents you created' }, 403);
    }
    
    const body = await c.req.json();
    const updates: Partial<Incident> = {};
    
    // Track changes for audit
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    
    // Allowed fields to update
    const allowedFields = [
      'summary',
      'description',
      'immediate_actions',
      'status',
      'severity',
      'assigned_to_id',
      'assigned_to_name',
      'needs_follow_up',
      'due_date',
      'root_cause',
      'outcome_summary',
      'preventative_action',
    ];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== incident[field as keyof Incident]) {
        changes.push({
          field,
          oldValue: incident[field as keyof Incident],
          newValue: body[field],
        });
        updates[field as keyof Incident] = body[field];
      }
    }
    
    if (changes.length === 0) {
      return c.json({ error: 'No changes detected' }, 400);
    }
    
    // Update incident
    const updatedIncident = {
      ...incident,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    
    // Check escalation if severity changed
    if (updates.severity) {
      await checkEscalation(updatedIncident, user);
    }
    
    await kv.set(`incident:main:${incidentId}`, updatedIncident);
    
    // Update indexes if needed
    if (updates.severity && updates.severity !== incident.severity) {
      await kv.del(`incident:severity:${incident.severity}:${incidentId}`);
      await kv.set(`incident:severity:${updates.severity}:${incidentId}`, incidentId);
    }
    
    if (updates.status && updates.status !== incident.status) {
      await kv.del(`incident:status:${incident.status}:${incidentId}`);
      await kv.set(`incident:status:${updates.status}:${incidentId}`, incidentId);
    }
    
    // Log each change
    for (const change of changes) {
      await logAudit({
        incident_id: incidentId,
        action: 'update',
        field_changed: change.field,
        old_value: String(change.oldValue),
        new_value: String(change.newValue),
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        details: { summary: incident.summary },
      });
    }
    
    return c.json(updatedIncident);
  } catch (error: any) {
    console.error('Update incident error:', error);
    return c.json({ error: error.message || 'Failed to update incident' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// Assign incident
app.post('/:id/assign', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const incidentId = c.req.param('id');
    
    if (!hasPermission(user.role, 'assign')) {
      return c.json({ error: 'Access denied: insufficient permissions to assign incidents' }, 403);
    }
    
    const incident = await kv.get(`incident:main:${incidentId}`) as Incident | null;
    
    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }
    
    const body = await c.req.json();
    const { assigned_to_id, assigned_to_name, due_date } = body;
    
    if (!assigned_to_id || !assigned_to_name) {
      return c.json({ error: 'Missing required fields: assigned_to_id, assigned_to_name' }, 400);
    }
    
    incident.assigned_to_id = assigned_to_id;
    incident.assigned_to_name = assigned_to_name;
    incident.due_date = due_date;
    incident.status = 'action_required';
    incident.updated_at = new Date().toISOString();
    
    await kv.set(`incident:main:${incidentId}`, incident);
    await kv.set(`incident:assigned:${assigned_to_id}:${incidentId}`, incidentId);
    
    // Log assignment
    await logAudit({
      incident_id: incidentId,
      action: 'assign',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: {
        assigned_to: assigned_to_name,
        due_date,
      },
    });
    
    return c.json(incident);
  } catch (error: any) {
    console.error('Assign incident error:', error);
    return c.json({ error: error.message || 'Failed to assign incident' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// Close incident
app.post('/:id/close', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const incidentId = c.req.param('id');
    
    const incident = await kv.get(`incident:main:${incidentId}`) as Incident | null;
    
    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }
    
    if (!canCloseIncident(user.role, incident.severity)) {
      return c.json({ error: 'Access denied: insufficient permissions to close this severity level' }, 403);
    }
    
    const body = await c.req.json();
    const { root_cause, outcome_summary, preventative_action } = body;
    
    if (!root_cause || !outcome_summary) {
      return c.json({ error: 'Missing required fields: root_cause, outcome_summary' }, 400);
    }
    
    incident.root_cause = root_cause;
    incident.outcome_summary = outcome_summary;
    incident.preventative_action = preventative_action;
    incident.status = 'closed';
    incident.closed_by_id = user.id;
    incident.closed_by_name = user.name;
    incident.closed_at = new Date().toISOString();
    incident.updated_at = new Date().toISOString();
    
    await kv.set(`incident:main:${incidentId}`, incident);
    await kv.del(`incident:status:action_required:${incidentId}`);
    await kv.del(`incident:status:in_review:${incidentId}`);
    await kv.del(`incident:status:awaiting_customer:${incidentId}`);
    await kv.del(`incident:status:resolved:${incidentId}`);
    await kv.set(`incident:status:closed:${incidentId}`, incidentId);
    
    // Log closure
    await logAudit({
      incident_id: incidentId,
      action: 'close',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: {
        root_cause,
        outcome_summary,
      },
    });
    
    return c.json(incident);
  } catch (error: any) {
    console.error('Close incident error:', error);
    return c.json({ error: error.message || 'Failed to close incident' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// Reopen incident
app.post('/:id/reopen', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const incidentId = c.req.param('id');
    
    if (!hasPermission(user.role, 'reopen')) {
      return c.json({ error: 'Access denied: insufficient permissions to reopen incidents' }, 403);
    }
    
    const incident = await kv.get(`incident:main:${incidentId}`) as Incident | null;
    
    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }
    
    if (incident.status !== 'closed') {
      return c.json({ error: 'Can only reopen closed incidents' }, 400);
    }
    
    const body = await c.req.json();
    const { reason } = body;
    
    if (!reason) {
      return c.json({ error: 'Reason required to reopen incident' }, 400);
    }
    
    incident.status = 'reopened';
    incident.updated_at = new Date().toISOString();
    
    await kv.set(`incident:main:${incidentId}`, incident);
    await kv.del(`incident:status:closed:${incidentId}`);
    await kv.set(`incident:status:reopened:${incidentId}`, incidentId);
    
    // Log reopening
    await logAudit({
      incident_id: incidentId,
      action: 'reopen',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: { reason },
    });
    
    return c.json(incident);
  } catch (error: any) {
    console.error('Reopen incident error:', error);
    return c.json({ error: error.message || 'Failed to reopen incident' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// ============================================================================
// ROUTES - NOTES
// ============================================================================

// Add note to incident
app.post('/:id/notes', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const incidentId = c.req.param('id');
    
    const incident = await kv.get(`incident:main:${incidentId}`) as Incident | null;
    
    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }
    
    // Check permissions
    const filtered = filterIncidentsByPermission([incident], user);
    if (filtered.length === 0) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    const body = await c.req.json();
    const { content, is_internal } = body;
    
    if (!content) {
      return c.json({ error: 'Content required' }, 400);
    }
    
    const noteId = generateId('note');
    const note: IncidentNote = {
      id: noteId,
      incident_id: incidentId,
      content,
      author_id: user.id,
      author_name: user.name,
      is_internal: is_internal !== false,
      created_at: new Date().toISOString(),
    };
    
    await kv.set(`incident:notes:${incidentId}:${noteId}`, note);
    
    // Log note addition
    await logAudit({
      incident_id: incidentId,
      action: 'add_note',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: { is_internal },
    });
    
    return c.json(note, 201);
  } catch (error: any) {
    console.error('Add note error:', error);
    return c.json({ error: error.message || 'Failed to add note' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// ============================================================================
// ROUTES - ACTIONS
// ============================================================================

// Add action to incident
app.post('/:id/actions', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const incidentId = c.req.param('id');
    
    if (!hasPermission(user.role, 'assign')) {
      return c.json({ error: 'Access denied: insufficient permissions to add actions' }, 403);
    }
    
    const incident = await kv.get(`incident:main:${incidentId}`) as Incident | null;
    
    if (!incident) {
      return c.json({ error: 'Incident not found' }, 404);
    }
    
    const body = await c.req.json();
    const { description, assigned_to_id, assigned_to_name, due_date } = body;
    
    if (!description) {
      return c.json({ error: 'Description required' }, 400);
    }
    
    const actionId = generateId('action');
    const action: IncidentAction = {
      id: actionId,
      incident_id: incidentId,
      description,
      assigned_to_id,
      assigned_to_name,
      due_date,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    
    await kv.set(`incident:actions:${incidentId}:${actionId}`, action);
    
    // Log action creation
    await logAudit({
      incident_id: incidentId,
      action: 'add_action',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: {
        action_description: description,
        assigned_to: assigned_to_name,
      },
    });
    
    return c.json(action, 201);
  } catch (error: any) {
    console.error('Add action error:', error);
    return c.json({ error: error.message || 'Failed to add action' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

// Update action status
app.put('/:id/actions/:actionId', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const incidentId = c.req.param('id');
    const actionId = c.req.param('actionId');
    
    const action = await kv.get(`incident:actions:${incidentId}:${actionId}`) as IncidentAction | null;
    
    if (!action) {
      return c.json({ error: 'Action not found' }, 404);
    }
    
    const body = await c.req.json();
    const { status, notes } = body;
    
    if (status) {
      action.status = status;
      
      if (status === 'completed') {
        action.completed_at = new Date().toISOString();
        action.completed_by_id = user.id;
        action.completed_by_name = user.name;
      }
    }
    
    if (notes) {
      action.notes = notes;
    }
    
    await kv.set(`incident:actions:${incidentId}:${actionId}`, action);
    
    // Log action update
    await logAudit({
      incident_id: incidentId,
      action: 'update_action',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: {
        action_id: actionId,
        new_status: status,
      },
    });
    
    return c.json(action);
  } catch (error: any) {
    console.error('Update action error:', error);
    return c.json({ error: error.message || 'Failed to update action' }, error.message.includes('Unauthorized') ? 401 : 500);
  }
});

export default app;