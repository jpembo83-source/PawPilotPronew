import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { requireAuth, requireRole } from "./_shared/auth.ts";
import { internalError } from "./_shared/log.ts";

const app = new Hono();

// Every communications-settings route requires a validated user. Scoped to
// this module's route prefix — mounted at "/", so "*" would intercept
// portal routes that use their own auth.
app.use("/make-server-fc003b23/communications/*", requireAuth);

// Prefix for all communications settings keys
const PREFIX = "communications_settings";

// --- Channel Configuration ---

app.get("/make-server-fc003b23/communications/channels", async (c) => {
  try {
    const channels = await kv.getByPrefix(`${PREFIX}:channels:`);
    
    // If no channels exist, create defaults
    if (!channels || channels.length === 0) {
      const defaultChannels = [
        {
          id: "email",
          channel: "email",
          isEnabled: true,
          status: "active",
          organisationEnabled: true,
          locationConfigs: [],
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: "system",
          lastUpdatedByName: "System",
        },
        {
          id: "sms",
          channel: "sms",
          isEnabled: true,
          status: "active",
          organisationEnabled: true,
          locationConfigs: [],
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: "system",
          lastUpdatedByName: "System",
        },
        {
          id: "whatsapp",
          channel: "whatsapp",
          isEnabled: false,
          status: "disabled",
          organisationEnabled: false,
          locationConfigs: [],
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: "system",
          lastUpdatedByName: "System",
        },
      ];
      
      for (const channel of defaultChannels) {
        await kv.set(`${PREFIX}:channels:${channel.id}`, channel);
      }
      
      return c.json(defaultChannels);
    }
    
    return c.json(channels);
  } catch (err: any) {
    return internalError(c, 'communications.getChannels', err);
  }
});

app.put("/make-server-fc003b23/communications/channels/:id", requireRole('admin'), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(`${PREFIX}:channels:${id}`);
    if (!existing) {
      return c.json({ error: "Channel not found" }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      lastUpdatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:channels:${id}`, updated);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "channel",
      entityId: id,
      entityName: updated.channel,
      action: "updated",
      before: existing,
      after: updated,
      performedBy: body.updatedBy || "unknown",
      performedByName: body.updatedByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(updated);
  } catch (err: any) {
    return internalError(c, 'communications.updateChannel', err);
  }
});

// --- Sender Identities ---

app.get("/make-server-fc003b23/communications/sender-identities", async (c) => {
  try {
    const identities = await kv.getByPrefix(`${PREFIX}:sender_identities:`);
    return c.json(identities || []);
  } catch (err: any) {
    return internalError(c, 'communications.listSenderIdentities', err);
  }
});

app.post("/make-server-fc003b23/communications/sender-identities", requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json();
    const id = `sender-${Date.now()}`;
    
    const identity = {
      id,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:sender_identities:${id}`, identity);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "sender_identity",
      entityId: id,
      entityName: identity.scopeName,
      action: "created",
      after: identity,
      performedBy: body.createdBy || "unknown",
      performedByName: body.createdByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(identity);
  } catch (err: any) {
    return internalError(c, 'communications.createSenderIdentity', err);
  }
});

