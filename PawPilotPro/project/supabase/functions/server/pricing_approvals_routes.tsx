import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { requireAuth } from "./_shared/auth.ts";
import { internalError } from "./_shared/log.ts";

const routes = new Hono();

// Every pricing-approval route requires a validated user.
routes.use("*", requireAuth);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getUserFromContext = () => {
  // TODO: Extract from auth token
  return { id: 'system', name: 'Admin', role: 'admin' };
};

const hasPermission = (user: any, permission: string): boolean => {
  // Admin has all permissions
  if (user.role === 'admin') return true;
  
  // Manager has pricing authority (can activate, approve, override)
  if (user.role === 'manager') {
    if (['pricing:approve', 'pricing:activate', 'pricing:override', 'pricing:edit'].includes(permission)) {
      return true;
    }
  }
  
  // Assistant Manager can only propose
  if (user.role === 'assistant_manager') {
    if (permission === 'pricing:propose') {
      return true;
    }
  }
  
  return false;
};

const createAuditLog = async (action: string, entityType: string, entityId: string, user: any, beforeValue?: any, afterValue?: any, metadata?: any) => {
  const auditLog = {
    id: crypto.randomUUID(),
    action,
    entityType,
    entityId,
    performedBy: user.name,
    performedAt: new Date().toISOString(),
    beforeValue,
    afterValue,
    scope: 'organisation',
    metadata,
  };
  await kv.set(`pricing-audit:${auditLog.id}`, auditLog);
  return auditLog;
};

// ============================================================================
// PRICE BOOK APPROVAL WORKFLOW
// ============================================================================

// DIRECT ACTIVATION (Admin/Manager only - no approval needed)
routes.post("/price-book/activate", async (c) => {
  try {
    const user = getUserFromContext();
    if (!hasPermission(user, 'pricing:activate')) {
      return c.json({ error: 'Insufficient permissions to activate price books directly' }, 403);
    }
    
    const { priceBookVersionId, activateImmediately, scheduledActivationDate, comment } = await c.req.json();
    
    const version = await kv.get(`price-book-version:${priceBookVersionId}`);
    if (!version) {
      return c.json({ error: 'Price book version not found' }, 404);
    }
    
    // Admin/Manager can activate from draft or approved status
    if (!['draft', 'approved'].includes(version.status)) {
      return c.json({ error: 'Can only activate draft or approved price books' }, 400);
    }
    
    // Determine new status
    const newStatus = activateImmediately ? 'active' : 'approved';
    
    // Update version
    const updated = {
      ...version,
      status: newStatus,
      activatedBy: user.name,
      activatedAt: new Date().toISOString(),
      activationComment: comment,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    };
    
    if (!activateImmediately && scheduledActivationDate) {
      updated.effectiveFrom = scheduledActivationDate;
    }
    
    await kv.set(`price-book-version:${priceBookVersionId}`, updated);
    
    // If activating immediately, supersede previous active versions
    if (activateImmediately) {
      const allVersions = await kv.getByPrefix('price-book-version:');
      const sameBookVersions = allVersions.filter((v: any) => 
        v.priceBookId === version.priceBookId && 
        v.id !== priceBookVersionId && 
        v.status === 'active'
      );
      
      for (const oldVersion of sameBookVersions) {
        oldVersion.status = 'superseded';
        oldVersion.effectiveTo = new Date().toISOString();
        oldVersion.supersededBy = user.name;
        await kv.set(`price-book-version:${oldVersion.id}`, oldVersion);
        await createAuditLog('price_book_superseded', 'price_book', oldVersion.id, user, oldVersion, oldVersion);
      }
    }
    
    // Audit log
    await createAuditLog(
      activateImmediately ? 'price_book_activated_direct' : 'price_book_scheduled', 
      'price_book', 
      priceBookVersionId, 
      user, 
      version, 
      updated,
      { comment, bypassed_approval: true }
    );
    
    return c.json({ version: updated });
  } catch (e: any) {
    console.error('Activate price book error:', e);
    return internalError(c, 'pricing_approvals.postPriceBookActivate', e);
  }
});

