import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth } from './_shared/auth.ts';

const app = new Hono();

// Prefix for all routes
const PREFIX = '/make-server-fc003b23/operational-rules';

// Every operational-rules route requires a validated user. Scoped to this
// module's prefix — mounted at "/", so '*' would intercept portal routes.
app.use(`${PREFIX}/*`, requireAuth);
app.use(PREFIX, requireAuth);

// Helper: Generate ID
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// RULES CRUD
// ============================================================================

// GET /operational-rules - List all rules with filters
app.get(`${PREFIX}`, async (c) => {
  try {
    const { module, category, scope, status, locationId, search } = c.req.query();
    
    // Get all rules
    const ruleKeys = await kv.getByPrefix('operational_rule:');
    let rules = ruleKeys.map(item => item.value);
    
    // Apply filters
    if (module) {
      rules = rules.filter(r => r.module === module);
    }
    if (category) {
      rules = rules.filter(r => r.category === category);
    }
    if (scope) {
      rules = rules.filter(r => r.scope === scope);
    }
    if (status) {
      rules = rules.filter(r => r.status === status);
    }
    if (locationId) {
      // Show org rules + location-specific rules for this location
      rules = rules.filter(r => 
        r.scope === 'organisation' || 
        (r.scope === 'location' && r.scopeId === locationId)
      );
    }
    if (search) {
      const searchLower = search.toLowerCase();
      rules = rules.filter(r =>
        r.name.toLowerCase().includes(searchLower) ||
        r.description?.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by priority (high to low), then by name
    rules.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.name.localeCompare(b.name);
    });
    
    return c.json({ rules, total: rules.length });
  } catch (error) {
    console.error('Error fetching operational rules:', error);
    return c.json({ error: 'Failed to fetch operational rules', details: error.message }, 500);
  }
});

// GET /operational-rules/templates - Get predefined rule templates (MUST BE BEFORE :ruleId)
app.get(`${PREFIX}/templates`, async (c) => {
  try {
    const { module, category } = c.req.query();
    
    let templates = RULE_TEMPLATES;
    
    if (module) {
      templates = templates.filter(t => t.module === module);
    }
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    return c.json({ templates });
  } catch (error) {
    console.error('Error fetching rule templates:', error);
    return c.json({ error: 'Failed to fetch rule templates', details: error.message }, 500);
  }
});

// GET /operational-rules/audit - Get audit log (MUST BE BEFORE :ruleId)
app.get(`${PREFIX}/audit`, async (c) => {
  try {
    const { ruleId, scope, locationId, limit = 100 } = c.req.query();
    
    let auditKeys = await kv.getByPrefix('rule_audit:');
    let audits = auditKeys.map(item => item.value);
    
    // Filters
    if (ruleId) {
      audits = audits.filter(a => a.ruleId === ruleId);
    }
    if (scope) {
      audits = audits.filter(a => a.scope === scope);
    }
    if (locationId) {
      audits = audits.filter(a => a.scopeId === locationId);
    }
    
    // Sort by most recent
    audits.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
    
    // Limit
    audits = audits.slice(0, Number(limit));
    
    return c.json({ audits, total: audits.length });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return c.json({ error: 'Failed to fetch audit log', details: error.message }, 500);
  }
});

// GET /operational-rules/overrides/:locationId - Get override configs (MUST BE BEFORE generic :ruleId)
app.get(`${PREFIX}/overrides/:locationId`, async (c) => {
  try {
    const { locationId } = c.req.param();
    
    // Get all org rules that allow overrides
    const allRulesKeys = await kv.getByPrefix('operational_rule:');
    const orgRules = allRulesKeys
      .map(item => item.value)
      .filter(r => r.scope === 'organisation' && r.allowLocationOverride);
    
    const configs = [];
    
    for (const orgRule of orgRules) {
      const overrideRuleId = await kv.get(`rule_override:${orgRule.id}:${locationId}`);
      
      configs.push({
        locationId,
        locationName: '', // Would come from location data
        organisationRuleId: orgRule.id,
        isOverrideAllowed: true,
        hasOverride: !!overrideRuleId,
        overrideRuleId
      });
    }
    
    return c.json({ configs });
  } catch (error) {
    console.error('Error fetching location overrides:', error);
    return c.json({ error: 'Failed to fetch location overrides', details: error.message }, 500);
  }
});

// GET /operational-rules/:ruleId - Get single rule
app.get(`${PREFIX}/:ruleId`, async (c) => {
  try {
    const { ruleId } = c.req.param();
    const rule = await kv.get(`operational_rule:${ruleId}`);
    
    if (!rule) {
      return c.json({ error: 'Rule not found' }, 404);
    }
    
    return c.json(rule);
  } catch (error) {
    console.error('Error fetching operational rule:', error);
    return c.json({ error: 'Failed to fetch operational rule', details: error.message }, 500);
  }
});

