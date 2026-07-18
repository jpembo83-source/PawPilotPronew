// Staff Management Routes - Paw Pilot Pro
// Handles staff directory, policies, acknowledgements, and rotas with full tenant isolation
// **IMPORTANT**: Staff members are sourced from Settings → Users & Access (NO SEED DATA)
// Staff = any user in the tenant with a staff-type role (manager, assistant_manager, staff, driver, groomer, etc.)

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { requireAuth, AuthenticatedUser } from './_shared/auth.ts';
import { internalError } from './_shared/log.ts';

const app = new Hono();

// Every staff route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY. The local getUserFromToken
// helper that used to live here had a dev-mode JWT-decode-without-validation
// fallback (the same anti-pattern 1B.1 removed from settings_rbac.ts) — both
// it and the getTenantId/getUserId pickers are removed; the per-route
// pattern is now `const user = c.get('user') as AuthenticatedUser`.
//
// `createClient` is still imported below because some routes generate signed
// Supabase Storage URLs server-side using SERVICE_ROLE_KEY (legitimate use).
app.use('*', requireAuth);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================


function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Staff-type roles (exclude platform_admin and customer roles)
const STAFF_ROLES = [
  'staff',
  'driver',
  'groomer',
  'overnight_staff',
  'assistant_manager',
  'manager',
  'daycare_assistant',
  'transport_driver',
  'admin', // tenant admin (not platform admin)
];

// Check if role is a staff-type role
function isStaffRole(role: string): boolean {
  return STAFF_ROLES.includes(role);
}

// ============================================================================
// STAFF / TEAM DIRECTORY
// ============================================================================

// List all staff members - LIVE DATA FROM SETTINGS (NO SEED DATA)
app.get('/', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    if (!tenantId) {
      return c.json({ error: 'Tenant ID required' }, 400);
    }
    
    const search = c.req.query('search');
    const role = c.req.query('role');
    const location_id = c.req.query('location_id');
    const status = c.req.query('status');
    
    console.log('[Staff Directory] Fetching staff for tenant:', tenantId);
    
    // Fetch all users from the KV store (these are created via Settings → Users & Access)
    const allUsersRaw = await kv.getByPrefix(`user:${tenantId}:profile:`);
    console.log('[Staff Directory] Found', allUsersRaw.length, 'total users in tenant');
    
    // Parse users and filter to only staff-type roles
    // IMPORTANT: KV store returns already-parsed objects, not JSON strings
    let staff = allUsersRaw
      .map(item => {
        try {
          // Check if item is already an object
          if (typeof item === 'object' && item !== null) {
            return item;
          }
          // If it's a string, parse it
          return JSON.parse(item);
        } catch (e) {
          console.error('[Staff Directory] Failed to parse user:', e);
          return null;
        }
      })
      .filter(user => {
        // Filter out null/invalid users
        if (!user) return false;
        
        // Filter out users with Global Access (admin role)
        if (user.role === 'admin') return false;
        
        // Only include staff-type roles
        return isStaffRole(user.role);
      });
    
    // CRITICAL: Deduplicate by ID to prevent duplicate key errors
    const staffMap = new Map();
    staff.forEach((member: any) => {
      if (!staffMap.has(member.id)) {
        staffMap.set(member.id, member);
      }
    });
    staff = Array.from(staffMap.values());
    
    console.log('[Staff Directory] Found', staff.length, 'staff members (filtered from users)');
    
    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      staff = staff.filter((s: any) =>
        s.name?.toLowerCase().includes(searchLower) ||
        s.email?.toLowerCase().includes(searchLower)
      );
    }
    
    if (role) {
      staff = staff.filter((s: any) => s.role === role);
    }
    
    if (location_id && location_id !== 'ALL') {
      staff = staff.filter((s: any) => {
        const locationIds = s.locationIds || [];
        return locationIds.includes(location_id) || locationIds.includes('all');
      });
    }
    
    if (status) {
      const isActiveFilter = status === 'active';
      staff = staff.filter((s: any) => s.isActive === isActiveFilter);
    }
    
    // Calculate compliance stats for each staff member
    const enriched = await Promise.all(staff.map(async (member: any) => {
      // Get assigned policies
      const assignments = await kv.getByPrefix(`staff:${tenantId}:assignment:user:${member.id}:`);
      const assignmentData = assignments.map(a => {
        try {
          // Check if already an object
          if (typeof a === 'object' && a !== null) {
            return a;
          }
          return JSON.parse(a);
        } catch (e) {
          return null;
        }
      }).filter(a => a !== null);
      
      const acknowledged = assignmentData.filter((a: any) => a.acknowledged_at).length;
      const overdue = assignmentData.filter((a: any) => {
        if (a.acknowledged_at) return false;
        return new Date(a.due_date) < new Date();
      }).length;
      
      // Get upcoming shifts count
      const today = new Date().toISOString().split('T')[0];
      const shiftsRaw = await kv.getByPrefix(`staff:${tenantId}:shift:user:${member.id}:`);
      const shifts = shiftsRaw.map(s => {
        try {
          return JSON.parse(s);
        } catch (e) {
          return null;
        }
      }).filter(s => s !== null && s.shift_date >= today);
      
      // Map to StaffProfile format
      return {
        id: member.id,
        tenant_id: tenantId,
        user_id: member.id,
        first_name: member.name?.split(' ')[0] || member.name || 'Unknown',
        last_name: member.name?.split(' ').slice(1).join(' ') || '',
        email: member.email,
        phone: member.phone || '',
        role_key: member.role,
        location_ids: member.locationIds || [],
        status: member.isActive ? 'active' : 'inactive',
        last_login: member.lastLogin,
        created_at: member.createdAt || new Date().toISOString(),
        updated_at: member.updatedAt || new Date().toISOString(),
        assigned_policies_count: assignmentData.length,
        overdue_policies_count: overdue,
        upcoming_shifts_count: shifts.length,
        compliance_rate: assignmentData.length > 0 
          ? Math.round((acknowledged / assignmentData.length) * 100) 
          : 100,
      };
    }));
    
    console.log('[Staff Directory] Returning', enriched.length, 'staff members with compliance stats');
    
    return c.json(enriched);
  } catch (error: any) {
    console.error('List staff error:', error);
    return internalError(c, 'staff.getRoot', error);
  }
});

// ============================================================================
// POLICIES (MUST COME BEFORE /:id ROUTE!)
// ============================================================================

