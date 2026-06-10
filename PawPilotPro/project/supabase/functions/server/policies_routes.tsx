// Policies & Acknowledgements Routes - MDC Operations Centre
// Production-grade employee policy compliance API with RBAC enforcement

import { Hono } from 'npm:hono';
import { createClient } from 'npm:@supabase/supabase-js';
import * as kv from './kv_store.tsx';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';

const app = new Hono();

// Every policies route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY; the ad-hoc ANON_KEY-validated
// getUserFromToken helper that used to live here has been removed.
app.use('*', requireAuth);

// ============================================================================
// TYPES
// ============================================================================

type PolicyStatus = 'draft' | 'published' | 'archived';
type AssignmentStatus = 'pending' | 'viewed' | 'acknowledged' | 'overdue';
type FileType = 'pdf' | 'doc' | 'docx';

interface PolicyDocument {
  id: string;
  title: string;
  category?: string;
  version: string;
  file_url: string;
  file_type: FileType;
  file_name: string;
  file_size: number;
  status: PolicyStatus;
  description?: string;
  effective_date?: string;
  location_ids?: string[];
  requires_reacknowledgement: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  published_at?: string;
  archived_at?: string;
  previous_version_id?: string;
}

interface PolicyAssignment {
  id: string;
  policy_id: string;
  policy_title: string;
  policy_version: string;
  assigned_to_user_id: string;
  assigned_to_name: string;
  assigned_to_email: string;
  assigned_by_user_id: string;
  assigned_by_name: string;
  due_date: string;
  status: AssignmentStatus;
  location_scope?: string[];
  role_scope?: string[];
  is_blocking: boolean;
  assignment_type: 'individual' | 'location' | 'role' | 'organisation';
  created_at: string;
}

interface PolicyAcknowledgement {
  id: string;
  assignment_id: string;
  policy_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  acknowledged_at: string;
  viewed_at?: string;
  ip_address?: string;
  user_agent?: string;
  signature_data: string; // Full name confirmation
}

interface ReminderSchedule {
  id: string;
  assignment_id: string;
  policy_id: string;
  user_id: string;
  reminder_type: '7_days' | '3_days' | 'due_date' | 'overdue_daily' | 'overdue_weekly';
  scheduled_for: string;
  sent_at?: string;
  status: 'pending' | 'sent' | 'failed';
  message_id?: string;
}