// POST /operational-rules - Create new rule
app.post(`${PREFIX}`, async (c) => {
  try {
    const body = await c.req.json();
    const ruleId = generateId('rule');
    const now = new Date().toISOString();
    
    const rule = {
      id: ruleId,
      name: body.name,
      description: body.description,
      module: body.module,
      category: body.category,
      type: body.type,
      scope: body.scope,
      scopeId: body.scopeId,
      scopeName: body.scopeName,
      allowLocationOverride: body.allowLocationOverride ?? false,
      event: body.event,
      conditions: body.conditions || [],
      actions: body.actions || [],
      customerTiers: body.customerTiers || [],
      serviceTypes: body.serviceTypes || [],
      status: body.status || 'draft',
      isOverride: body.isOverride || false,
      overridesRuleId: body.overridesRuleId,
      priority: body.priority || 100,
      createdAt: now,
      createdBy: body.createdBy,
      createdByName: body.createdByName,
      updatedAt: now,
      updatedBy: body.createdBy,
      updatedByName: body.createdByName,
      version: 1
    };
    
    await kv.set(`operational_rule:${ruleId}`, rule);
    
    // Create audit entry
    await createAuditEntry({
      ruleId,
      ruleName: rule.name,
      action: 'created',
      after: rule,
      performedBy: body.createdBy,
      performedByName: body.createdByName,
      reason: body.auditReason,
      scope: rule.scope,
      scopeId: rule.scopeId
    });
    
    // If this is a location override, link it
    if (rule.isOverride && rule.overridesRuleId) {
      const overrideKey = `rule_override:${rule.overridesRuleId}:${rule.scopeId}`;
      await kv.set(overrideKey, ruleId);
    }
    
    return c.json(rule, 201);
  } catch (error) {
    console.error('Error creating operational rule:', error);
    return c.json({ error: 'Failed to create operational rule', details: error.message }, 500);
  }
});

// PATCH /operational-rules/:ruleId - Update rule
app.patch(`${PREFIX}/:ruleId`, async (c) => {
  try {
    const { ruleId } = c.req.param();
    const updates = await c.req.json();
    
    const rule = await kv.get(`operational_rule:${ruleId}`);
    if (!rule) {
      return c.json({ error: 'Rule not found' }, 404);
    }
    
    const before = { ...rule };
    const now = new Date().toISOString();
    
    // Determine action type
    let action: string = 'updated';
    if (updates.status === 'disabled' && rule.status !== 'disabled') {
      action = 'disabled';
    } else if (updates.status === 'active' && rule.status === 'disabled') {
      action = 'enabled';
    }
    
    const updatedRule = {
      ...rule,
      ...updates,
      updatedAt: now,
      updatedBy: updates.updatedBy,
      updatedByName: updates.updatedByName,
      version: rule.version + 1
    };
    
    // Track disable/enable metadata
    if (action === 'disabled') {
      updatedRule.disabledAt = now;
      updatedRule.disabledBy = updates.updatedBy;
      updatedRule.disabledReason = updates.disabledReason;
    } else if (action === 'enabled') {
      delete updatedRule.disabledAt;
      delete updatedRule.disabledBy;
      delete updatedRule.disabledReason;
    }
    
    await kv.set(`operational_rule:${ruleId}`, updatedRule);
    
    // Create audit entry
    await createAuditEntry({
      ruleId,
      ruleName: updatedRule.name,
      action: action as any,
      before,
      after: updatedRule,
      performedBy: updates.updatedBy,
      performedByName: updates.updatedByName,
      reason: updates.auditReason,
      scope: updatedRule.scope,
      scopeId: updatedRule.scopeId
    });
    
    return c.json(updatedRule);
  } catch (error) {
    console.error('Error updating operational rule:', error);
    return c.json({ error: 'Failed to update operational rule', details: error.message }, 500);
  }
});