routes.post("/price-book/submit", async (c) => {
  try {
    const user = getUserFromContext();
    if (!hasPermission(user, 'pricing:propose')) {
      return c.json({ error: 'Insufficient permissions to submit price books' }, 403);
    }
    
    const { priceBookVersionId, comment } = await c.req.json();
    
    const version = await kv.get(`price-book-version:${priceBookVersionId}`);
    if (!version) {
      return c.json({ error: 'Price book version not found' }, 404);
    }
    
    if (version.status !== 'draft') {
      return c.json({ error: 'Only draft price books can be submitted for approval' }, 400);
    }
    
    // Update version status
    const updated = {
      ...version,
      status: 'pending_approval',
      submittedForApprovalAt: new Date().toISOString(),
      submittedBy: user.name,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    };
    
    await kv.set(`price-book-version:${priceBookVersionId}`, updated);
    
    // Create approval record
    const approval = {
      id: crypto.randomUUID(),
      type: 'price_book',
      referenceId: priceBookVersionId,
      proposedBy: user.name,
      proposedAt: new Date().toISOString(),
      proposalData: { comment },
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`approval:${approval.id}`, approval);
    
    // Audit log
    await createAuditLog('price_book_submitted', 'price_book', priceBookVersionId, user, version, updated);
    
    return c.json({ version: updated, approval });
  } catch (e: any) {
    console.error('Submit price book error:', e);
    return internalError(c, 'pricing_approvals.postPriceBookSubmit', e);
  }
});

routes.post("/price-book/approve", async (c) => {
  try {
    const user = getUserFromContext();
    if (!hasPermission(user, 'pricing:approve')) {
      return c.json({ error: 'Insufficient permissions to approve price books' }, 403);
    }
    
    const { priceBookVersionId, approvalComment, activateImmediately, scheduledActivationDate } = await c.req.json();
    
    const version = await kv.get(`price-book-version:${priceBookVersionId}`);
    if (!version) {
      return c.json({ error: 'Price book version not found' }, 404);
    }
    
    if (version.status !== 'pending_approval') {
      return c.json({ error: 'Only pending price books can be approved' }, 400);
    }
    
    // Determine new status
    const newStatus = activateImmediately ? 'active' : 'approved';
    
    // Update version
    const updated = {
      ...version,
      status: newStatus,
      approvedAt: new Date().toISOString(),
      approvedBy: user.name,
      approvalComment,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    };
    
    if (!activateImmediately && scheduledActivationDate) {
      updated.effectiveFrom = scheduledActivationDate;
    }
    
    await kv.set(`price-book-version:${priceBookVersionId}`, updated);
    
    // Update approval record
    const approvals = await kv.getByPrefix('approval:');
    const approval = approvals.find((a: any) => a.referenceId === priceBookVersionId && a.type === 'price_book');
    
    if (approval) {
      approval.status = 'approved';
      approval.approvedBy = user.name;
      approval.approvedAt = new Date().toISOString();
      approval.approvalComment = approvalComment;
      approval.updatedAt = new Date().toISOString();
      await kv.set(`approval:${approval.id}`, approval);
    }
    
    // If activating immediately, supersede previous active versions
    if (activateImmediately) {
      const allVersions = await kv.getByPrefix('price-book-version:');
      const sameBookVersions = allVersions.filter((v: any) => 
        v.priceBookId === version.priceBookId && 
        v.id !== priceBookVersionId && 
        v.status === 'active'
      );
      
      for (const oldVersion of sameBookVersions) {
        oldVersion.status = 'superseded';
        oldVersion.effectiveTo = new Date().toISOString();
        await kv.set(`price-book-version:${oldVersion.id}`, oldVersion);
        await createAuditLog('price_book_superseded', 'price_book', oldVersion.id, user, oldVersion, oldVersion);
      }
    }
    
    // Audit log
    await createAuditLog(
      activateImmediately ? 'price_book_activated' : 'price_book_approved', 
      'price_book', 
      priceBookVersionId, 
      user, 
      version, 
      updated
    );
    
    return c.json({ version: updated });
  } catch (e: any) {
    console.error('Approve price book error:', e);
    return internalError(c, 'pricing_approvals.postPriceBookApprove', e);
  }
});