// List policies
app.get('/policies', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    const search = c.req.query('search');
    const category = c.req.query('category');
    const status = c.req.query('status');
    
    console.log('[List Policies] Fetching policies for tenant:', tenantId);
    console.log('[List Policies] Using prefix:', `staff:${tenantId}:policy:`);
    
    // Fetch all policies
    const allPolicies = await kv.getByPrefix(`staff:${tenantId}:policy:`);
    console.log('[List Policies] Found raw policies:', allPolicies.length);
    console.log('[List Policies] Raw data sample:', allPolicies.slice(0, 2));
    
    let policies = allPolicies
      .map(item => {
        try {
          // Check if item is already an object (KV store auto-parses)
          if (typeof item === 'object' && item !== null) {
            return item;
          }
          // If it's a string, parse it
          return JSON.parse(item);
        } catch (e) {
          console.error('[List Policies] Failed to parse policy:', e);
          return null;
        }
      })
      .filter(p => {
        if (!p) return false;
        // Filter out policy versions (they have IDs starting with 'pv_')
        // Only keep policy objects (IDs starting with 'pol_')
        const isPolicyObject = p.id && p.id.startsWith('pol_');
        if (!isPolicyObject) {
          console.log('[List Policies] Filtering out non-policy item:', p.id);
        }
        return isPolicyObject;
      });
    
    console.log('[List Policies] Parsed policies count:', policies.length);
    console.log('[List Policies] Policy IDs:', policies.map((p: any) => p.id));
    
    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      policies = policies.filter((p: any) =>
        p.title?.toLowerCase().includes(searchLower)
      );
    }
    
    if (category) {
      policies = policies.filter((p: any) => p.category === category);
    }
    
    if (status) {
      policies = policies.filter((p: any) => p.status === status);
    }
    
    console.log('[List Policies] Returning', policies.length, 'policies after filters');
    
    return c.json(policies);
  } catch (error: any) {
    console.error('[List Policies] ERROR:', error);
    console.error('[List Policies] Error stack:', error.stack);
    return internalError(c, 'staff.getPolicies', error);
  }
});

// Create policy
app.post('/policies', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    
    console.log('[Create Policy] Request received');
    console.log('[Create Policy] Content-Type:', c.req.header('Content-Type'));
    
    let body;
    try {
      body = await c.req.json();
    } catch (parseError: any) {
      console.error('[Create Policy] JSON parse error:', parseError);
      return c.json({ error: 'Invalid JSON' }, 400);
    }
    
    const policyId = generateId('pol');
    
    const policy = {
      id: policyId,
      tenant_id: tenantId,
      title: body.title,
      category: body.category,
      status: 'draft' as const,
      created_by: userId,
      created_by_name: user.user_metadata?.name || user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      versions_count: 0,
    };
    
    console.log('[Create Policy] Saving policy with key:', `staff:${tenantId}:policy:${policyId}`);
    
    await kv.set(`staff:${tenantId}:policy:${policyId}`, policy);
    
    console.log('[Create Policy] Policy saved successfully');
    
    return c.json(policy);
  } catch (error: any) {
    console.error('[Create Policy] Error:', error);
    console.error('[Create Policy] Error stack:', error.stack);
    return internalError(c, 'staff.postPolicies', error);
  }
});

// Get policy by ID
app.get('/policies/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const policyId = c.req.param('id');
    
    const policy = await kv.get(`staff:${tenantId}:policy:${policyId}`);
    
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    // Get versions
    const versionsRaw = await kv.getByPrefix(`staff:${tenantId}:policy:${policyId}:version:`);
    const versions = versionsRaw.map(v => {
      try {
        if (typeof v === 'object' && v !== null) {
          return v;
        }
        return JSON.parse(v);
      } catch (e) {
        return null;
      }
    }).filter(v => v !== null);
    
    return c.json({
      ...policy,
      versions,
    });
  } catch (error: any) {
    console.error('Get policy error:', error);
    return internalError(c, 'staff.getPoliciesId', error);
  }
});

// Publish policy
app.post('/policies/:id/publish', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const policyId = c.req.param('id');
    
    const policy = await kv.get(`staff:${tenantId}:policy:${policyId}`) as any;
    
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    if (policy.status === 'published') {
      return c.json({ error: 'Policy already published' }, 400);
    }
    
    policy.status = 'published';
    policy.published_at = new Date().toISOString();
    policy.updated_at = new Date().toISOString();
    
    await kv.set(`staff:${tenantId}:policy:${policyId}`, policy);
    
    return c.json(policy);
  } catch (error: any) {
    console.error('Publish policy error:', error);
    return internalError(c, 'staff.postPoliciesIdPublish', error);
  }
});

// Archive policy
app.post('/policies/:id/archive', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const policyId = c.req.param('id');
    
    const policy = await kv.get(`staff:${tenantId}:policy:${policyId}`) as any;
    
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    policy.status = 'archived';
    policy.updated_at = new Date().toISOString();
    
    await kv.set(`staff:${tenantId}:policy:${policyId}`, policy);
    
    return c.json(policy);
  } catch (error: any) {
    console.error('Archive policy error:', error);
    return internalError(c, 'staff.postPoliciesIdArchive', error);
  }
});

// Create policy version
app.post('/policies/:id/versions', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const policyId = c.req.param('id');
    
    const policy = await kv.get(`staff:${tenantId}:policy:${policyId}`);
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    console.log('[Create Policy Version] Request received for policy:', policyId);
    console.log('[Create Policy Version] Content-Type:', c.req.header('Content-Type'));
    
    let body;
    try {
      body = await c.req.json();
    } catch (parseError: any) {
      console.error('[Create Policy Version] JSON parse error:', parseError);
      return c.json({ error: 'Invalid JSON' }, 400);
    }
    
    const versionId = generateId('pv');
    
    // Get existing versions to determine version number
    const existingVersions = await kv.getByPrefix(`staff:${tenantId}:policy:${policyId}:version:`);
    const versionNumber = existingVersions.length + 1;
    
    // Create storage path
    const bucketName = 'make-fc003b23-policy-documents';
    const filePath = `${tenantId}/${policyId}/${versionId}/${body.file_name}`;
    
    const version = {
      id: versionId,
      tenant_id: tenantId,
      policy_id: policyId,
      version_number: versionNumber,
      file_name: body.file_name,
      file_type: body.file_type,
      file_size: body.file_size,
      file_path: filePath,
      storage_bucket: bucketName,
      effective_date: body.effective_date,
      expiry_date: body.expiry_date,
      created_by: userId,
      created_by_name: user.user_metadata?.name || user.email,
      created_at: new Date().toISOString(),
    };
    
    console.log('[Create Policy Version] Saving version:', versionId);
    await kv.set(`staff:${tenantId}:policy:${policyId}:version:${versionId}`, version);
    
    // Update policy version count
    policy.versions_count = versionNumber;
    policy.latest_version = version;
    policy.updated_at = new Date().toISOString();
    await kv.set(`staff:${tenantId}:policy:${policyId}`, policy);
    
    console.log('[Create Policy Version] Version created successfully');
    
    // Generate signed upload URL for Supabase Storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    
    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    if (!bucketExists) {
      console.log('[Create Policy Version] Creating bucket:', bucketName);
      await supabase.storage.createBucket(bucketName, { public: false });
    }
    
    // Generate signed upload URL (valid for 60 minutes)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .createSignedUploadUrl(filePath);
    
    if (uploadError) {
      console.error('[Create Policy Version] Upload URL error:', uploadError);
      throw new Error(`Failed to generate upload URL: ${uploadError.message}`);
    }
    
    console.log('[Create Policy Version] Generated upload URL');
    
    return c.json({ 
      version, 
      upload_url: uploadData.signedUrl,
      upload_token: uploadData.token,
      upload_path: uploadData.path,
    });
  } catch (error: any) {
    console.error('[Create Policy Version] Error:', error);
    console.error('[Create Policy Version] Error stack:', error.stack);
    return internalError(c, 'staff.postPoliciesIdVersions', error);
  }
});