interface AuditLog {
  id: string;
  action: 'upload' | 'publish' | 'archive' | 'assign' | 'acknowledge' | 'export' | 'reminder_sent' | 'view';
  entity_type: 'policy' | 'assignment' | 'acknowledgement';
  entity_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  details: any;
  timestamp: string;
  ip_address?: string;
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

// Check permissions
const hasPermission = (userRole: string, action: 'upload' | 'assign' | 'view_all' | 'export' | 'delete'): boolean => {
  const permissions: Record<string, string[]> = {
    admin: ['upload', 'assign', 'view_all', 'export', 'delete'],
    manager: ['upload', 'assign', 'view_all', 'export'],
    assistant_manager: ['view_all'],
    staff: [],
  };
  
  return permissions[userRole]?.includes(action) || false;
};

// Generate unique ID
const generateId = () => `pol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Log audit event
const logAudit = async (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
  const auditLog: AuditLog = {
    id: generateId(),
    ...log,
    timestamp: new Date().toISOString(),
  };
  
  await kv.set(`audit:policy:${auditLog.id}`, auditLog);
  
  // Also store with timestamp for chronological retrieval
  await kv.set(`audit:policy:by_time:${auditLog.timestamp}:${auditLog.id}`, auditLog.id);
};

// ============================================================================
// ROUTES - POLICY DOCUMENTS
// ============================================================================

// Get all policies (filtered by permissions)
app.get('/', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    const allPolicies = await kv.getByPrefix('policy:doc:');
    const policies = allPolicies as PolicyDocument[];
    
    // Filter based on role
    let filtered = policies;
    
    if (user.role === 'staff') {
      // Staff can only see published policies assigned to them
      // This endpoint returns just metadata; assignments are separate
      filtered = [];
    } else if (user.role === 'manager' || user.role === 'assistant_manager') {
      // Managers see published policies in their locations
      filtered = policies.filter(p => 
        p.status === 'published' &&
        (!p.location_ids || p.location_ids.length === 0 || 
         p.location_ids.some(loc => user.locationIds.includes(loc)))
      );
    }
    // Admin sees all
    
    return c.json(filtered);
  } catch (error: any) {
    console.error('Get policies error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getRoot', error);
  }
});

// Get assignments for current user (staff view) - MUST come before /:id route
app.get('/my-assignments', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    const assignments = await kv.getByPrefix(`policy:assignment:user:${user.id}:`) as PolicyAssignment[];
    
    // Update status based on due dates
    const now = new Date();
    const updatedAssignments = assignments.map(a => {
      if (a.status === 'pending' || a.status === 'viewed') {
        const dueDate = new Date(a.due_date);
        if (now > dueDate) {
          a.status = 'overdue';
        }
      }
      return a;
    });
    
    return c.json(updatedAssignments);
  } catch (error: any) {
    console.error('Get my assignments error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getMyAssignments', error);
  }
});

// Get single policy by ID
app.get('/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const policyId = c.req.param('id');
    
    const policy = await kv.get(`policy:doc:${policyId}`) as PolicyDocument | null;
    
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    // Check permissions
    if (user.role === 'staff') {
      // Staff can only view if assigned
      const assignments = await kv.getByPrefix(`policy:assignment:user:${user.id}:`) as PolicyAssignment[];
      const hasAssignment = assignments.some(a => a.policy_id === policyId);
      
      if (!hasAssignment) {
        return c.json({ error: 'Access denied' }, 403);
      }
    } else if (user.role === 'manager') {
      // Manager must have location access
      if (policy.location_ids && policy.location_ids.length > 0) {
        const hasLocationAccess = policy.location_ids.some(loc => user.locationIds.includes(loc));
        if (!hasLocationAccess) {
          return c.json({ error: 'Access denied: insufficient location permissions' }, 403);
        }
      }
    }
    
    // Log view
    await logAudit({
      action: 'view',
      entity_type: 'policy',
      entity_id: policyId,
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: { policy_title: policy.title },
    });
    
    return c.json(policy);
  } catch (error: any) {
    console.error('Get policy error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getId', error);
  }
});

// Create policy (upload metadata - file upload handled separately via Supabase Storage)
app.post('/', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'upload')) {
      return c.json({ error: 'Access denied: insufficient permissions to upload policies' }, 403);
    }
    
    const body = await c.req.json();
    const { title, category, version, file_url, file_type, file_name, file_size, description, effective_date, location_ids, requires_reacknowledgement } = body;
    
    if (!title || !version || !file_url || !file_type) {
      return c.json({ error: 'Missing required fields: title, version, file_url, file_type' }, 400);
    }
    
    const policyId = generateId();
    
    const policy: PolicyDocument = {
      id: policyId,
      title,
      category,
      version,
      file_url,
      file_type,
      file_name: file_name || 'document.' + file_type,
      file_size: file_size || 0,
      status: 'draft',
      description,
      effective_date,
      location_ids: location_ids || [],
      requires_reacknowledgement: requires_reacknowledgement !== false,
      created_by: user.id,
      created_by_name: user.name,
      created_at: new Date().toISOString(),
    };
    
    await kv.set(`policy:doc:${policyId}`, policy);
    
    // Log audit
    await logAudit({
      action: 'upload',
      entity_type: 'policy',
      entity_id: policyId,
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: { title, version, file_type },
    });
    
    return c.json(policy, 201);
  } catch (error: any) {
    console.error('Create policy error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.postRoot', error);
  }
});

// Publish policy
app.post('/:id/publish', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const policyId = c.req.param('id');
    
    if (!hasPermission(user.role, 'upload')) {
      return c.json({ error: 'Access denied: insufficient permissions to publish policies' }, 403);
    }
    
    const policy = await kv.get(`policy:doc:${policyId}`) as PolicyDocument | null;
    
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    if (policy.status === 'published') {
      return c.json({ error: 'Policy already published' }, 400);
    }
    
    policy.status = 'published';
    policy.published_at = new Date().toISOString();
    
    await kv.set(`policy:doc:${policyId}`, policy);
    
    // Log audit
    await logAudit({
      action: 'publish',
      entity_type: 'policy',
      entity_id: policyId,
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: { title: policy.title, version: policy.version },
    });
    
    return c.json(policy);
  } catch (error: any) {
    console.error('Publish policy error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.postIdPublish', error);
  }
});

// Archive policy
app.post('/:id/archive', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const policyId = c.req.param('id');
    
    if (user.role !== 'admin') {
      return c.json({ error: 'Access denied: only admins can archive policies' }, 403);
    }
    
    const policy = await kv.get(`policy:doc:${policyId}`) as PolicyDocument | null;
    
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    policy.status = 'archived';
    policy.archived_at = new Date().toISOString();
    
    await kv.set(`policy:doc:${policyId}`, policy);
    
    // Log audit
    await logAudit({
      action: 'archive',
      entity_type: 'policy',
      entity_id: policyId,
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: { title: policy.title },
    });
    
    return c.json(policy);
  } catch (error: any) {
    console.error('Archive policy error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.postIdArchive', error);
  }
});

// ============================================================================
// ROUTES - POLICY ASSIGNMENTS
// ============================================================================

// Get all assignments (manager/admin view)
app.get('/assignments', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view_all')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }
    
    const allAssignments = await kv.getByPrefix('policy:assignment:') as PolicyAssignment[];
    
    // Filter by location for managers
    let filtered = allAssignments;
    if (user.role === 'manager') {
      filtered = allAssignments.filter(a => 
        !a.location_scope || a.location_scope.length === 0 ||
        a.location_scope.some(loc => user.locationIds.includes(loc))
      );
    }
    
    return c.json(filtered);
  } catch (error: any) {
    console.error('Get assignments error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getAssignments', error);
  }
});

// Get assignments for a specific policy
app.get('/:policyId/assignments', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const policyId = c.req.param('policyId');
    
    if (!hasPermission(user.role, 'view_all')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }
    
    const assignments = await kv.getByPrefix(`policy:assignment:policy:${policyId}:`) as PolicyAssignment[];
    
    return c.json(assignments);
  } catch (error: any) {
    console.error('Get policy assignments error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getPolicyIdAssignments', error);
  }
});

// Create assignment(s)
app.post('/assignments', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'assign')) {
      return c.json({ error: 'Access denied: insufficient permissions to assign policies' }, 403);
    }
    
    const body = await c.req.json();
    const { policy_id, user_ids, due_date, location_scope, role_scope, is_blocking, assignment_type } = body;
    
    if (!policy_id || !due_date || !user_ids || user_ids.length === 0) {
      return c.json({ error: 'Missing required fields: policy_id, user_ids, due_date' }, 400);
    }
    
    const policy = await kv.get(`policy:doc:${policy_id}`) as PolicyDocument | null;
    
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    if (policy.status !== 'published') {
      return c.json({ error: 'Can only assign published policies' }, 400);
    }
    
    // Get user details for assignments
    const supabase = getSupabase();
    const { data: { users: allUsers } } = await supabase.auth.admin.listUsers();
    
    const assignments: PolicyAssignment[] = [];
    
    for (const userId of user_ids) {
      const targetUser = allUsers.find(u => u.id === userId);
      if (!targetUser) continue;
      
      const assignmentId = generateId();
      
      const assignment: PolicyAssignment = {
        id: assignmentId,
        policy_id: policy_id,
        policy_title: policy.title,
        policy_version: policy.version,
        assigned_to_user_id: userId,
        assigned_to_name: targetUser.user_metadata?.name || targetUser.email!,
        assigned_to_email: targetUser.email!,
        assigned_by_user_id: user.id,
        assigned_by_name: user.name,
        due_date,
        status: 'pending',
        location_scope,
        role_scope,
        is_blocking: is_blocking || false,
        assignment_type: assignment_type || 'individual',
        created_at: new Date().toISOString(),
      };
      
      // Store with multiple indexes for efficient retrieval
      await kv.set(`policy:assignment:${assignmentId}`, assignment);
      await kv.set(`policy:assignment:user:${userId}:${assignmentId}`, assignment);
      await kv.set(`policy:assignment:policy:${policy_id}:${assignmentId}`, assignment);
      
      assignments.push(assignment);
      
      // Log audit
      await logAudit({
        action: 'assign',
        entity_type: 'assignment',
        entity_id: assignmentId,
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        details: {
          policy_title: policy.title,
          assigned_to: assignment.assigned_to_name,
          due_date,
        },
      });
    }
    
    return c.json(assignments, 201);
  } catch (error: any) {
    console.error('Create assignments error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.postAssignments', error);
  }
});

// ============================================================================
// ROUTES - ACKNOWLEDGEMENTS
// ============================================================================

// Get acknowledgements for a policy
app.get('/:policyId/acknowledgements', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const policyId = c.req.param('policyId');
    
    if (!hasPermission(user.role, 'view_all')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }
    
    const acknowledgements = await kv.getByPrefix(`policy:ack:policy:${policyId}:`) as PolicyAcknowledgement[];
    
    return c.json(acknowledgements);
  } catch (error: any) {
    console.error('Get acknowledgements error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getPolicyIdAcknowledgements', error);
  }
});

// Create acknowledgement
app.post('/assignments/:assignmentId/acknowledge', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const assignmentId = c.req.param('assignmentId');
    
    const body = await c.req.json();
    const { viewed_at, ip_address, user_agent } = body;
    
    // Get assignment
    const assignment = await kv.get(`policy:assignment:${assignmentId}`) as PolicyAssignment | null;
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404);
    }
    
    // Verify user is the assignee
    if (assignment.assigned_to_user_id !== user.id) {
      return c.json({ error: 'Access denied: you can only acknowledge your own assignments' }, 403);
    }
    
    // Check if already acknowledged
    if (assignment.status === 'acknowledged') {
      return c.json({ error: 'Assignment already acknowledged' }, 400);
    }
    
    const ackId = generateId();
    const now = new Date().toISOString();
    
    const acknowledgement: PolicyAcknowledgement = {
      id: ackId,
      assignment_id: assignmentId,
      policy_id: assignment.policy_id,
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      acknowledged_at: now,
      viewed_at,
      ip_address,
      user_agent,
      signature_data: user.name, // Full name confirmation
    };
    
    // Store acknowledgement with multiple indexes
    await kv.set(`policy:ack:${ackId}`, acknowledgement);
    await kv.set(`policy:ack:assignment:${assignmentId}`, acknowledgement);
    await kv.set(`policy:ack:policy:${assignment.policy_id}:${ackId}`, acknowledgement);
    await kv.set(`policy:ack:user:${user.id}:${ackId}`, acknowledgement);
    
    // Update assignment status
    assignment.status = 'acknowledged';
    await kv.set(`policy:assignment:${assignmentId}`, assignment);
    await kv.set(`policy:assignment:user:${user.id}:${assignmentId}`, assignment);
    await kv.set(`policy:assignment:policy:${assignment.policy_id}:${assignmentId}`, assignment);
    
    // Log audit
    await logAudit({
      action: 'acknowledge',
      entity_type: 'acknowledgement',
      entity_id: ackId,
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: {
        policy_id: assignment.policy_id,
        policy_title: assignment.policy_title,
        viewed: !!viewed_at,
      },
      ip_address,
    });
    
    return c.json(acknowledgement, 201);
  } catch (error: any) {
    console.error('Create acknowledgement error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.postAssignmentsAssignmentIdAcknowledge', error);
  }
});

// Mark policy as viewed (tracking signal before acknowledgement)
app.post('/assignments/:assignmentId/view', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const assignmentId = c.req.param('assignmentId');
    
    const assignment = await kv.get(`policy:assignment:${assignmentId}`) as PolicyAssignment | null;
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404);
    }
    
    if (assignment.assigned_to_user_id !== user.id) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    if (assignment.status === 'pending') {
      assignment.status = 'viewed';
      await kv.set(`policy:assignment:${assignmentId}`, assignment);
      await kv.set(`policy:assignment:user:${user.id}:${assignmentId}`, assignment);
      await kv.set(`policy:assignment:policy:${assignment.policy_id}:${assignmentId}`, assignment);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Mark view error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.postAssignmentsAssignmentIdView', error);
  }
});

// ============================================================================
// ROUTES - COMPLIANCE DASHBOARD
// ============================================================================

// Get compliance statistics
app.get('/compliance/stats', async (c) => {
  try {
    console.log('📊 [BACKEND-POLICIES] === COMPLIANCE STATS REQUEST START ===');
    console.log('📊 [BACKEND-POLICIES] Request URL:', c.req.url);
    console.log('📊 [BACKEND-POLICIES] Request method:', c.req.method);
    
    console.log('📊 [BACKEND-POLICIES] Step 1: Reading authenticated user...');
    const user = c.get('user') as AuthenticatedUser;
    console.log('📊 [BACKEND-POLICIES] Step 2: User authenticated:', { 
      id: user.id, 
      role: user.role, 
      locationIds: user.locationIds 
    });
    
    console.log('📊 [BACKEND-POLICIES] Step 3: Checking permissions...');
    if (!hasPermission(user.role, 'view_all')) {
      console.error('❌ [BACKEND-POLICIES] Permission denied for user role:', user.role);
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }
    console.log('✅ [BACKEND-POLICIES] Permission check passed');
    
    console.log('📊 [BACKEND-POLICIES] Step 4: Fetching data from KV store...');
    const assignments = await kv.getByPrefix('policy:assignment:') as PolicyAssignment[];
    const policies = await kv.getByPrefix('policy:doc:') as PolicyDocument[];
    
    console.log('📊 [BACKEND-POLICIES] Step 5: Data fetched:', {
      assignmentsCount: assignments.length,
      policiesCount: policies.length,
      assignmentsType: typeof assignments,
      policiesType: typeof policies,
      assignmentsIsArray: Array.isArray(assignments),
      policiesIsArray: Array.isArray(policies)
    });
    
    // Filter by location for managers
    let filteredAssignments = assignments;
    if (user.role === 'manager') {
      console.log('📊 [BACKEND-POLICIES] User is manager, filtering by location...');
      filteredAssignments = assignments.filter(a => 
        !a.location_scope || a.location_scope.length === 0 ||
        a.location_scope.some(loc => user.locationIds.includes(loc))
      );
      console.log('📊 [BACKEND-POLICIES] Filtered to', filteredAssignments.length, 'assignments');
    }
    
    const now = new Date();
    console.log('📊 [BACKEND-POLICIES] Step 6: Calculating statistics...');
    
    // Calculate statistics
    const stats = {
      total_policies: policies.filter(p => p.status === 'published').length,
      total_assignments: filteredAssignments.length,
      acknowledged: filteredAssignments.filter(a => a.status === 'acknowledged').length,
      overdue: filteredAssignments.filter(a => {
        if (a.status === 'acknowledged') return false;
        return now > new Date(a.due_date);
      }).length,
      pending: filteredAssignments.filter(a => a.status === 'pending').length,
      viewed: filteredAssignments.filter(a => a.status === 'viewed').length,
      completion_rate: filteredAssignments.length > 0 
        ? Math.round((filteredAssignments.filter(a => a.status === 'acknowledged').length / filteredAssignments.length) * 100)
        : 0,
      due_soon: filteredAssignments.filter(a => {
        if (a.status === 'acknowledged') return false;
        const dueDate = new Date(a.due_date);
        const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= 0 && daysDiff <= 7;
      }).length,
    };
    
    console.log('✅ [BACKEND-POLICIES] Step 7: Stats calculated successfully:', stats);
    console.log('📊 [BACKEND-POLICIES] === COMPLIANCE STATS REQUEST END ===');
    return c.json(stats);
  } catch (error: any) {
    console.error('❌ [BACKEND-POLICIES] ========== ERROR IN COMPLIANCE STATS ==========');
    console.error('❌ [BACKEND-POLICIES] Error message:', error.message);
    console.error('❌ [BACKEND-POLICIES] Error stack:', error.stack);
    console.error('❌ [BACKEND-POLICIES] Error name:', error.name);
    console.error('❌ [BACKEND-POLICIES] ===============================================');
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getComplianceStats', error);
  }
});

// Get compliance by policy
app.get('/compliance/by-policy', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'view_all')) {
      return c.json({ error: 'Access denied: insufficient permissions' }, 403);
    }
    
    const policies = await kv.getByPrefix('policy:doc:') as PolicyDocument[];
    const publishedPolicies = policies.filter(p => p.status === 'published');
    
    const complianceByPolicy = [];
    
    for (const policy of publishedPolicies) {
      const assignments = await kv.getByPrefix(`policy:assignment:policy:${policy.id}:`) as PolicyAssignment[];
      
      const acknowledged = assignments.filter(a => a.status === 'acknowledged').length;
      const total = assignments.length;
      
      complianceByPolicy.push({
        policy_id: policy.id,
        policy_title: policy.title,
        policy_version: policy.version,
        total_assignments: total,
        acknowledged,
        pending: assignments.filter(a => a.status === 'pending').length,
        overdue: assignments.filter(a => a.status === 'overdue').length,
        completion_rate: total > 0 ? Math.round((acknowledged / total) * 100) : 0,
      });
    }
    
    return c.json(complianceByPolicy);
  } catch (error: any) {
    console.error('Get compliance by policy error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getComplianceByPolicy', error);
  }
});

// ============================================================================
// ROUTES - AUDIT LOG
// ============================================================================

// Get audit logs
app.get('/audit', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (user.role !== 'admin') {
      return c.json({ error: 'Access denied: only admins can view audit logs' }, 403);
    }
    
    const logs = await kv.getByPrefix('audit:policy:') as AuditLog[];
    
    // Filter out the by_time index entries (they're just IDs)
    const actualLogs = logs.filter(item => typeof item === 'object' && item.action);
    
    // Sort by timestamp descending
    actualLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return c.json(actualLogs);
  } catch (error: any) {
    console.error('Get audit logs error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getAudit', error);
  }
});

// ============================================================================
// ROUTES - EXPORTS
// ============================================================================

// Export acknowledgements (CSV data)
app.get('/export/acknowledgements', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'export')) {
      return c.json({ error: 'Access denied: insufficient permissions to export data' }, 403);
    }
    
    const acknowledgements = await kv.getByPrefix('policy:ack:') as PolicyAcknowledgement[];
    
    // Filter out indexed duplicates
    const uniqueAcks = acknowledgements.filter(ack => 
      typeof ack === 'object' && ack.id && !ack.id.includes(':')
    );
    
    // Log export
    await logAudit({
      action: 'export',
      entity_type: 'acknowledgement',
      entity_id: 'bulk_export',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: { count: uniqueAcks.length, type: 'acknowledgements' },
    });
    
    return c.json(uniqueAcks);
  } catch (error: any) {
    console.error('Export acknowledgements error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getExportAcknowledgements', error);
  }
});

// Export assignments (CSV data)
app.get('/export/assignments', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    
    if (!hasPermission(user.role, 'export')) {
      return c.json({ error: 'Access denied: insufficient permissions to export data' }, 403);
    }
    
    const assignments = await kv.getByPrefix('policy:assignment:') as PolicyAssignment[];
    
    // Filter out indexed duplicates and location-filter for managers
    let filtered = assignments.filter(a => 
      typeof a === 'object' && a.id && !a.id.includes(':')
    );
    
    if (user.role === 'manager') {
      filtered = filtered.filter(a => 
        !a.location_scope || a.location_scope.length === 0 ||
        a.location_scope.some(loc => user.locationIds.includes(loc))
      );
    }
    
    // Log export
    await logAudit({
      action: 'export',
      entity_type: 'assignment',
      entity_id: 'bulk_export',
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      details: { count: filtered.length, type: 'assignments' },
    });
    
    return c.json(filtered);
  } catch (error: any) {
    console.error('Export assignments error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getExportAssignments', error);
  }
});

// ============================================================================
// ROUTES - STORAGE SIGNED URLs
// ============================================================================

// Get signed URL for policy document
app.get('/:policyId/download-url', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const policyId = c.req.param('policyId');
    
    const policy = await kv.get(`policy:doc:${policyId}`) as PolicyDocument | null;
    
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    // Check if user has access
    if (user.role === 'staff') {
      const assignments = await kv.getByPrefix(`policy:assignment:user:${user.id}:`) as PolicyAssignment[];
      const hasAssignment = assignments.some(a => a.policy_id === policyId);
      
      if (!hasAssignment) {
        return c.json({ error: 'Access denied: policy not assigned to you' }, 403);
      }
    }
    
    // Generate signed URL
    const supabase = getSupabase();
    const bucketName = 'make-fc003b23-policies';
    
    // Extract file path from file_url
    const fileName = policy.file_url.split('/').pop() || `${policyId}.${policy.file_type}`;
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Create signed URL error:', error);
      return c.json({ error: 'Failed to generate download URL' }, 500);
    }
    
    return c.json({ url: data.signedUrl });
  } catch (error: any) {
    console.error('Get download URL error:', error);
    if (error.message?.includes('Unauthorized')) return c.json({ error: 'Unauthorized' }, 401);
    return internalError(c, 'policies.getPolicyIdDownloadUrl', error);
  }
});

export default app;