routes.post("/price-book/reject", async (c) => {
  try {
    const user = getUserFromContext();
    if (!hasPermission(user, 'pricing:approve')) {
      return c.json({ error: 'Insufficient permissions to reject price books' }, 403);
    }
    
    const { priceBookVersionId, rejectionReason } = await c.req.json();
    
    if (!rejectionReason) {
      return c.json({ error: 'Rejection reason is required' }, 400);
    }
    
    const version = await kv.get(`price-book-version:${priceBookVersionId}`);
    if (!version) {
      return c.json({ error: 'Price book version not found' }, 404);
    }
    
    if (version.status !== 'pending_approval') {
      return c.json({ error: 'Only pending price books can be rejected' }, 400);
    }
    
    // Update version
    const updated = {
      ...version,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: user.name,
      rejectionReason,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    };
    
    await kv.set(`price-book-version:${priceBookVersionId}`, updated);
    
    // Update approval record
    const approvals = await kv.getByPrefix('approval:');
    const approval = approvals.find((a: any) => a.referenceId === priceBookVersionId && a.type === 'price_book');
    
    if (approval) {
      approval.status = 'rejected';
      approval.rejectedBy = user.name;
      approval.rejectedAt = new Date().toISOString();
      approval.rejectionReason = rejectionReason;
      approval.updatedAt = new Date().toISOString();
      await kv.set(`approval:${approval.id}`, approval);
    }
    
    // Audit log
    await createAuditLog('price_book_rejected', 'price_book', priceBookVersionId, user, version, updated, { rejectionReason });
    
    return c.json({ version: updated });
  } catch (e: any) {
    console.error('Reject price book error:', e);
    return internalError(c, 'pricing_approvals.postPriceBookReject', e);
  }
});

// ============================================================================
// LOCATION OVERRIDE APPROVAL WORKFLOW
// ============================================================================

// DIRECT ACTIVATION (Admin/Manager only - no approval needed)
routes.post("/location-override/activate", async (c) => {
  try {
    const user = getUserFromContext();
    if (!hasPermission(user, 'pricing:override')) {
      return c.json({ error: 'Insufficient permissions to activate location overrides directly' }, 403);
    }
    
    const { locationId, serviceId, price, effectiveFrom, effectiveTo, justification } = await c.req.json();
    
    if (!justification) {
      return c.json({ error: 'Justification is required for location overrides' }, 400);
    }
    
    // Get current price for audit
    const service = await kv.get(`service:${serviceId}`);
    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }
    
    const priceEntries = await kv.getByPrefix('price-entry:');
    const currentPriceEntry = priceEntries.find((pe: any) => pe.serviceId === serviceId);
    const currentPrice = currentPriceEntry?.price || 0;
    
    // Create active location override directly
    const override = {
      id: crypto.randomUUID(),
      locationId,
      serviceId,
      price,
      currency: 'CHF',
      effectiveFrom,
      effectiveTo,
      justification,
      isActive: true,
      createdBy: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    };
    
    await kv.set(`location-override:${override.id}`, override);
    
    // Audit log
    await createAuditLog(
      'location_override_activated_direct', 
      'location_override', 
      override.id, 
      user, 
      { currentPrice }, 
      override,
      { bypassed_approval: true, justification }
    );
    
    return c.json({ override });
  } catch (e: any) {
    console.error('Activate location override error:', e);
    return internalError(c, 'pricing_approvals.postLocationOverrideActivate', e);
  }
});

