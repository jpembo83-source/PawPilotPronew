import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { requireAuth } from "./_shared/auth.ts";

const routes = new Hono();

// Every pricing route requires a validated user (shared SERVICE_ROLE_KEY JWT check).
routes.use("*", requireAuth);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getUserFromContext = () => {
  // In production, extract from JWT token
  return { id: 'system', name: 'Admin' };
};

const addAuditFields = (data: any, isUpdate = false) => {
  const user = getUserFromContext();
  const now = new Date().toISOString();
  
  if (isUpdate) {
    return {
      ...data,
      updatedAt: now,
      updatedBy: user.name,
    };
  }
  
  return {
    ...data,
    id: data.id || crypto.randomUUID(),
    createdAt: now,
    createdBy: user.name,
    updatedAt: now,
    updatedBy: user.name,
  };
};

// ============================================================================
// SERVICES (Layer 1)
// ============================================================================

routes.get("/services", async (c) => {
  try {
    const services = await kv.getByPrefix("service:");
    return c.json(services);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.post("/services", async (c) => {
  try {
    const body = await c.req.json();
    const service = addAuditFields(body);
    await kv.set(`service:${service.id}`, service);
    return c.json(service);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.put("/services/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`service:${id}`);
    if (!existing) return c.json({ error: "Service not found" }, 404);
    
    const updated = addAuditFields({ ...existing, ...body }, true);
    await kv.set(`service:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.delete("/services/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`service:${id}`);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// PRICE BOOKS (Layer 2)
// ============================================================================

routes.get("/price-books", async (c) => {
  try {
    const priceBooks = await kv.getByPrefix("price-book:");
    return c.json(priceBooks);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.post("/price-books", async (c) => {
  try {
    const body = await c.req.json();
    const priceBook = addAuditFields(body);
    await kv.set(`price-book:${priceBook.id}`, priceBook);
    return c.json(priceBook);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.put("/price-books/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`price-book:${id}`);
    if (!existing) return c.json({ error: "Price book not found" }, 404);
    
    const updated = addAuditFields({ ...existing, ...body }, true);
    await kv.set(`price-book:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// MEMBERSHIPS (Layer 4)
// ============================================================================

routes.get("/memberships", async (c) => {
  try {
    const memberships = await kv.getByPrefix("membership:");
    return c.json(memberships);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.post("/memberships", async (c) => {
  try {
    const body = await c.req.json();
    const membership = addAuditFields(body);
    await kv.set(`membership:${membership.id}`, membership);
    return c.json(membership);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.put("/memberships/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`membership:${id}`);
    if (!existing) return c.json({ error: "Membership not found" }, 404);
    
    const updated = addAuditFields({ ...existing, ...body }, true);
    await kv.set(`membership:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// LOCATION OVERRIDES (Layer 3)
// ============================================================================

routes.get("/location-overrides", async (c) => {
  try {
    const locationId = c.req.query("locationId");
    const allOverrides = await kv.getByPrefix("location-override:");
    
    if (locationId) {
      const filtered = allOverrides.filter((o: any) => o.locationId === locationId);
      return c.json(filtered);
    }
    
    return c.json(allOverrides);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.post("/location-overrides", async (c) => {
  try {
    const body = await c.req.json();
    const override = addAuditFields(body);
    await kv.set(`location-override:${override.id}`, override);
    return c.json(override);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.put("/location-overrides/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`location-override:${id}`);
    if (!existing) return c.json({ error: "Override not found" }, 404);
    
    const updated = addAuditFields({ ...existing, ...body }, true);
    await kv.set(`location-override:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.delete("/location-overrides/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`location-override:${id}`);
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// MULTI-DOG RULES (Layer 4)
// ============================================================================

routes.get("/multi-dog-rules", async (c) => {
  try {
    const rules = await kv.getByPrefix("multi-dog-rule:");
    return c.json(rules);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.post("/multi-dog-rules", async (c) => {
  try {
    const body = await c.req.json();
    const rule = addAuditFields(body);
    await kv.set(`multi-dog-rule:${rule.id}`, rule);
    return c.json(rule);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.put("/multi-dog-rules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`multi-dog-rule:${id}`);
    if (!existing) return c.json({ error: "Rule not found" }, 404);
    
    const updated = addAuditFields({ ...existing, ...body }, true);
    await kv.set(`multi-dog-rule:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// PACKAGES (Layer 4)
// ============================================================================

routes.get("/packages", async (c) => {
  try {
    const packages = await kv.getByPrefix("package:");
    return c.json(packages);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.post("/packages", async (c) => {
  try {
    const body = await c.req.json();
    const pkg = addAuditFields(body);
    await kv.set(`package:${pkg.id}`, pkg);
    return c.json(pkg);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// FEE RULES (Layer 4)
// ============================================================================

routes.get("/fee-rules", async (c) => {
  try {
    const rules = await kv.getByPrefix("fee-rule:");
    return c.json(rules);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.post("/fee-rules", async (c) => {
  try {
    const body = await c.req.json();
    const rule = addAuditFields(body);
    await kv.set(`fee-rule:${rule.id}`, rule);
    return c.json(rule);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.put("/fee-rules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`fee-rule:${id}`);
    if (!existing) return c.json({ error: "Fee rule not found" }, 404);
    
    const updated = addAuditFields({ ...existing, ...body }, true);
    await kv.set(`fee-rule:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// DISCOUNT RULES (Layer 4)
// ============================================================================

routes.get("/discount-rules", async (c) => {
  try {
    const rules = await kv.getByPrefix("discount-rule:");
    return c.json(rules);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.post("/discount-rules", async (c) => {
  try {
    const body = await c.req.json();
    const rule = addAuditFields(body);
    await kv.set(`discount-rule:${rule.id}`, rule);
    return c.json(rule);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

routes.put("/discount-rules/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing = await kv.get(`discount-rule:${id}`);
    if (!existing) return c.json({ error: "Discount rule not found" }, 404);
    
    const updated = addAuditFields({ ...existing, ...body }, true);
    await kv.set(`discount-rule:${id}`, updated);
    return c.json(updated);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ============================================================================
// PRICE RESOLUTION (CRITICAL - Used by booking flows)
// ============================================================================

routes.post("/resolve", async (c) => {
  try {
    const request = await c.req.json();
    const { serviceId, locationId, frequencyTierId, quantity, date, membershipId, discountCodes } = request;
    
    // 1. Get the service
    const service = await kv.get(`service:${serviceId}`);
    if (!service) {
      return c.json({ error: "Service not found" }, 404);
    }
    
    // 2. Find active price book
    const allPriceBooks = await kv.getByPrefix("price-book:");
    const activePriceBook = allPriceBooks.find((pb: any) => {
      if (!pb.isActive) return false;
      const effectiveFrom = new Date(pb.effectiveFrom);
      const requestDate = new Date(date);
      if (requestDate < effectiveFrom) return false;
      if (pb.effectiveTo) {
        const effectiveTo = new Date(pb.effectiveTo);
        if (requestDate > effectiveTo) return false;
      }
      return true;
    });
    
    if (!activePriceBook) {
      return c.json({ error: "No active price book found" }, 404);
    }
    
    // 3. Find price entry
    let priceEntry = activePriceBook.entries.find((e: any) => {
      if (e.serviceId !== serviceId) return false;
      if (frequencyTierId && e.frequencyTierId !== frequencyTierId) return false;
      if (!frequencyTierId && e.frequencyTierId) return false;
      return true;
    });
    
    if (!priceEntry) {
      return c.json({ error: "Price not found for this service" }, 404);
    }
    
    // 4. Check for location override
    const allOverrides = await kv.getByPrefix("location-override:");
    const override = allOverrides.find((o: any) => {
      if (o.locationId !== locationId) return false;
      if (o.serviceId !== serviceId) return false;
      if (frequencyTierId && o.frequencyTierId !== frequencyTierId) return false;
      if (!frequencyTierId && o.frequencyTierId) return false;
      return true;
    });
    
    const basePrice = override ? override.overridePrice : priceEntry.basePrice;
    
    // 5. Calculate subtotal
    let subtotal = basePrice * quantity;
    
    // 6. Apply membership credits if applicable
    let membershipCreditUsed = 0;
    let availableCredits = 0;
    let creditsAfterBooking = 0;
    
    if (membershipId) {
      const membership = await kv.get(`membership:${membershipId}`);
      if (membership && membership.accessType === 'credits') {
        availableCredits = membership.creditsPerMonth || 0;
        // In a real system, track used credits per customer
        // For now, assume they have credits available
        if (availableCredits >= quantity) {
          membershipCreditUsed = quantity;
          subtotal = 0; // Credits cover the cost
          creditsAfterBooking = availableCredits - quantity;
        }
      } else if (membership && membership.accessType === 'unlimited') {
        // Unlimited access - no charge
        subtotal = 0;
        availableCredits = 999; // Represent unlimited
        creditsAfterBooking = 999;
      }
    }
    
    // 7. Calculate tax
    const taxAmount = subtotal * (priceEntry.taxRate || 0);
    const total = subtotal + taxAmount;
    
    // 8. Build resolved line item
    const lineItem = {
      id: crypto.randomUUID(),
      serviceId: service.id,
      serviceName: service.name,
      basePrice,
      quantity,
      unit: priceEntry.unit,
      membershipCreditUsed,
      discountsApplied: [],
      feesApplied: [],
      subtotal,
      taxAmount,
      total,
      priceLockedAt: new Date().toISOString(),
      priceBookId: activePriceBook.id,
      locationId,
    };
    
    return c.json({
      lineItem,
      availableCredits,
      creditsAfterBooking,
    });
  } catch (e: any) {
    console.error("Price resolution error:", e);
    return c.json({ error: e.message }, 500);
  }
});

export default routes;