app.put("/make-server-fc003b23/communications/sender-identities/:id", requireRole('admin'), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(`${PREFIX}:sender_identities:${id}`);
    if (!existing) {
      return c.json({ error: "Sender identity not found" }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:sender_identities:${id}`, updated);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "sender_identity",
      entityId: id,
      entityName: updated.scopeName,
      action: "updated",
      before: existing,
      after: updated,
      performedBy: body.updatedBy || "unknown",
      performedByName: body.updatedByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(updated);
  } catch (err: any) {
    return internalError(c, 'communications.updateSenderIdentity', err);
  }
});

app.delete("/make-server-fc003b23/communications/sender-identities/:id", requireRole('admin'), async (c) => {
  try {
    const id = c.req.param("id");
    
    const existing = await kv.get(`${PREFIX}:sender_identities:${id}`);
    if (!existing) {
      return c.json({ error: "Sender identity not found" }, 404);
    }
    
    await kv.del(`${PREFIX}:sender_identities:${id}`);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "sender_identity",
      entityId: id,
      entityName: existing.scopeName,
      action: "deleted",
      before: existing,
      performedBy: "unknown",
      performedByName: "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json({ success: true });
  } catch (err: any) {
    return internalError(c, 'communications.deleteSenderIdentity', err);
  }
});

// --- Consent Policy ---

app.get("/make-server-fc003b23/communications/consent-policy", async (c) => {
  try {
    let policy = await kv.get(`${PREFIX}:consent_policy`);
    
    // If no policy exists, create default
    if (!policy) {
      policy = {
        id: "default",
        defaultOptIn: {
          email: true,
          sms: true,
          whatsapp: false,
        },
        requiredConsent: {
          operational: true,
          informational: true,
          promotional: true,
        },
        blockWhenConsentMissing: true,
        updatedAt: new Date().toISOString(),
        updatedBy: "system",
        updatedByName: "System",
      };
      
      await kv.set(`${PREFIX}:consent_policy`, policy);
    }
    
    return c.json(policy);
  } catch (err: any) {
    return internalError(c, 'communications.getConsentPolicy', err);
  }
});

app.put("/make-server-fc003b23/communications/consent-policy", requireRole('admin'), async (c) => {
  try {
    const body = await c.req.json();
    
    const existing = await kv.get(`${PREFIX}:consent_policy`);
    
    const updated = {
      id: "default",
      ...body,
      requiredConsent: {
        ...body.requiredConsent,
        operational: true, // Always enforce operational consent
      },
      blockWhenConsentMissing: true, // Always block when missing
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:consent_policy`, updated);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-consent`, {
      id: `${Date.now()}-consent`,
      entityType: "consent_policy",
      entityId: "default",
      entityName: "Consent Policy",
      action: "updated",
      before: existing,
      after: updated,
      performedBy: body.updatedBy || "unknown",
      performedByName: body.updatedByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(updated);
  } catch (err: any) {
    return internalError(c, 'communications.updateConsentPolicy', err);
  }
});

// --- Templates ---

app.get("/make-server-fc003b23/communications/templates", async (c) => {
  try {
    const templates = await kv.getByPrefix(`${PREFIX}:templates:`);
    return c.json(templates || []);
  } catch (err: any) {
    return internalError(c, 'communications.listTemplates', err);
  }
});

app.post("/make-server-fc003b23/communications/templates", requireRole('admin', 'manager'), async (c) => {
  try {
    const body = await c.req.json();
    const id = `template-${Date.now()}`;
    
    const template = {
      id,
      ...body,
      status: body.status || "draft",
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:templates:${id}`, template);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "template",
      entityId: id,
      entityName: template.name,
      action: "created",
      after: template,
      performedBy: body.createdBy || "unknown",
      performedByName: body.createdByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(template);
  } catch (err: any) {
    return internalError(c, 'communications.createTemplate', err);
  }
});

app.get("/make-server-fc003b23/communications/templates/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const template = await kv.get(`${PREFIX}:templates:${id}`);
    
    if (!template) {
      return c.json({ error: "Template not found" }, 404);
    }
    
    return c.json(template);
  } catch (err: any) {
    return internalError(c, 'communications.getTemplate', err);
  }
});

app.put("/make-server-fc003b23/communications/templates/:id", requireRole('admin', 'manager'), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(`${PREFIX}:templates:${id}`);
    if (!existing) {
      return c.json({ error: "Template not found" }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:templates:${id}`, updated);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "template",
      entityId: id,
      entityName: updated.name,
      action: "updated",
      before: existing,
      after: updated,
      performedBy: body.updatedBy || "unknown",
      performedByName: body.updatedByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(updated);
  } catch (err: any) {
    return internalError(c, 'communications.updateTemplate', err);
  }
});

app.delete("/make-server-fc003b23/communications/templates/:id", requireRole('admin', 'manager'), async (c) => {
  try {
    const id = c.req.param("id");
    
    const existing = await kv.get(`${PREFIX}:templates:${id}`);
    if (!existing) {
      return c.json({ error: "Template not found" }, 404);
    }
    
    await kv.del(`${PREFIX}:templates:${id}`);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "template",
      entityId: id,
      entityName: existing.name,
      action: "deleted",
      before: existing,
      performedBy: "unknown",
      performedByName: "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json({ success: true });
  } catch (err: any) {
    return internalError(c, 'communications.deleteTemplate', err);
  }
});

// --- Automation Rules ---

app.get("/make-server-fc003b23/communications/automation", async (c) => {
  try {
    const rules = await kv.getByPrefix(`${PREFIX}:automation:`);
    return c.json(rules || []);
  } catch (err: any) {
    return internalError(c, 'communications.listAutomation', err);
  }
});

app.post("/make-server-fc003b23/communications/automation", requireRole('admin', 'manager'), async (c) => {
  try {
    const body = await c.req.json();
    const id = `automation-${Date.now()}`;
    
    const rule = {
      id,
      ...body,
      status: body.isEnabled ? "active" : "disabled",
      respectConsent: true,
      messagesSent: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:automation:${id}`, rule);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "automation",
      entityId: id,
      entityName: rule.name,
      action: "created",
      after: rule,
      performedBy: body.createdBy || "unknown",
      performedByName: body.createdByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(rule);
  } catch (err: any) {
    return internalError(c, 'communications.createAutomation', err);
  }
});