// DELETE /operational-rules/:ruleId - Delete rule
app.delete(`${PREFIX}/:ruleId`, async (c) => {
  try {
    const { ruleId } = c.req.param();
    const { deletedBy, deletedByName, reason } = await c.req.json();
    
    const rule = await kv.get(`operational_rule:${ruleId}`);
    if (!rule) {
      return c.json({ error: 'Rule not found' }, 404);
    }
    
    // Create audit entry before deletion
    await createAuditEntry({
      ruleId,
      ruleName: rule.name,
      action: 'deleted',
      before: rule,
      performedBy: deletedBy,
      performedByName: deletedByName,
      reason,
      scope: rule.scope,
      scopeId: rule.scopeId
    });
    
    // Delete the rule
    await kv.del(`operational_rule:${ruleId}`);
    
    // Remove override link if exists
    if (rule.isOverride && rule.overridesRuleId) {
      await kv.del(`rule_override:${rule.overridesRuleId}:${rule.scopeId}`);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting operational rule:', error);
    return c.json({ error: 'Failed to delete operational rule', details: error.message }, 500);
  }
});

// ============================================================================
// RULE EVALUATION
// ============================================================================

// POST /operational-rules/evaluate - Evaluate rules for an event
app.post(`${PREFIX}/evaluate`, async (c) => {
  try {
    const context = await c.req.json();
    
    // Get applicable rules
    const allRulesKeys = await kv.getByPrefix('operational_rule:');
    let rules = allRulesKeys.map(item => item.value);
    
    // Filter to active rules for this module and event
    rules = rules.filter(r => 
      r.status === 'active' &&
      r.module === context.module &&
      r.event === context.event &&
      (r.scope === 'organisation' || r.scopeId === context.locationId)
    );
    
    // Apply location overrides
    const orgRules = rules.filter(r => r.scope === 'organisation');
    const locationRules = rules.filter(r => r.scope === 'location');
    
    // For each org rule, check if there's a location override
    const effectiveRules = [];
    for (const orgRule of orgRules) {
      const override = locationRules.find(lr => lr.overridesRuleId === orgRule.id);
      if (override) {
        effectiveRules.push(override); // Use override instead
      } else {
        effectiveRules.push(orgRule); // Use org rule
      }
    }
    
    // Add location-specific rules that aren't overrides
    effectiveRules.push(...locationRules.filter(lr => !lr.isOverride));
    
    // Sort by priority
    effectiveRules.sort((a, b) => b.priority - a.priority);
    
    // Evaluate each rule
    const results = [];
    let allowed = true;
    let blocked = false;
    let blockReason = '';
    const warnings = [];
    const escalations = [];
    const autoUpdates = [];
    
    for (const rule of effectiveRules) {
      const result = evaluateRule(rule, context);
      results.push(result);
      
      if (result.triggered) {
        if (result.outcome === 'block') {
          allowed = false;
          blocked = true;
          blockReason = result.warning?.message || `Blocked by rule: ${rule.name}`;
        }
        
        if (result.warning) {
          warnings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            message: result.warning.message,
            requiresAcknowledgement: result.warning.requiresAcknowledgement
          });
        }
        
        if (result.escalation) {
          escalations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            notifyRoles: result.escalation.notifyRoles,
            notifyUsers: result.escalation.notifyUsers
          });
        }
        
        if (result.autoUpdate) {
          autoUpdates.push(result.autoUpdate);
        }
      }
    }
    
    const response = {
      allowed,
      blocked,
      blockReason: blocked ? blockReason : undefined,
      warnings,
      escalations,
      autoUpdates,
      results,
      evaluatedAt: new Date().toISOString()
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Error evaluating operational rules:', error);
    return c.json({ error: 'Failed to evaluate operational rules', details: error.message }, 500);
  }
});

// ============================================================================
// HELPERS
// ============================================================================

async function createAuditEntry(data: any) {
  const auditId = generateId('audit');
  const audit = {
    id: auditId,
    ruleId: data.ruleId,
    ruleName: data.ruleName,
    action: data.action,
    before: data.before,
    after: data.after,
    performedBy: data.performedBy,
    performedByName: data.performedByName,
    performedAt: new Date().toISOString(),
    reason: data.reason,
    scope: data.scope,
    scopeId: data.scopeId,
    metadata: data.metadata || {}
  };
  
  await kv.set(`rule_audit:${auditId}`, audit);
  return audit;
}

function evaluateRule(rule: any, context: any): any {
  const now = new Date().toISOString();
  
  // Evaluate all conditions
  const conditionResults = rule.conditions.map((condition: any) => {
    const result = evaluateCondition(condition, context);
    return {
      conditionId: condition.id,
      field: condition.field,
      result
    };
  });
  
  // All conditions must be true for rule to trigger
  const allConditionsMet = conditionResults.every(cr => cr.result);
  
  if (!allConditionsMet) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      triggered: false,
      outcome: 'allow',
      allowed: true,
      blocked: false,
      evaluatedAt: now,
      conditions: conditionResults
    };
  }
  
  // Rule triggered - execute actions
  const result: any = {
    ruleId: rule.id,
    ruleName: rule.name,
    triggered: true,
    allowed: true,
    blocked: false,
    evaluatedAt: now,
    conditions: conditionResults
  };
  
  // Process each action
  for (const action of rule.actions) {
    result.outcome = action.type;
    
    if (action.type === 'block') {
      result.blocked = true;
      result.allowed = false;
      result.warning = {
        message: action.message || `Action blocked by rule: ${rule.name}`,
        requiresAcknowledgement: action.requireAcknowledgement ?? true
      };
    }
    
    if (action.type === 'warn') {
      result.warning = {
        message: action.message || `Warning: ${rule.name}`,
        requiresAcknowledgement: action.requireAcknowledgement ?? false
      };
    }
    
    if (action.type === 'escalate') {
      result.escalation = {
        notifyRoles: action.notifyRoles || [],
        notifyUsers: action.notifyUsers || [],
        createTask: action.createTask ?? false,
        createIncident: action.createIncident ?? false
      };
    }
    
    if (action.type === 'auto_update' && action.updateField) {
      result.autoUpdate = {
        field: action.updateField,
        value: action.updateValue
      };
    }
  }
  
  return result;
}