// Get policy download URL
app.get('/policies/:id/versions/:versionId/download', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const policyId = c.req.param('id');
    const versionId = c.req.param('versionId');
    
    const version = await kv.get(`staff:${tenantId}:policy:${policyId}:version:${versionId}`);
    
    if (!version) {
      return c.json({ error: 'Policy version not found' }, 404);
    }
    
    // Generate signed download URL from Supabase Storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    
    const bucketName = version.storage_bucket || 'make-fc003b23-policy-documents';
    const filePath = version.file_path;
    
    // Check if file exists in storage
    const { data: existsData, error: existsError } = await supabase.storage
      .from(bucketName)
      .list(filePath.substring(0, filePath.lastIndexOf('/')), {
        search: filePath.substring(filePath.lastIndexOf('/') + 1)
      });
    
    if (existsError || !existsData || existsData.length === 0) {
      console.log('[Download URL] File not found in storage:', filePath);
      return c.json({ 
        error: 'Document file not available in storage. This policy may have been created before document storage was implemented.',
        file_available: false,
      }, 404);
    }
    
    // Generate signed URL (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600);
    
    if (error) {
      console.error('Download URL error:', error);
      return c.json({ 
        error: 'Document file not available. This policy may have been created before document storage was implemented.',
        file_available: false,
      }, 404);
    }
    
    return c.json({ 
      download_url: data.signedUrl,
      file_name: version.file_name,
      file_type: version.file_type,
      file_available: true,
    });
  } catch (error: any) {
    console.error('Get download URL error:', error);
    return internalError(c, 'staff.getPoliciesIdVersionsVersionIdDownload', error);
  }
});

// Delete policy
app.delete('/policies/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const policyId = c.req.param('id');
    
    console.log('[Delete Policy] Deleting policy:', policyId);
    
    const policy = await kv.get(`staff:${tenantId}:policy:${policyId}`);
    if (!policy) {
      return c.json({ error: 'Policy not found' }, 404);
    }
    
    // Delete all versions
    const versionsRaw = await kv.getByPrefix(`staff:${tenantId}:policy:${policyId}:version:`);
    console.log('[Delete Policy] Deleting', versionsRaw.length, 'versions');
    
    for (const versionData of versionsRaw) {
      try {
        const version = typeof versionData === 'object' ? versionData : JSON.parse(versionData);
        await kv.del(`staff:${tenantId}:policy:${policyId}:version:${version.id}`);
      } catch (e) {
        console.error('[Delete Policy] Error deleting version:', e);
      }
    }
    
    // Delete all assignments
    const assignmentsRaw = await kv.getByPrefix(`staff:${tenantId}:assignment:`);
    for (const assignmentData of assignmentsRaw) {
      try {
        const assignment = typeof assignmentData === 'object' ? assignmentData : JSON.parse(assignmentData);
        if (assignment.policy_id === policyId) {
          await kv.del(`staff:${tenantId}:assignment:${assignment.id}`);
          // Also delete user-specific assignment keys
          if (assignment.user_id) {
            await kv.del(`staff:${tenantId}:assignment:user:${assignment.user_id}:${assignment.id}`);
          }
        }
      } catch (e) {
        console.error('[Delete Policy] Error deleting assignment:', e);
      }
    }
    
    // Delete policy
    await kv.del(`staff:${tenantId}:policy:${policyId}`);
    
    console.log('[Delete Policy] Policy deleted successfully');
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Delete Policy] Error:', error);
    return internalError(c, 'staff.deletePoliciesId', error);
  }
});

// My policies (for staff view) - MUST come before /:id route
app.get('/my-policies', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    
    console.log('[/my-policies] Fetching policies for user:', { tenantId, userId });
    
    const prefix = `staff:${tenantId}:assignment:user:${userId}:`;
    console.log('[/my-policies] Searching with prefix:', prefix);
    
    const assignmentsRaw = await kv.getByPrefix(prefix);
    console.log('[/my-policies] Found raw assignments:', assignmentsRaw.length);
    
    const parsedAssignments = assignmentsRaw.map(a => {
      try {
        if (typeof a === 'object' && a !== null) {
          return a;
        }
        return JSON.parse(a);
      } catch (e) {
        console.error('[/my-policies] Failed to parse assignment:', e);
        return null;
      }
    }).filter(a => a !== null);
    
    console.log('[/my-policies] Parsed assignments:', parsedAssignments.length);
    
    // Enrich assignments with policy details
    const enrichedAssignments = [];
      
    for (const assignment of parsedAssignments) {
      console.log('[/my-policies] Enriching assignment:', assignment.id);
      
      // Fetch policy details
      const policy = await kv.get(`staff:${tenantId}:policy:${assignment.policy_id}`);
      
      if (!policy) {
        console.warn('[/my-policies] Policy', assignment.policy_id, 'not found for assignment', assignment.id);
        
        // Auto-fix: If policy_id is 'unknown', try to find the correct policy_id from the version
        if (assignment.policy_id === 'unknown' && assignment.policy_version_id) {
          console.log('[/my-policies] Attempting auto-fix for assignment:', assignment.id);
          
          // Look up the policy version to get the policy_id
          const allVersionsRaw = await kv.getByPrefix(`staff:${tenantId}:policy:`);
          let foundPolicyId = null;
          
          for (const versionItem of allVersionsRaw) {
            try {
              const versionData = typeof versionItem === 'object' && versionItem !== null ? versionItem : JSON.parse(versionItem);
              
              // Check if this is the matching version
              if (versionData && versionData.id === assignment.policy_version_id) {
                foundPolicyId = versionData.policy_id;
                console.log('[/my-policies] Auto-fix: Found policy_id:', foundPolicyId, 'for version:', assignment.policy_version_id);
                break;
              }
            } catch (e) {
              // Skip parse errors
            }
          }
          
          if (foundPolicyId) {
            // Update the assignment with the correct policy_id
            assignment.policy_id = foundPolicyId;
            assignment.updated_at = new Date().toISOString();
            
            // Save the fixed assignment
            const userKey = `staff:${tenantId}:assignment:user:${userId}:${assignment.id}`;
            await kv.set(userKey, assignment);
            console.log('[/my-policies] Auto-fixed assignment:', assignment.id, 'with policy_id:', foundPolicyId);
            
            // Now fetch the policy with the correct ID
            const fixedPolicy = await kv.get(`staff:${tenantId}:policy:${foundPolicyId}`);
            
            if (fixedPolicy) {
              // Fetch the policy version details
              const policyVersion = await kv.get(`staff:${tenantId}:policy:${foundPolicyId}:version:${assignment.policy_version_id}`);
              
              enrichedAssignments.push({
                ...assignment,
                policy: fixedPolicy,
                version: policyVersion,
              });
              
              console.log('[/my-policies] Auto-fixed assignment added to results');
              continue;
            }
          }
        }
        
        continue;
      }
      
      // Fetch version details
      const version = await kv.get(`staff:${tenantId}:policy:${assignment.policy_id}:version:${assignment.policy_version_id}`);
      if (!version) {
        console.warn('[/my-policies] Version', assignment.policy_version_id, 'not found for assignment', assignment.id);
        continue;
      }
      
      // Check for acknowledgement
      const acknowledgements = await kv.getByPrefix(`staff:${tenantId}:acknowledgement:assignment:${assignment.id}:`);
      const acknowledgement = acknowledgements.length > 0 ? acknowledgements[0] : null;
      
      // Calculate status
      let status = 'pending';
      const now = new Date();
      const dueDate = new Date(assignment.due_date);
      
      if (acknowledgement) {
        status = 'acknowledged';
      } else if (now > dueDate) {
        status = 'overdue';
      } else if (assignment.viewed_at) {
        status = 'viewed';
      }
      
      // Calculate days until due
      const diffTime = dueDate.getTime() - now.getTime();
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const enriched = {
        id: assignment.id,
        assignment_id: assignment.id, // Include both for compatibility
        policy_id: policy.id,
        policy_title: policy.title,
        policy_version: version.version_number,
        policy_category: policy.category,
        version_id: version.id,
        version_number: version.version_number,
        file_path: version.file_path || '',
        file_name: version.file_name || '',
        assigned_at: assignment.created_at,
        due_date: assignment.due_date,
        assigned_by: assignment.assigned_by,
        assigned_by_name: assignment.assigned_by_name,
        manager_note: assignment.manager_note,
        status,
        viewed_at: assignment.viewed_at || null,
        acknowledged_at: acknowledgement?.acknowledged_at || null,
        acknowledgement,
        is_blocking: assignment.acknowledgement_type === 'blocking',
        days_until_due: daysUntilDue,
      };
      
      console.log('[/my-policies] Enriched assignment:', enriched.id, enriched.policy_title);
      
      enrichedAssignments.push(enriched);
    }
    
    console.log('[/my-policies] Returning enriched assignments:', enrichedAssignments.length);
    
    return c.json(enrichedAssignments);
  } catch (error: any) {
    console.error('[/my-policies] Error:', error);
    return internalError(c, 'staff.getMyPolicies', error);
  }
});