app.get("/make-server-fc003b23/communications/automation/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const rule = await kv.get(`${PREFIX}:automation:${id}`);
    
    if (!rule) {
      return c.json({ error: "Automation rule not found" }, 404);
    }
    
    return c.json(rule);
  } catch (err: any) {
    return internalError(c, 'communications.getAutomation', err);
  }
});

app.put("/make-server-fc003b23/communications/automation/:id", requireRole('admin', 'manager'), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(`${PREFIX}:automation:${id}`);
    if (!existing) {
      return c.json({ error: "Automation rule not found" }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      status: body.isEnabled ? (existing.status === "paused" ? "active" : existing.status) : "disabled",
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:automation:${id}`, updated);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "automation",
      entityId: id,
      entityName: updated.name,
      action: existing.isEnabled !== updated.isEnabled ? (updated.isEnabled ? "enabled" : "disabled") : "updated",
      before: existing,
      after: updated,
      performedBy: body.updatedBy || "unknown",
      performedByName: body.updatedByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(updated);
  } catch (err: any) {
    return internalError(c, 'communications.updateAutomation', err);
  }
});

app.delete("/make-server-fc003b23/communications/automation/:id", requireRole('admin', 'manager'), async (c) => {
  try {
    const id = c.req.param("id");
    
    const existing = await kv.get(`${PREFIX}:automation:${id}`);
    if (!existing) {
      return c.json({ error: "Automation rule not found" }, 404);
    }
    
    await kv.del(`${PREFIX}:automation:${id}`);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "automation",
      entityId: id,
      entityName: existing.name,
      action: "deleted",
      before: existing,
      performedBy: "unknown",
      performedByName: "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json({ success: true });
  } catch (err: any) {
    return internalError(c, 'communications.deleteAutomation', err);
  }
});

// --- SLA Definitions ---

app.get("/make-server-fc003b23/communications/slas", async (c) => {
  try {
    const slas = await kv.getByPrefix(`${PREFIX}:slas:`);
    return c.json(slas || []);
  } catch (err: any) {
    return internalError(c, 'communications.listSlas', err);
  }
});

app.post("/make-server-fc003b23/communications/slas", requireRole('admin', 'manager'), async (c) => {
  try {
    const body = await c.req.json();
    const id = `sla-${Date.now()}`;
    
    const sla = {
      id,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:slas:${id}`, sla);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "sla",
      entityId: id,
      entityName: sla.name,
      action: "created",
      after: sla,
      performedBy: body.createdBy || "unknown",
      performedByName: body.createdByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(sla);
  } catch (err: any) {
    return internalError(c, 'communications.createSla', err);
  }
});