routes.post("/location-override/propose", async (c) => {
  try {
    const user = getUserFromContext();
    if (!hasPermission(user, 'pricing:propose')) {
      return c.json({ error: 'Insufficient permissions to propose location overrides' }, 403);
    }
    
    const { locationId, serviceId, proposedPrice, effectiveFrom, effectiveTo, justification } = await c.req.json();
    
    if (!justification) {
      return c.json({ error: 'Justification is required for location overrides' }, 400);
    }
    
    // Get current price
    const service = await kv.get(`service:${serviceId}`);
    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }
    
    // Get baseline price (simplified - would normally resolve from active price book)
    const priceEntries = await kv.getByPrefix('price-entry:');
    const currentPriceEntry = priceEntries.find((pe: any) => pe.serviceId === serviceId);
    const currentPrice = currentPriceEntry?.price || 0;
    
    // Create proposal
    const proposal = {
      id: crypto.randomUUID(),
      locationId,
      serviceId,
      currentPrice,
      proposedPrice,
      currency: 'CHF',
      effectiveFrom,
      effectiveTo,
      justification,
      status: 'pending_approval',
      proposedBy: user.name,
      proposedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`location-override-proposal:${proposal.id}`, proposal);
    
    // Create approval record
    const approval = {
      id: crypto.randomUUID(),
      type: 'location_override',
      referenceId: proposal.id,
      proposedBy: user.name,
      proposedAt: new Date().toISOString(),
      proposalData: proposal,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`approval:${approval.id}`, approval);
    
    // Audit log
    await createAuditLog('location_override_proposed', 'location_override', proposal.id, user, null, proposal);
    
    return c.json({ proposal, approval });
  } catch (e: any) {
    console.error('Propose location override error:', e);
    return internalError(c, 'pricing_approvals.postLocationOverridePropose', e);
  }
});

routes.post("/location-override/approve", async (c) => {
  try {
    const user = getUserFromContext();
    if (!hasPermission(user, 'pricing:approve')) {
      return c.json({ error: 'Insufficient permissions to approve location overrides' }, 403);
    }
    
    const { proposalId, approvalComment } = await c.req.json();
    
    const proposal = await kv.get(`location-override-proposal:${proposalId}`);
    if (!proposal) {
      return c.json({ error: 'Proposal not found' }, 404);
    }
    
    if (proposal.status !== 'pending_approval') {
      return c.json({ error: 'Only pending proposals can be approved' }, 400);
    }
    
    // Update proposal
    const updated = {
      ...proposal,
      status: 'approved',
      approvedBy: user.name,
      approvedAt: new Date().toISOString(),
      approvalComment,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`location-override-proposal:${proposalId}`, updated);
    
    // Create active location override
    const override = {
      id: crypto.randomUUID(),
      proposalId,
      locationId: proposal.locationId,
      serviceId: proposal.serviceId,
      price: proposal.proposedPrice,
      currency: proposal.currency,
      effectiveFrom: proposal.effectiveFrom,
      effectiveTo: proposal.effectiveTo,
      justification: proposal.justification,
      isActive: true,
      createdBy: user.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    };
    
    await kv.set(`location-override:${override.id}`, override);
    
    // Update approval record
    const approvals = await kv.getByPrefix('approval:');
    const approval = approvals.find((a: any) => a.referenceId === proposalId && a.type === 'location_override');
    
    if (approval) {
      approval.status = 'approved';
      approval.approvedBy = user.name;
      approval.approvedAt = new Date().toISOString();
      approval.approvalComment = approvalComment;
      approval.updatedAt = new Date().toISOString();
      await kv.set(`approval:${approval.id}`, approval);
    }
    
    // Audit log
    await createAuditLog('location_override_approved', 'location_override', proposalId, user, proposal, updated);
    await createAuditLog('location_override_activated', 'location_override', override.id, user, null, override);
    
    return c.json({ proposal: updated, override });
  } catch (e: any) {
    console.error('Approve location override error:', e);
    return internalError(c, 'pricing_approvals.postLocationOverrideApprove', e);
  }
});