// Get staff member profile - LIVE DATA
app.get('/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const staffId = c.req.param('id');
    
    console.log('[Staff Profile] Fetching profile for:', staffId);
    
    // Fetch user profile from KV store
    const profile = await kv.get(`user:${tenantId}:profile:${staffId}`);
    
    if (!profile) {
      return c.json({ error: 'Staff member not found' }, 404);
    }
    
    // Filter out users with Global Access (admin role)
    if (profile.role === 'admin') {
      return c.json({ error: 'Staff member not found' }, 404);
    }
    
    // Verify this is a staff-type user
    if (!isStaffRole(profile.role)) {
      return c.json({ error: 'User is not a staff member' }, 403);
    }
    
    // Get assigned policies
    const assignments = await kv.getByPrefix(`staff:${tenantId}:assignment:user:${staffId}:`);
    const assignmentData = assignments.map(a => {
      try {
        // Check if already an object
        if (typeof a === 'object' && a !== null) {
          return a;
        }
        return JSON.parse(a);
      } catch (e) {
        return null;
      }
    }).filter(a => a !== null);
    
    const acknowledged = assignmentData.filter((a: any) => a.acknowledged_at).length;
    const overdue = assignmentData.filter((a: any) => {
      if (a.acknowledged_at) return false;
      return new Date(a.due_date) < new Date();
    }).length;
    
    // Get upcoming shifts
    const today = new Date().toISOString().split('T')[0];
    const shiftsRaw = await kv.getByPrefix(`staff:${tenantId}:shift:user:${staffId}:`);
    const shifts = shiftsRaw.map(s => {
      try {
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    }).filter(s => s !== null && s.shift_date >= today);
    
    // Build staff profile response
    const staffProfile = {
      id: profile.id,
      tenant_id: tenantId,
      user_id: profile.id,
      first_name: profile.name?.split(' ')[0] || profile.name || 'Unknown',
      last_name: profile.name?.split(' ').slice(1).join(' ') || '',
      email: profile.email,
      phone: profile.phone || '',
      role_key: profile.role,
      location_ids: profile.locationIds || [],
      status: profile.isActive ? 'active' : 'inactive',
      last_login: profile.lastLogin,
      created_at: profile.createdAt || new Date().toISOString(),
      updated_at: profile.updatedAt || new Date().toISOString(),
      assigned_policies_count: assignmentData.length,
      overdue_policies_count: overdue,
      upcoming_shifts_count: shifts.length,
      compliance_rate: assignmentData.length > 0 
        ? Math.round((acknowledged / assignmentData.length) * 100) 
        : 100,
      // Additional details for profile view
      permissions: profile.permissions || [],
      templateId: profile.templateId,
    };
    
    console.log('[Staff Profile] Returning profile with stats');
    
    return c.json(staffProfile);
  } catch (error: any) {
    console.error('Fetch staff member error:', error);
    return internalError(c, 'staff.getId', error);
  }
});

// ============================================================================
// POLICY ASSIGNMENTS
// ============================================================================

// List assignments
app.get('/policies/assignments', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    const policy_id = c.req.query('policy_id');
    const user_id = c.req.query('user_id');
    
    console.log('[List Assignments] Fetching assignments for tenant:', tenantId, '| policy_id:', policy_id, '| user_id:', user_id);
    
    let prefix = `staff:${tenantId}:assignment:`;
    if (user_id) {
      prefix = `staff:${tenantId}:assignment:user:${user_id}:`;
    }
    
    const assignmentsRaw = await kv.getByPrefix(prefix);
    console.log('[List Assignments] Found', assignmentsRaw.length, 'raw assignments');
    
    let assignments = assignmentsRaw.map(a => {
      try {
        // Check if already an object (KV store may auto-parse)
        if (typeof a === 'object' && a !== null) {
          return a;
        }
        return JSON.parse(a);
      } catch (e) {
        console.error('[List Assignments] Failed to parse assignment:', e);
        return null;
      }
    }).filter(a => a !== null);
    
    // Filter out entries that are just user-indexed duplicates (avoid counting twice)
    // Only include unique assignment IDs
    const seenIds = new Set();
    assignments = assignments.filter((a: any) => {
      if (!a.id || seenIds.has(a.id)) {
        return false;
      }
      seenIds.add(a.id);
      return true;
    });
    
    if (policy_id) {
      assignments = assignments.filter((a: any) => a.policy_id === policy_id);
    }
    
    console.log('[List Assignments] Returning', assignments.length, 'assignments');
    
    return c.json(assignments);
  } catch (error: any) {
    console.error('List assignments error:', error);
    return internalError(c, 'staff.getPoliciesAssignments', error);
  }
});