function evaluateCondition(condition: any, context: any): boolean {
  const fieldValue = getFieldValue(condition.field, context);
  const conditionValue = condition.value;
  
  switch (condition.operator) {
    case 'equals':
      return fieldValue === conditionValue;
    case 'not_equals':
      return fieldValue !== conditionValue;
    case 'greater_than':
      return Number(fieldValue) > Number(conditionValue);
    case 'less_than':
      return Number(fieldValue) < Number(conditionValue);
    case 'greater_than_or_equal':
      return Number(fieldValue) >= Number(conditionValue);
    case 'less_than_or_equal':
      return Number(fieldValue) <= Number(conditionValue);
    case 'contains':
      return String(fieldValue).includes(String(conditionValue));
    case 'not_contains':
      return !String(fieldValue).includes(String(conditionValue));
    case 'in_list':
      return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
    case 'not_in_list':
      return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
    case 'is_expired':
      return fieldValue ? new Date(fieldValue) < new Date() : false;
    case 'expires_within':
      if (!fieldValue) return false;
      const expiryDate = new Date(fieldValue);
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() + Number(conditionValue));
      return expiryDate <= checkDate;
    case 'is_empty':
      return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'is_not_empty':
      return !!fieldValue && (!Array.isArray(fieldValue) || fieldValue.length > 0);
    default:
      return false;
  }
}

function getFieldValue(field: string, context: any): any {
  const parts = field.split('.');
  let value = context.data;
  
  // Try context data first
  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = value[part];
    } else {
      value = undefined;
      break;
    }
  }
  
  // If not found, try context-level fields (pet.vaccination.expiryDate, etc.)
  if (value === undefined) {
    value = context;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        value = undefined;
        break;
      }
    }
  }
  
  return value;
}

// Predefined rule templates
const RULE_TEMPLATES = [
  {
    id: 'tmpl_vaccination_check',
    name: 'Block Check-in if Vaccination Expired',
    description: 'Prevent check-in for daycare if pet vaccination has expired',
    category: 'check_in_out',
    module: 'daycare',
    type: 'requirement',
    event: 'daycare.check_in',
    conditionTemplates: [{
      field: 'pet.vaccination.isExpired',
      operator: 'equals',
      value: true,
      description: 'Vaccination is expired'
    }],
    actionTemplates: [{
      type: 'block',
      message: 'Cannot check in - vaccination has expired. Please update vaccination records before check-in.',
      requireAcknowledgement: true
    }],
    customisableFields: ['message'],
    isRecommended: true
  },
  {
    id: 'tmpl_vaccination_warning',
    name: 'Warn if Vaccination Expiring Soon',
    description: 'Show warning if pet vaccination expires within specified days',
    category: 'check_in_out',
    module: 'daycare',
    type: 'threshold',
    event: 'daycare.check_in',
    conditionTemplates: [{
      field: 'pet.vaccination.expiryDate',
      operator: 'expires_within',
      value: 7,
      description: 'Vaccination expires within 7 days'
    }],
    actionTemplates: [{
      type: 'warn',
      message: 'Vaccination expires soon. Please remind owner to renew.',
      requireAcknowledgement: false
    }],
    customisableFields: ['value', 'message'],
    isRecommended: true
  },
  {
    id: 'tmpl_cancellation_window',
    name: 'Cancellation Window',
    description: 'Require cancellation at least X hours before booking',
    category: 'booking_cancellation',
    module: 'daycare',
    type: 'time_window',
    event: 'booking.cancel',
    conditionTemplates: [{
      field: 'hoursUntilBooking',
      operator: 'less_than',
      value: 24,
      description: 'Less than 24 hours before booking'
    }],
    actionTemplates: [{
      type: 'warn',
      message: 'Late cancellation - less than 24 hours notice. Cancellation fee may apply.',
      requireAcknowledgement: true
    }],
    customisableFields: ['value', 'message'],
    isRecommended: true
  }
];

export default app;