app.put("/make-server-fc003b23/communications/slas/:id", requireRole('admin', 'manager'), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(`${PREFIX}:slas:${id}`);
    if (!existing) {
      return c.json({ error: "SLA not found" }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:slas:${id}`, updated);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "sla",
      entityId: id,
      entityName: updated.name,
      action: "updated",
      before: existing,
      after: updated,
      performedBy: body.updatedBy || "unknown",
      performedByName: body.updatedByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(updated);
  } catch (err: any) {
    return internalError(c, 'communications.updateSla', err);
  }
});

app.delete("/make-server-fc003b23/communications/slas/:id", requireRole('admin', 'manager'), async (c) => {
  try {
    const id = c.req.param("id");
    
    const existing = await kv.get(`${PREFIX}:slas:${id}`);
    if (!existing) {
      return c.json({ error: "SLA not found" }, 404);
    }
    
    await kv.del(`${PREFIX}:slas:${id}`);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "sla",
      entityId: id,
      entityName: existing.name,
      action: "deleted",
      before: existing,
      performedBy: "unknown",
      performedByName: "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json({ success: true });
  } catch (err: any) {
    return internalError(c, 'communications.deleteSla', err);
  }
});

// --- Permissions ---

app.get("/make-server-fc003b23/communications/permissions", async (c) => {
  try {
    let permissions = await kv.getByPrefix(`${PREFIX}:permissions:`);
    
    // If no permissions exist, create defaults
    if (!permissions || permissions.length === 0) {
      const defaultPermissions = [
        {
          id: "perm-admin",
          role: "admin",
          canSendMessages: true,
          canSendWithoutTemplate: true,
          allowedChannels: ["email", "sms", "whatsapp"],
          templateRequired: false,
          requiresApproval: false,
          locationIds: [],
          updatedAt: new Date().toISOString(),
          updatedBy: "system",
          updatedByName: "System",
        },
        {
          id: "perm-manager",
          role: "manager",
          canSendMessages: true,
          canSendWithoutTemplate: true,
          allowedChannels: ["email", "sms", "whatsapp"],
          templateRequired: false,
          requiresApproval: false,
          locationIds: [],
          updatedAt: new Date().toISOString(),
          updatedBy: "system",
          updatedByName: "System",
        },
        {
          id: "perm-staff",
          role: "staff",
          canSendMessages: true,
          canSendWithoutTemplate: false,
          allowedChannels: ["email", "sms"],
          templateRequired: true,
          requiresApproval: false,
          locationIds: [],
          updatedAt: new Date().toISOString(),
          updatedBy: "system",
          updatedByName: "System",
        },
        {
          id: "perm-driver",
          role: "driver",
          canSendMessages: true,
          canSendWithoutTemplate: false,
          allowedChannels: ["sms"],
          restrictedModules: ["billing", "grooming"],
          templateRequired: true,
          requiresApproval: false,
          locationIds: [],
          updatedAt: new Date().toISOString(),
          updatedBy: "system",
          updatedByName: "System",
        },
      ];
      
      for (const perm of defaultPermissions) {
        await kv.set(`${PREFIX}:permissions:${perm.id}`, perm);
      }
      
      permissions = defaultPermissions;
    }
    
    return c.json(permissions);
  } catch (err: any) {
    return internalError(c, 'communications.getPermissions', err);
  }
});

app.put("/make-server-fc003b23/communications/permissions/:id", requireRole('admin'), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existing = await kv.get(`${PREFIX}:permissions:${id}`);
    if (!existing) {
      return c.json({ error: "Permission not found" }, 404);
    }
    
    const updated = {
      ...existing,
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`${PREFIX}:permissions:${id}`, updated);
    
    // Audit log
    await kv.set(`${PREFIX}:audit:${Date.now()}-${id}`, {
      id: `${Date.now()}-${id}`,
      entityType: "permission",
      entityId: id,
      entityName: `${updated.role} permissions`,
      action: "updated",
      before: existing,
      after: updated,
      performedBy: body.updatedBy || "unknown",
      performedByName: body.updatedByName || "Unknown",
      performedAt: new Date().toISOString(),
    });
    
    return c.json(updated);
  } catch (err: any) {
    return internalError(c, 'communications.updatePermission', err);
  }
});

// --- Delivery Logs ---

app.get("/make-server-fc003b23/communications/delivery-logs", async (c) => {
  try {
    const logs = await kv.getByPrefix(`${PREFIX}:delivery_logs:`);
    
    // Sort by most recent
    const sorted = (logs || []).sort((a: any, b: any) => 
      new Date(b.queuedAt).getTime() - new Date(a.queuedAt).getTime()
    );
    
    return c.json(sorted);
  } catch (err: any) {
    return internalError(c, 'communications.deliveryLogs', err);
  }
});

// --- Audit Logs ---

app.get("/make-server-fc003b23/communications/audit-logs", async (c) => {
  try {
    const logs = await kv.getByPrefix(`${PREFIX}:audit:`);
    
    // Sort by most recent
    const sorted = (logs || []).sort((a: any, b: any) => 
      new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
    );
    
    return c.json(sorted);
  } catch (err: any) {
    return internalError(c, 'communications.auditLogs', err);
  }
});

// --- Statistics ---

app.get("/make-server-fc003b23/communications/stats", async (c) => {
  try {
    const channels = await kv.getByPrefix(`${PREFIX}:channels:`);
    const templates = await kv.getByPrefix(`${PREFIX}:templates:`);
    const automation = await kv.getByPrefix(`${PREFIX}:automation:`);
    const logs = await kv.getByPrefix(`${PREFIX}:delivery_logs:`);
    
    const stats = {
      channelHealth: (channels || []).map((ch: any) => ({
        channel: ch.channel,
        status: ch.status,
        messagesLast24h: 0,
        deliveryRate: 100,
      })),
      topTemplates: (templates || [])
        .filter((t: any) => t.status === "active")
        .sort((a: any, b: any) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 5)
        .map((t: any) => ({
          templateId: t.id,
          templateName: t.name,
          usageCount: t.usageCount || 0,
          lastUsed: t.lastUsedAt || "-",
        })),
      automationStats: {
        totalRules: (automation || []).length,
        activeRules: (automation || []).filter((r: any) => r.status === "active").length,
        messagesSent24h: 0,
        failureRate: 0,
      },
      slaStats: {
        totalMessages: (logs || []).length,
        withinSLA: 0,
        breachedSLA: 0,
        averageResponseMinutes: 0,
      },
      consentStats: {
        totalContacts: 0,
        emailConsent: 0,
        smsConsent: 0,
        whatsappConsent: 0,
      },
    };
    
    return c.json(stats);
  } catch (err: any) {
    return internalError(c, 'communications.stats', err);
  }
});

export default app;