// Assign policy - Enhanced with repeat cycles and compliance features
app.post('/policies/assign', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    
    console.log('[Assign Policy] Request received');
    
    let body;
    try {
      body = await c.req.json();
    } catch (parseError: any) {
      console.error('[Assign Policy] JSON parse error:', parseError);
      return c.json({ error: 'Invalid JSON' }, 400);
    }
    
    // Validate required fields
    if (!body.policy_id) {
      console.error('[Assign Policy] Missing policy_id');
      return c.json({ error: 'policy_id is required' }, 400);
    }
    
    if (!body.policy_version_id) {
      console.error('[Assign Policy] Missing policy_version_id');
      return c.json({ error: 'policy_version_id is required' }, 400);
    }
    
    if (!body.due_date) {
      console.error('[Assign Policy] Missing due_date');
      return c.json({ error: 'due_date is required' }, 400);
    }
    
    const userIds = body.targets?.user_ids || [];
    if (!userIds || userIds.length === 0) {
      console.error('[Assign Policy] No user_ids provided');
      return c.json({ error: 'At least one user must be selected (targets.user_ids)' }, 400);
    }
    
    // Verify the policy exists
    const policy = await kv.get(`staff:${tenantId}:policy:${body.policy_id}`);
    if (!policy) {
      console.error('[Assign Policy] Policy not found:', body.policy_id);
      return c.json({ error: `Policy not found: ${body.policy_id}` }, 404);
    }
    
    // Verify the version exists
    const version = await kv.get(`staff:${tenantId}:policy:${body.policy_id}:version:${body.policy_version_id}`);
    if (!version) {
      console.error('[Assign Policy] Policy version not found:', body.policy_version_id);
      return c.json({ error: `Policy version not found: ${body.policy_version_id}` }, 404);
    }
    
    console.log('[Assign Policy] Validated - Policy:', policy.title, '| Version:', version.version_number, '| Users:', userIds.length);
    
    const assignmentId = generateId('pa');
    
    // Calculate acknowledgement expiry based on repeat cycle
    let acknowledgementExpiresAt: string | undefined;
    if (body.repeat_cycle && body.repeat_cycle !== 'none') {
      const dueDate = new Date(body.due_date);
      switch (body.repeat_cycle) {
        case 'annual':
          dueDate.setFullYear(dueDate.getFullYear() + 1);
          break;
        case 'biannual':
          dueDate.setMonth(dueDate.getMonth() + 6);
          break;
        case 'quarterly':
          dueDate.setMonth(dueDate.getMonth() + 3);
          break;
        // on_update and on_role_change don't have fixed expiry
      }
      if (['annual', 'biannual', 'quarterly'].includes(body.repeat_cycle)) {
        acknowledgementExpiresAt = dueDate.toISOString();
      }
    }
    
    const assignment = {
      id: assignmentId,
      tenant_id: tenantId,
      policy_version_id: body.policy_version_id,
      policy_id: body.policy_id,  // Already validated above
      scope_type: body.scope_type || 'user',
      assigned_by: userId,
      assigned_by_name: user.user_metadata?.name || user.email,
      due_date: body.due_date,
      acknowledgement_type: body.is_blocking ? 'blocking' : (body.acknowledgement_type || 'simple'),
      is_blocking: body.is_blocking || false,
      reminder_schedule: body.reminder_schedule || { days_before: [7, 3, 1], overdue_reminder: true },
      manager_note: body.manager_note,
      // Repeat cycle configuration
      repeat_cycle: body.repeat_cycle || 'none',
      grace_period_days: body.grace_period_days || 14,
      acknowledgement_expires_at: acknowledgementExpiresAt,
      // Audit trail
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`staff:${tenantId}:assignment:${assignmentId}`, assignment);
    
    // Log audit event
    const auditEvent = {
      id: generateId('audit'),
      tenant_id: tenantId,
      action: 'policy_assigned',
      entity_type: 'policy_assignment',
      entity_id: assignmentId,
      actor_id: userId,
      actor_name: user.user_metadata?.name || user.email,
      details: {
        policy_id: body.policy_id,
        policy_version_id: body.policy_version_id,
        target_count: body.targets?.user_ids?.length || 0,
        due_date: body.due_date,
        is_blocking: body.is_blocking || false,
        repeat_cycle: body.repeat_cycle || 'none',
      },
      timestamp: new Date().toISOString(),
    };
    await kv.set(`staff:${tenantId}:audit:${auditEvent.id}`, auditEvent);
    
    // Create assignment targets for each user
    const results = [];
    
    for (const targetUserId of userIds) {
      const userAssignment = {
        ...assignment,
        user_id: targetUserId,
      };
      
      await kv.set(
        `staff:${tenantId}:assignment:user:${targetUserId}:${assignmentId}`,
        userAssignment
      );
      
      results.push({
        user_id: targetUserId,
        assignment_id: assignmentId,
      });
    }
    
    console.log(`[Assign Policy] Created assignment ${assignmentId} for ${userIds.length} users`);
    
    return c.json({
      assignment,
      targets: results,
      total_assigned: results.length,
    });
  } catch (error: any) {
    console.error('Assign policy error:', error);
    return internalError(c, 'staff.postPoliciesAssign', error);
  }
});

// Get assignment by ID
app.get('/policies/assignments/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const assignmentId = c.req.param('id');
    
    const assignment = await kv.get(`staff:${tenantId}:assignment:${assignmentId}`);
    
    if (!assignment) {
      return c.json({ error: 'Assignment not found' }, 404);
    }
    
    return c.json(assignment);
  } catch (error: any) {
    console.error('Get assignment error:', error);
    return internalError(c, 'staff.getPoliciesAssignmentsId', error);
  }
});