routes.post("/location-override/reject", async (c) => {
  try {
    const user = getUserFromContext();
    if (!hasPermission(user, 'pricing:approve')) {
      return c.json({ error: 'Insufficient permissions to reject location overrides' }, 403);
    }
    
    const { proposalId, rejectionReason } = await c.req.json();
    
    if (!rejectionReason) {
      return c.json({ error: 'Rejection reason is required' }, 400);
    }
    
    const proposal = await kv.get(`location-override-proposal:${proposalId}`);
    if (!proposal) {
      return c.json({ error: 'Proposal not found' }, 404);
    }
    
    if (proposal.status !== 'pending_approval') {
      return c.json({ error: 'Only pending proposals can be rejected' }, 400);
    }
    
    // Update proposal
    const updated = {
      ...proposal,
      status: 'rejected',
      rejectedBy: user.name,
      rejectedAt: new Date().toISOString(),
      rejectionReason,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`location-override-proposal:${proposalId}`, updated);
    
    // Update approval record
    const approvals = await kv.getByPrefix('approval:');
    const approval = approvals.find((a: any) => a.referenceId === proposalId && a.type === 'location_override');
    
    if (approval) {
      approval.status = 'rejected';
      approval.rejectedBy = user.name;
      approval.rejectedAt = new Date().toISOString();
      approval.rejectionReason = rejectionReason;
      approval.updatedAt = new Date().toISOString();
      await kv.set(`approval:${approval.id}`, approval);
    }
    
    // Audit log
    await createAuditLog('location_override_rejected', 'location_override', proposalId, user, proposal, updated, { rejectionReason });
    
    return c.json({ proposal: updated });
  } catch (e: any) {
    console.error('Reject location override error:', e);
    return internalError(c, 'pricing_approvals.postLocationOverrideReject', e);
  }
});

// ============================================================================
// IMPACT PREVIEW (MANDATORY BEFORE APPROVAL)
// ============================================================================

routes.post("/impact-preview", async (c) => {
  try {
    const user = getUserFromContext();
    if (!hasPermission(user, 'pricing:approve')) {
      return c.json({ error: 'Insufficient permissions to view impact preview' }, 403);
    }
    
    const { type, referenceId, proposedChanges } = await c.req.json();
    
    // Generate impact preview based on type
    let impactPreview: any = {
      servicesAffected: [],
      locationsAffected: [],
      effectiveDate: new Date().toISOString(),
      upcomingBookingsImpacted: 0,
      draftBookingsImpacted: 0,
      totalPriceChanges: 0,
      averagePriceChange: 0,
      maxPriceIncrease: 0,
      maxPriceDecrease: 0,
      generatedAt: new Date().toISOString(),
    };
    
    if (type === 'price_book') {
      // Get all price entries for this price book version
      const priceEntries = await kv.getByPrefix('price-entry:');
      const versionEntries = priceEntries.filter((pe: any) => pe.priceBookVersionId === referenceId);
      
      // Get current active prices for comparison
      const services = await kv.getByPrefix('service:');
      
      impactPreview.servicesAffected = versionEntries.map((entry: any) => {
        const service = services.find((s: any) => s.id === entry.serviceId);
        const currentEntry = priceEntries.find((pe: any) => 
          pe.serviceId === entry.serviceId && 
          pe.isActive
        );
        const oldPrice = currentEntry?.price || 0;
        const newPrice = entry.price;
        const priceChange = newPrice - oldPrice;
        const priceChangePercent = oldPrice > 0 ? (priceChange / oldPrice) * 100 : 0;
        
        return {
          serviceId: entry.serviceId,
          serviceName: service?.name || 'Unknown Service',
          oldPrice,
          newPrice,
          priceChange,
          priceChangePercent,
          locationsAffected: ['All'], // Simplified
        };
      });
      
      impactPreview.totalPriceChanges = versionEntries.length;
      
      const priceChanges = impactPreview.servicesAffected.map((s: any) => s.priceChangePercent);
      if (priceChanges.length > 0) {
        impactPreview.averagePriceChange = priceChanges.reduce((a: number, b: number) => a + b, 0) / priceChanges.length;
        impactPreview.maxPriceIncrease = Math.max(...priceChanges.filter((pc: number) => pc > 0), 0);
        impactPreview.maxPriceDecrease = Math.min(...priceChanges.filter((pc: number) => pc < 0), 0);
      }
    } else if (type === 'location_override') {
      const proposal = await kv.get(`location-override-proposal:${referenceId}`);
      if (proposal) {
        const service = await kv.get(`service:${proposal.serviceId}`);
        const location = await kv.get(`location:${proposal.locationId}`);
        
        const priceChange = proposal.proposedPrice - proposal.currentPrice;
        const priceChangePercent = proposal.currentPrice > 0 ? (priceChange / proposal.currentPrice) * 100 : 0;
        
        impactPreview.servicesAffected = [{
          serviceId: proposal.serviceId,
          serviceName: service?.name || 'Unknown Service',
          oldPrice: proposal.currentPrice,
          newPrice: proposal.proposedPrice,
          priceChange,
          priceChangePercent,
          locationsAffected: [location?.name || proposal.locationId],
        }];
        
        impactPreview.locationsAffected = [proposal.locationId];
        impactPreview.totalPriceChanges = 1;
        impactPreview.averagePriceChange = priceChangePercent;
        impactPreview.maxPriceIncrease = priceChangePercent > 0 ? priceChangePercent : 0;
        impactPreview.maxPriceDecrease = priceChangePercent < 0 ? priceChangePercent : 0;
        impactPreview.effectiveDate = proposal.effectiveFrom;
      }
    }
    
    // TODO: Calculate upcoming bookings impacted (requires bookings module integration)
    
    return c.json(impactPreview);
  } catch (e: any) {
    console.error('Impact preview error:', e);
    return internalError(c, 'pricing_approvals.postImpactPreview', e);
  }
});