// Acknowledge policy - Enhanced with repeat cycle support and audit trail
app.post('/policies/acknowledge', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    
    const body = await c.req.json();
    const acknowledgementId = generateId('pack');
    const now = new Date();
    const acknowledgedAt = now.toISOString();
    
    // Fetch the assignment to check repeat cycle
    const assignment = await kv.get(`staff:${tenantId}:assignment:user:${userId}:${body.assignment_id}`);
    
    // Calculate next acknowledgement due date based on repeat cycle
    let nextAcknowledgementDue: string | undefined;
    if (assignment?.repeat_cycle && assignment.repeat_cycle !== 'none') {
      const nextDue = new Date(now);
      switch (assignment.repeat_cycle) {
        case 'annual':
          nextDue.setFullYear(nextDue.getFullYear() + 1);
          break;
        case 'biannual':
          nextDue.setMonth(nextDue.getMonth() + 6);
          break;
        case 'quarterly':
          nextDue.setMonth(nextDue.getMonth() + 3);
          break;
        // on_update and on_role_change: triggered by system events, not time-based
      }
      if (['annual', 'biannual', 'quarterly'].includes(assignment.repeat_cycle)) {
        nextAcknowledgementDue = nextDue.toISOString();
      }
    }
    
    const acknowledgement = {
      id: acknowledgementId,
      tenant_id: tenantId,
      policy_version_id: body.policy_version_id,
      policy_id: body.policy_id || 'unknown',
      assignment_id: body.assignment_id,
      user_id: userId,
      user_name: user.user_metadata?.name || user.email,
      user_email: user.email,
      acknowledged_at: acknowledgedAt,
      acknowledgement_text: 'I confirm that I have read, understood, and agree to comply with this policy.',
      typed_name: body.typed_name,
      // Repeat cycle tracking
      next_acknowledgement_due: nextAcknowledgementDue,
      repeat_cycle: assignment?.repeat_cycle,
      // Forensic metadata for legal defensibility
      metadata: {
        ip_address: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
        user_agent: c.req.header('user-agent'),
        session_id: c.req.header('x-session-id'),
        acknowledgement_version: '2.0', // Track acknowledgement format version
      },
    };
    
    // Store acknowledgement (write-once, immutable)
    await kv.set(`staff:${tenantId}:acknowledgement:${acknowledgementId}`, acknowledgement);
    
    // Index by assignment for lookup
    await kv.set(`staff:${tenantId}:acknowledgement:assignment:${body.assignment_id}:${acknowledgementId}`, acknowledgement);
    
    // Index by user for compliance reporting
    await kv.set(`staff:${tenantId}:acknowledgement:user:${userId}:${acknowledgementId}`, acknowledgement);
    
    // Index by policy for audit trail
    await kv.set(`staff:${tenantId}:acknowledgement:policy:${body.policy_id}:${acknowledgementId}`, acknowledgement);
    
    // Update assignment with acknowledgement status
    if (assignment) {
      assignment.acknowledged_at = acknowledgedAt;
      assignment.last_acknowledged_at = acknowledgedAt;
      assignment.acknowledgement_id = acknowledgementId;
      assignment.status = 'acknowledged';
      if (nextAcknowledgementDue) {
        assignment.acknowledgement_expires_at = nextAcknowledgementDue;
        assignment.next_due_date = nextAcknowledgementDue;
      }
      assignment.updated_at = acknowledgedAt;
      
      await kv.set(`staff:${tenantId}:assignment:user:${userId}:${body.assignment_id}`, assignment);
    }
    
    // Log immutable audit event
    const auditEvent = {
      id: generateId('audit'),
      tenant_id: tenantId,
      action: 'policy_acknowledged',
      entity_type: 'policy_acknowledgement',
      entity_id: acknowledgementId,
      actor_id: userId,
      actor_name: user.user_metadata?.name || user.email,
      actor_email: user.email,
      details: {
        policy_id: body.policy_id,
        policy_version_id: body.policy_version_id,
        assignment_id: body.assignment_id,
        typed_name: body.typed_name,
        next_acknowledgement_due: nextAcknowledgementDue,
        repeat_cycle: assignment?.repeat_cycle,
      },
      metadata: acknowledgement.metadata,
      timestamp: acknowledgedAt,
    };
    await kv.set(`staff:${tenantId}:audit:${auditEvent.id}`, auditEvent);
    
    console.log(`[Acknowledge Policy] User ${userId} acknowledged assignment ${body.assignment_id}`);
    
    return c.json({
      ...acknowledgement,
      next_acknowledgement_due: nextAcknowledgementDue,
      is_repeat_cycle: !!nextAcknowledgementDue,
    });
  } catch (error: any) {
    console.error('Acknowledge policy error:', error);
    return internalError(c, 'staff.postPoliciesAcknowledge', error);
  }
});

// ============================================================================
// ROTAS
// ============================================================================

// List rotas
app.get('/rotas', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    const location_id = c.req.query('location_id');
    const start_date = c.req.query('start_date');
    const end_date = c.req.query('end_date');
    
    const rotasRaw = await kv.getByPrefix(`staff:${tenantId}:rota:`);
    let rotas = rotasRaw
      .map(item => {
        try {
          // Check if item is already an object (KV store auto-parses)
          if (typeof item === 'object' && item !== null) {
            return item;
          }
          // If it's a string, parse it
          return JSON.parse(item);
        } catch (e) {
          console.error('[List Rotas] Failed to parse rota:', e);
          return null;
        }
      })
      .filter(r => r !== null && r.id && !r.id.includes(':shift:'));
    
    if (location_id) {
      rotas = rotas.filter((r: any) => r.location_id === location_id);
    }
    
    if (start_date) {
      rotas = rotas.filter((r: any) => r.end_date >= start_date);
    }
    
    if (end_date) {
      rotas = rotas.filter((r: any) => r.start_date <= end_date);
    }
    
    return c.json(rotas);
  } catch (error: any) {
    console.error('List rotas error:', error);
    return internalError(c, 'staff.getRotas', error);
  }
});

// Create rota
app.post('/rotas', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    
    const body = await c.req.json();
    const rotaId = generateId('rot');
    
    const rota = {
      id: rotaId,
      tenant_id: tenantId,
      location_id: body.location_id,
      start_date: body.start_date,
      end_date: body.end_date,
      status: 'draft' as const,
      created_by: userId,
      created_by_name: user.user_metadata?.name || user.email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      shifts_count: 0,
    };
    
    await kv.set(`staff:${tenantId}:rota:${rotaId}`, rota);
    
    return c.json(rota);
  } catch (error: any) {
    console.error('Create rota error:', error);
    return internalError(c, 'staff.postRotas', error);
  }
});

// Get rota by ID
app.get('/rotas/:id', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const rotaId = c.req.param('id');
    
    const rota = await kv.get(`staff:${tenantId}:rota:${rotaId}`);
    
    if (!rota) {
      return c.json({ error: 'Rota not found' }, 404);
    }
    
    // Get shifts
    const shiftsRaw = await kv.getByPrefix(`staff:${tenantId}:rota:${rotaId}:shift:`);
    const shifts = shiftsRaw.map(s => {
      try {
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    }).filter(s => s !== null);
    
    return c.json({
      ...rota,
      shifts,
    });
  } catch (error: any) {
    console.error('Get rota error:', error);
    return internalError(c, 'staff.getRotasId', error);
  }
});

// Publish rota
app.post('/rotas/:id/publish', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    const rotaId = c.req.param('id');
    
    const rota = await kv.get(`staff:${tenantId}:rota:${rotaId}`);
    
    if (!rota) {
      return c.json({ error: 'Rota not found' }, 404);
    }
    
    rota.status = 'published';
    rota.published_by = userId;
    rota.published_by_name = user.user_metadata?.name || user.email;
    rota.published_at = new Date().toISOString();
    rota.updated_at = new Date().toISOString();
    
    await kv.set(`staff:${tenantId}:rota:${rotaId}`, rota);
    
    return c.json(rota);
  } catch (error: any) {
    console.error('Publish rota error:', error);
    return internalError(c, 'staff.postRotasIdPublish', error);
  }
});

// Create shift
app.post('/rotas/:id/shifts', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const rotaId = c.req.param('id');
    
    const rota = await kv.get(`staff:${tenantId}:rota:${rotaId}`);
    if (!rota) {
      return c.json({ error: 'Rota not found' }, 404);
    }
    
    const body = await c.req.json();
    const shiftId = generateId('shift');
    
    const shift = {
      id: shiftId,
      tenant_id: tenantId,
      rota_period_id: rotaId,
      user_id: body.user_id,
      location_id: body.location_id,
      role_key: body.role_key,
      shift_date: body.shift_date,
      start_time: body.start_time,
      end_time: body.end_time,
      notes: body.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`staff:${tenantId}:rota:${rotaId}:shift:${shiftId}`, shift);
    await kv.set(`staff:${tenantId}:shift:user:${body.user_id}:${shiftId}`, shift);
    
    // Update rota shift count
    rota.shifts_count = (rota.shifts_count || 0) + 1;
    await kv.set(`staff:${tenantId}:rota:${rotaId}`, rota);
    
    return c.json(shift);
  } catch (error: any) {
    console.error('Create shift error:', error);
    return internalError(c, 'staff.postRotasIdShifts', error);
  }
});

// Update shift
app.put('/rotas/:rotaId/shifts/:shiftId', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const rotaId = c.req.param('rotaId');
    const shiftId = c.req.param('shiftId');
    
    const shift = await kv.get(`staff:${tenantId}:rota:${rotaId}:shift:${shiftId}`);
    
    if (!shift) {
      return c.json({ error: 'Shift not found' }, 404);
    }
    
    const body = await c.req.json();
    const oldUserId = shift.user_id;
    
    const updated = {
      ...shift,
      ...body,
      updated_at: new Date().toISOString(),
    };
    
    await kv.set(`staff:${tenantId}:rota:${rotaId}:shift:${shiftId}`, updated);
    
    // Update user shift index if user changed
    if (body.user_id && body.user_id !== oldUserId) {
      await kv.del(`staff:${tenantId}:shift:user:${oldUserId}:${shiftId}`);
      await kv.set(`staff:${tenantId}:shift:user:${body.user_id}:${shiftId}`, updated);
    } else {
      await kv.set(`staff:${tenantId}:shift:user:${shift.user_id}:${shiftId}`, updated);
    }
    
    return c.json(updated);
  } catch (error: any) {
    console.error('Update shift error:', error);
    return internalError(c, 'staff.putRotasRotaIdShiftsShiftId', error);
  }
});

// Delete shift
app.delete('/rotas/:rotaId/shifts/:shiftId', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const rotaId = c.req.param('rotaId');
    const shiftId = c.req.param('shiftId');
    
    const shift = await kv.get(`staff:${tenantId}:rota:${rotaId}:shift:${shiftId}`);
    
    if (!shift) {
      return c.json({ error: 'Shift not found' }, 404);
    }
    
    await kv.del(`staff:${tenantId}:rota:${rotaId}:shift:${shiftId}`);
    await kv.del(`staff:${tenantId}:shift:user:${shift.user_id}:${shiftId}`);
    
    // Update rota shift count
    const rota = await kv.get(`staff:${tenantId}:rota:${rotaId}`);
    if (rota) {
      rota.shifts_count = Math.max(0, (rota.shifts_count || 0) - 1);
      await kv.set(`staff:${tenantId}:rota:${rotaId}`, rota);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete shift error:', error);
    return internalError(c, 'staff.deleteRotasRotaIdShiftsShiftId', error);
  }
});

// My rota (for staff view)
app.get('/my-rota', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const userId = user.id;
    
    const shiftsRaw = await kv.getByPrefix(`staff:${tenantId}:shift:user:${userId}:`);
    const shifts = shiftsRaw.map(s => {
      try {
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    }).filter(s => s !== null);

    // Staff roles can't read GET /locations (locations:view is manager+), but
    // they must know WHERE each of their shifts is. Attach only the name of
    // locations they are actually rostered at — nothing else from the record.
    const locationIds = [...new Set(shifts.map(s => s.location_id).filter(Boolean))];
    const locationNames = new Map<string, string>();
    await Promise.all(locationIds.map(async (id) => {
      const loc = await kv.get(`location:${id}`);
      if (loc?.name) locationNames.set(id, loc.name);
    }));
    const enriched = shifts.map(s => ({
      ...s,
      location_name: locationNames.get(s.location_id) ?? s.location_name,
    }));

    return c.json(enriched);
  } catch (error: any) {
    console.error('Fetch my rota error:', error);
    return internalError(c, 'staff.getMyRota', error);
  }
});

// ============================================================================
// COMPLIANCE & BLOCKING POLICIES
// ============================================================================

// Get compliance statistics for all staff
app.get('/policies/compliance/stats', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    console.log('[Compliance Stats] Fetching for tenant:', tenantId);
    
    // Get all policies
    const policiesRaw = await kv.getByPrefix(`staff:${tenantId}:policy:`);
    const policies = policiesRaw
      .map(p => typeof p === 'object' ? p : JSON.parse(p))
      .filter(p => p?.id?.startsWith('pol_'));
    
    // Get all assignments
    const assignmentsRaw = await kv.getByPrefix(`staff:${tenantId}:assignment:`);
    const allAssignments = assignmentsRaw
      .map(a => typeof a === 'object' ? a : JSON.parse(a))
      .filter(a => a?.id?.startsWith('pa_'));
    
    const now = new Date();
    
    // Calculate stats
    const acknowledged = allAssignments.filter(a => a.acknowledged_at).length;
    const overdue = allAssignments.filter(a => {
      if (a.acknowledged_at) return false;
      return new Date(a.due_date) < now;
    }).length;
    const pending = allAssignments.filter(a => !a.acknowledged_at && new Date(a.due_date) >= now).length;
    const dueSoon = allAssignments.filter(a => {
      if (a.acknowledged_at) return false;
      const dueDate = new Date(a.due_date);
      const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff <= 7;
    }).length;
    const blocking = allAssignments.filter(a => 
      a.is_blocking && !a.acknowledged_at && new Date(a.due_date) < now
    ).length;
    
    const stats = {
      total_policies: policies.filter(p => p.status !== 'archived').length,
      total_assignments: allAssignments.length,
      acknowledged,
      pending,
      overdue,
      due_soon: dueSoon,
      blocking_overdue: blocking,
      completion_rate: allAssignments.length > 0 
        ? Math.round((acknowledged / allAssignments.length) * 100) 
        : 100,
    };
    
    console.log('[Compliance Stats] Calculated:', stats);
    
    return c.json(stats);
  } catch (error: any) {
    console.error('Compliance stats error:', error);
    return internalError(c, 'staff.getPoliciesComplianceStats', error);
  }
});