// ============================================================================
// APPROVALS QUERY
// ============================================================================

routes.get("/approvals/pending", async (c) => {
  try {
    const user = getUserFromContext();
    const approvals = await kv.getByPrefix('approval:');
    
    if (!approvals) {
      return c.json([]);
    }
    
    const pending = approvals.filter((a: any) => a.status === 'pending_approval');
    
    // Enrich with details
    const enriched = await Promise.all(pending.map(async (approval: any) => {
      let details = null;
      
      if (approval.type === 'price_book') {
        details = await kv.get(`price-book-version:${approval.referenceId}`);
      } else if (approval.type === 'location_override') {
        details = await kv.get(`location-override-proposal:${approval.referenceId}`);
      }
      
      return {
        ...approval,
        details,
      };
    }));
    
    return c.json(enriched);
  } catch (e: any) {
    console.error('Fetch pending approvals error:', e);
    return internalError(c, 'pricing_approvals.getApprovalsPending', e);
  }
});

routes.get("/approvals/history", async (c) => {
  try {
    const user = getUserFromContext();
    const approvals = await kv.getByPrefix('approval:');
    
    if (!approvals) {
      return c.json([]);
    }
    
    const history = approvals.filter((a: any) => a.status === 'approved' || a.status === 'rejected');
    
    // Sort by most recent
    history.sort((a: any, b: any) => {
      const dateA = new Date(a.approvedAt || a.rejectedAt || a.createdAt).getTime();
      const dateB = new Date(b.approvedAt || b.rejectedAt || b.createdAt).getTime();
      return dateB - dateA;
    });
    
    return c.json(history);
  } catch (e: any) {
    console.error('Fetch approval history error:', e);
    return internalError(c, 'pricing_approvals.getApprovalsHistory', e);
  }
});

// ============================================================================
// AUDIT LOG QUERY
// ============================================================================

routes.get("/audit-log", async (c) => {
  try {
    const user = getUserFromContext();
    const entityType = c.req.query('entityType');
    const entityId = c.req.query('entityId');
    
    let logs = await kv.getByPrefix('pricing-audit:');
    
    if (entityType) {
      logs = logs.filter((log: any) => log.entityType === entityType);
    }
    
    if (entityId) {
      logs = logs.filter((log: any) => log.entityId === entityId);
    }
    
    // Sort by most recent
    logs.sort((a: any, b: any) => {
      const dateA = new Date(a.performedAt).getTime();
      const dateB = new Date(b.performedAt).getTime();
      return dateB - dateA;
    });
    
    return c.json(logs);
  } catch (e: any) {
    console.error('Fetch audit log error:', e);
    return internalError(c, 'pricing_approvals.getAuditLog', e);
  }
});

export default routes;