// Check if a staff member has blocking policies (for rota enforcement)
app.get('/policies/blocking/:userId', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    const targetUserId = c.req.param('userId');
    
    // Get user's assignments
    const assignmentsRaw = await kv.getByPrefix(`staff:${tenantId}:assignment:user:${targetUserId}:`);
    const assignments = assignmentsRaw
      .map(a => typeof a === 'object' ? a : JSON.parse(a))
      .filter(a => a !== null);
    
    const now = new Date();
    
    // Find blocking policies that are overdue
    const blockingPolicies = assignments.filter(a => {
      if (!a.is_blocking) return false;
      if (a.acknowledged_at) return false;
      return new Date(a.due_date) < now;
    });
    
    const isBlocked = blockingPolicies.length > 0;
    
    return c.json({
      user_id: targetUserId,
      is_blocked: isBlocked,
      blocking_count: blockingPolicies.length,
      blocking_policies: blockingPolicies.map(a => ({
        assignment_id: a.id,
        policy_id: a.policy_id,
        policy_version_id: a.policy_version_id,
        due_date: a.due_date,
        days_overdue: Math.floor((now.getTime() - new Date(a.due_date).getTime()) / (1000 * 60 * 60 * 24)),
      })),
      message: isBlocked 
        ? `Staff member has ${blockingPolicies.length} overdue blocking policy/policies that must be acknowledged`
        : 'No blocking policies - staff member is compliant',
    });
  } catch (error: any) {
    console.error('Check blocking policies error:', error);
    return internalError(c, 'staff.getPoliciesBlockingUserId', error);
  }
});

// Get compliance report by policy
app.get('/policies/compliance/by-policy', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    // Get all policies
    const policiesRaw = await kv.getByPrefix(`staff:${tenantId}:policy:`);
    const policies = policiesRaw
      .map(p => typeof p === 'object' ? p : JSON.parse(p))
      .filter(p => p?.id?.startsWith('pol_'));
    
    const complianceByPolicy = [];
    const now = new Date();
    
    for (const policy of policies) {
      // Get assignments for this policy
      const assignmentsRaw = await kv.getByPrefix(`staff:${tenantId}:assignment:`);
      const policyAssignments = assignmentsRaw
        .map(a => typeof a === 'object' ? a : JSON.parse(a))
        .filter(a => a?.policy_id === policy.id && a?.id?.startsWith('pa_'));
      
      const acknowledged = policyAssignments.filter(a => a.acknowledged_at).length;
      const overdue = policyAssignments.filter(a => {
        if (a.acknowledged_at) return false;
        return new Date(a.due_date) < now;
      }).length;
      const pending = policyAssignments.filter(a => !a.acknowledged_at && new Date(a.due_date) >= now).length;
      
      complianceByPolicy.push({
        policy_id: policy.id,
        policy_title: policy.title,
        policy_category: policy.category,
        policy_status: policy.status,
        total_assignments: policyAssignments.length,
        acknowledged,
        pending,
        overdue,
        completion_rate: policyAssignments.length > 0 
          ? Math.round((acknowledged / policyAssignments.length) * 100) 
          : 100,
      });
    }
    
    return c.json(complianceByPolicy);
  } catch (error: any) {
    console.error('Compliance by policy error:', error);
    return internalError(c, 'staff.getPoliciesComplianceByPolicy', error);
  }
});

// Export acknowledgements for audit (immutable records)
app.get('/policies/export/acknowledgements', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    // Only managers/admins can export
    // Role lives in app_metadata (server-set, untamperable from client).
    const role = user.app_metadata?.role;
    if (!['admin', 'manager'].includes(role)) {
      return c.json({ error: 'Insufficient permissions to export acknowledgements' }, 403);
    }
    
    // Get all acknowledgements
    const acksRaw = await kv.getByPrefix(`staff:${tenantId}:acknowledgement:`);
    const acknowledgements = acksRaw
      .map(a => typeof a === 'object' ? a : JSON.parse(a))
      .filter(a => a?.id?.startsWith('pack_'))
      .sort((a, b) => new Date(b.acknowledged_at).getTime() - new Date(a.acknowledged_at).getTime());
    
    // Log export action for audit
    const auditEvent = {
      id: generateId('audit'),
      tenant_id: tenantId,
      action: 'acknowledgements_exported',
      entity_type: 'compliance_export',
      entity_id: 'bulk',
      actor_id: user.id,
      actor_name: user.user_metadata?.name || user.email,
      details: {
        record_count: acknowledgements.length,
        export_format: 'json',
      },
      timestamp: new Date().toISOString(),
    };
    await kv.set(`staff:${tenantId}:audit:${auditEvent.id}`, auditEvent);
    
    return c.json({
      exported_at: new Date().toISOString(),
      exported_by: user.user_metadata?.name || user.email,
      record_count: acknowledgements.length,
      acknowledgements,
    });
  } catch (error: any) {
    console.error('Export acknowledgements error:', error);
    return internalError(c, 'staff.getPoliciesExportAcknowledgements', error);
  }
});

// Get audit trail
app.get('/policies/audit', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    // Only managers/admins can view audit trail
    // Role lives in app_metadata (server-set, untamperable from client).
    const role = user.app_metadata?.role;
    if (!['admin', 'manager'].includes(role)) {
      return c.json({ error: 'Insufficient permissions to view audit trail' }, 403);
    }
    
    // Get audit events
    const auditRaw = await kv.getByPrefix(`staff:${tenantId}:audit:`);
    const auditEvents = auditRaw
      .map(a => typeof a === 'object' ? a : JSON.parse(a))
      .filter(a => a?.id?.startsWith('audit_'))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return c.json(auditEvents);
  } catch (error: any) {
    console.error('Get audit trail error:', error);
    return internalError(c, 'staff.getPoliciesAudit', error);
  }
});

// ============================================================================
// CLEANUP (Remove old demo data)
// ============================================================================

// Clean up old demo staff data from KV store
app.delete('/cleanup-demo', async (c) => {
  try {
    const user = c.get('user') as AuthenticatedUser;
    const tenantId = user.tenantId;
    
    console.log('[Cleanup Demo] Removing old demo staff data for tenant:', tenantId);
    
    // Find and delete all demo staff entries (they have IDs like staff_demo_*)
    const allStaffKeys = await kv.getByPrefix(`staff:${tenantId}:member:`);
    let deletedCount = 0;
    
    for (const item of allStaffKeys) {
      try {
        const data = JSON.parse(item);
        if (data.id && data.id.startsWith('staff_demo_')) {
          await kv.del(`staff:${tenantId}:member:${data.id}`);
          if (data.user_id) {
            await kv.del(`staff:${tenantId}:member:user:${data.user_id}`);
          }
          deletedCount++;
          console.log('[Cleanup Demo] Deleted demo staff:', data.id);
        }
      } catch (e) {
        console.error('[Cleanup Demo] Error processing item:', e);
      }
    }
    
    console.log('[Cleanup Demo] Deleted', deletedCount, 'demo staff members');
    
    return c.json({
      success: true,
      message: `Cleaned up ${deletedCount} demo staff members`,
      deletedCount,
    });
  } catch (error: any) {
    console.error('Cleanup demo error:', error);
    return internalError(c, 'staff.deleteCleanupDemo', error);
  }
});

export default app;