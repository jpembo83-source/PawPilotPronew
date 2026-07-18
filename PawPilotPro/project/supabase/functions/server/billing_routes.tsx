// Billing Routes - Paw Pilot Pro
// Production-grade billing API with financial data governance and tenant isolation

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { requireAuth, requireRole } from './_shared/auth.ts';
import { requireSeedEnabled } from './_shared/seed_guard.ts';
import { monthlyPriceFor, type CustomerMembership } from './lib/membership_catalog.ts';

const app = new Hono();

// Every billing route requires a validated user. requireAuth handles JWT
// validation server-side with SERVICE_ROLE_KEY. Before this gate landed
// (1B.2 ext) every billing endpoint was unauthenticated — the file held a
// getUserFromToken/getTenantId/getUserInfo helper trio that no route called.
app.use('*', requireAuth);

// ============================================================================
// TYPES
// ============================================================================

type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'void' | 'part_paid';
type PaymentMethod = 'card' | 'bank_transfer' | 'cash' | 'direct_debit' | 'provider';

interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  service_id: string;
  service_name: string;
  module: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  booking_reference?: string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  household_id: string;
  household_name: string;
  location_id: string;
  location_name: string;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  paid_amount: number;
  balance: number;
  tags: string[];
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  voided_at?: string;
  voided_by?: string;
  void_reason?: string;
}

interface Payment {
  id: string;
  household_id: string;
  household_name: string;
  location_id: string;
  amount: number;
  method: PaymentMethod;
  provider_reference?: string;
  status: 'pending' | 'completed' | 'failed';
  allocation_status: 'unallocated' | 'allocated' | 'partial';
  notes?: string;
  created_by: string;
  created_at: string;
}

interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  amount: number;
  created_by: string;
  created_at: string;
}

interface Credit {
  id: string;
  household_id: string;
  household_name: string;
  amount: number;
  reason: string;
  source: 'overpayment' | 'goodwill' | 'credit_note' | 'refund_reversal';
  expires_at?: string;
  used_amount: number;
  balance: number;
  created_by: string;
  created_at: string;
}

interface Refund {
  id: string;
  payment_id?: string;
  invoice_id?: string;
  household_id: string;
  household_name: string;
  amount: number;
  method: PaymentMethod;
  provider_reference?: string;
  reason: string;
  approved_by: string;
  created_by: string;
  created_at: string;
}

interface Fee {
  id: string;
  household_id: string;
  household_name: string;
  location_id: string;
  fee_type: string;
  amount: number;
  reason: string;
  booking_reference?: string;
  invoiced: boolean;
  invoice_id?: string;
  created_by: string;
  created_at: string;
}

interface BillingExport {
  id: string;
  export_type: string;
  scope: string;
  format: 'csv' | 'pdf';
  filters: Record<string, any>;
  file_url?: string;
  created_by: string;
  created_at: string;
}

// ============================================================================
// OVERVIEW DASHBOARD
// ============================================================================

app.get('/overview', async (c) => {
  try {
    const { location_id } = c.req.query();

    // Get all invoices
    const invoices = await kv.getByPrefix<Invoice>('invoice:');
    const payments = await kv.getByPrefix<Payment>('payment:');
    // Membership stats come from the real customer memberships (tenant-scoped,
    // priced from the assignment snapshot / compiled catalogue) — the legacy
    // subscription: records were never wired to anything and are gone.
    const memberships = (await kv.getByPrefix(
      `customer_membership:${c.get('user').tenantId}:`,
    )) as CustomerMembership[];
    const credits = await kv.getByPrefix<Credit>('credit:');
    const refunds = await kv.getByPrefix<Refund>('refund:');

    // Filter by location if specified
    const filteredInvoices = location_id && location_id !== 'all'
      ? invoices.filter(inv => inv.location_id === location_id)
      : invoices;

    const filteredPayments = location_id && location_id !== 'all'
      ? payments.filter(p => p.location_id === location_id)
      : payments;

    // Calculate outstanding balance with ageing
    const now = new Date();
    const outstanding = {
      total: 0,
      current: 0, // 0-7 days
      early: 0,   // 8-30 days
      mid: 0,     // 31-60 days
      late: 0,    // 60+ days
    };

    filteredInvoices
      .filter(inv => inv.status !== 'void' && inv.balance > 0)
      .forEach(inv => {
        outstanding.total += inv.balance;
        
        if (inv.due_date) {
          const dueDate = new Date(inv.due_date);
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysOverdue <= 7) outstanding.current += inv.balance;
          else if (daysOverdue <= 30) outstanding.early += inv.balance;
          else if (daysOverdue <= 60) outstanding.mid += inv.balance;
          else outstanding.late += inv.balance;
        }
      });

    // Invoices due this week
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const invoicesDueThisWeek = filteredInvoices.filter(inv => {
      if (!inv.due_date || inv.status === 'paid' || inv.status === 'void') return false;
      const dueDate = new Date(inv.due_date);
      return dueDate >= now && dueDate <= weekFromNow;
    });

    // Payments received (today / week / month)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const paymentsToday = filteredPayments.filter(p => 
      new Date(p.created_at) >= today && p.status === 'completed'
    ).reduce((sum, p) => sum + p.amount, 0);

    const paymentsWeek = filteredPayments.filter(p => 
      new Date(p.created_at) >= weekAgo && p.status === 'completed'
    ).reduce((sum, p) => sum + p.amount, 0);

    const paymentsMonth = filteredPayments.filter(p => 
      new Date(p.created_at) >= monthAgo && p.status === 'completed'
    ).reduce((sum, p) => sum + p.amount, 0);

    // Failed payments
    const failedPayments = filteredPayments.filter(p => p.status === 'failed').length;

    // Membership revenue: sum of active plans' monthly price.
    const activeMemberships = memberships.filter(m => m.status === 'active');
    const membershipRevenue = activeMemberships.reduce(
      (sum, m) => sum + (monthlyPriceFor(m)?.price ?? 0),
      0,
    );

    // Refunds & credits issued (month-to-date)
    const refundsMonth = refunds.filter(r => 
      new Date(r.created_at) >= monthAgo
    ).reduce((sum, r) => sum + r.amount, 0);

    const creditsMonth = credits.filter(c => 
      new Date(c.created_at) >= monthAgo
    ).reduce((sum, c) => sum + c.amount, 0);

    return c.json({
      outstanding,
      invoices_due_this_week: invoicesDueThisWeek.length,
      invoices_due_total: invoicesDueThisWeek.reduce((sum, inv) => sum + inv.balance, 0),
      payments: {
        today: paymentsToday,
        week: paymentsWeek,
        month: paymentsMonth,
      },
      failed_payments: failedPayments,
      membership_revenue: membershipRevenue,
      active_memberships: activeMemberships.length,
      refunds_month: refundsMonth,
      credits_month: creditsMonth,
    });
  } catch (error) {
    console.error('Error fetching billing overview:', error);
    return c.json({ error: 'Failed to fetch billing overview' }, 500);
  }
});

// ============================================================================
// INVOICES
// ============================================================================

app.get('/invoices', async (c) => {
  try {
    const { location_id, status, overdue_only, household_id, module } = c.req.query();

    let invoices = await kv.getByPrefix<Invoice>('invoice:');

    // Apply filters
    if (location_id && location_id !== 'all') {
      invoices = invoices.filter(inv => inv.location_id === location_id);
    }
    if (status) {
      invoices = invoices.filter(inv => inv.status === status);
    }
    if (overdue_only === 'true') {
      const now = new Date();
      invoices = invoices.filter(inv => 
        inv.due_date && new Date(inv.due_date) < now && inv.balance > 0
      );
    }
    if (household_id) {
      invoices = invoices.filter(inv => inv.household_id === household_id);
    }
    if (module) {
      // Need to check line items - will implement when needed
    }

    // Sort by created_at descending
    invoices.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json({ invoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return c.json({ error: 'Failed to fetch invoices' }, 500);
  }
});

app.get('/invoices/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const invoice = await kv.get<Invoice>(`invoice:${id}`);
    if (!invoice) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    const lineItems = await kv.getByPrefix<InvoiceLineItem>(`invoice_line:${id}:`);
    const allocations = await kv.getByPrefix<PaymentAllocation>(`allocation:invoice:${id}:`);

    return c.json({ invoice, line_items: lineItems, allocations });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return c.json({ error: 'Failed to fetch invoice' }, 500);
  }
});

app.post('/invoices', requireRole('admin', 'manager'), async (c) => {
  try {
    const data = await c.req.json();
    const { household_id, household_name, location_id, location_name, line_items, created_by } = data;

    const id = crypto.randomUUID();
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;

    // Calculate totals from line items
    let subtotal = 0;
    let taxTotal = 0;

    const lineItemRecords: InvoiceLineItem[] = line_items.map((item: any) => {
      const itemSubtotal = item.quantity * item.unit_price - (item.discount || 0);
      const itemTax = itemSubtotal * (item.tax_rate || 0);
      const itemTotal = itemSubtotal + itemTax;

      subtotal += itemSubtotal;
      taxTotal += itemTax;

      const lineItemId = crypto.randomUUID();
      return {
        id: lineItemId,
        invoice_id: id,
        service_id: item.service_id,
        service_name: item.service_name,
        module: item.module,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate || 0,
        discount: item.discount || 0,
        subtotal: itemSubtotal,
        tax_amount: itemTax,
        total: itemTotal,
        booking_reference: item.booking_reference,
        created_at: new Date().toISOString(),
      };
    });

    const total = subtotal + taxTotal;

    const invoice: Invoice = {
      id,
      invoice_number: invoiceNumber,
      household_id,
      household_name,
      location_id,
      location_name,
      status: 'draft',
      issue_date: null,
      due_date: null,
      subtotal,
      tax_total: taxTotal,
      total,
      paid_amount: 0,
      balance: total,
      tags: data.tags || [],
      notes: data.notes,
      created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await kv.set(`invoice:${id}`, invoice);

    // Save line items
    for (const lineItem of lineItemRecords) {
      await kv.set(`invoice_line:${id}:${lineItem.id}`, lineItem);
    }

    console.log(`Created invoice ${invoiceNumber} for household ${household_name}`);

    return c.json({ invoice, line_items: lineItemRecords }, 201);
  } catch (error) {
    console.error('Error creating invoice:', error);
    return c.json({ error: 'Failed to create invoice' }, 500);
  }
});

app.patch('/invoices/:id/issue', requireRole('admin', 'manager'), async (c) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json();
    const { due_days, issued_by } = data;

    const invoice = await kv.get<Invoice>(`invoice:${id}`);
    if (!invoice) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    if (invoice.status !== 'draft') {
      return c.json({ error: 'Only draft invoices can be issued' }, 400);
    }

    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + (due_days || 7));

    invoice.status = 'issued';
    invoice.issue_date = issueDate.toISOString();
    invoice.due_date = dueDate.toISOString();
    invoice.updated_at = new Date().toISOString();

    await kv.set(`invoice:${id}`, invoice);

    console.log(`Issued invoice ${invoice.invoice_number}`);

    return c.json({ invoice });
  } catch (error) {
    console.error('Error issuing invoice:', error);
    return c.json({ error: 'Failed to issue invoice' }, 500);
  }
});

app.patch('/invoices/:id/void', requireRole('admin', 'manager'), async (c) => {
  try {
    const id = c.req.param('id');
    const data = await c.req.json();
    const { reason, voided_by } = data;

    if (!reason) {
      return c.json({ error: 'Void reason is required' }, 400);
    }

    const invoice = await kv.get<Invoice>(`invoice:${id}`);
    if (!invoice) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    if (invoice.status === 'void') {
      return c.json({ error: 'Invoice is already void' }, 400);
    }

    if (invoice.paid_amount > 0) {
      return c.json({ error: 'Cannot void invoice with payments. Issue credit note instead.' }, 400);
    }

    invoice.status = 'void';
    invoice.voided_at = new Date().toISOString();
    invoice.voided_by = voided_by;
    invoice.void_reason = reason;
    invoice.updated_at = new Date().toISOString();

    await kv.set(`invoice:${id}`, invoice);

    console.log(`Voided invoice ${invoice.invoice_number}: ${reason}`);

    return c.json({ invoice });
  } catch (error) {
    console.error('Error voiding invoice:', error);
    return c.json({ error: 'Failed to void invoice' }, 500);
  }
});

// ============================================================================
// PAYMENTS
// ============================================================================

app.get('/payments', async (c) => {
  try {
    const { location_id, household_id, status } = c.req.query();

    let payments = await kv.getByPrefix<Payment>('payment:');

    if (location_id && location_id !== 'all') {
      payments = payments.filter(p => p.location_id === location_id);
    }
    if (household_id) {
      payments = payments.filter(p => p.household_id === household_id);
    }
    if (status) {
      payments = payments.filter(p => p.status === status);
    }

    payments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json({ payments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return c.json({ error: 'Failed to fetch payments' }, 500);
  }
});

app.get('/payments/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const payment = await kv.get<Payment>(`payment:${id}`);
    if (!payment) {
      return c.json({ error: 'Payment not found' }, 404);
    }

    const allocations = await kv.getByPrefix<PaymentAllocation>(`allocation:payment:${id}:`);

    return c.json({ payment, allocations });
  } catch (error) {
    console.error('Error fetching payment:', error);
    return c.json({ error: 'Failed to fetch payment' }, 500);
  }
});

app.post('/payments', requireRole('admin', 'manager'), async (c) => {
  try {
    const data = await c.req.json();
    const { household_id, household_name, location_id, amount, method, provider_reference, notes, created_by } = data;

    const id = crypto.randomUUID();

    const payment: Payment = {
      id,
      household_id,
      household_name,
      location_id,
      amount,
      method,
      provider_reference,
      status: 'completed',
      allocation_status: 'unallocated',
      notes,
      created_by,
      created_at: new Date().toISOString(),
    };

    await kv.set(`payment:${id}`, payment);

    console.log(`Recorded payment of £${amount} for household ${household_name}`);

    return c.json({ payment }, 201);
  } catch (error) {
    console.error('Error recording payment:', error);
    return c.json({ error: 'Failed to record payment' }, 500);
  }
});

app.post('/payments/:id/allocate', requireRole('admin', 'manager'), async (c) => {
  try {
    const paymentId = c.req.param('id');
    const data = await c.req.json();
    const { invoice_id, amount, created_by } = data;

    const payment = await kv.get<Payment>(`payment:${paymentId}`);
    if (!payment) {
      return c.json({ error: 'Payment not found' }, 404);
    }

    const invoice = await kv.get<Invoice>(`invoice:${invoice_id}`);
    if (!invoice) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    // Check if allocation amount is valid
    const existingAllocations = await kv.getByPrefix<PaymentAllocation>(`allocation:payment:${paymentId}:`);
    const totalAllocated = existingAllocations.reduce((sum, a) => sum + a.amount, 0);
    const available = payment.amount - totalAllocated;

    if (amount > available) {
      return c.json({ error: 'Allocation amount exceeds available payment balance' }, 400);
    }

    if (amount > invoice.balance) {
      return c.json({ error: 'Allocation amount exceeds invoice balance' }, 400);
    }

    const allocationId = crypto.randomUUID();
    const allocation: PaymentAllocation = {
      id: allocationId,
      payment_id: paymentId,
      invoice_id,
      amount,
      created_by,
      created_at: new Date().toISOString(),
    };

    await kv.set(`allocation:payment:${paymentId}:${allocationId}`, allocation);
    await kv.set(`allocation:invoice:${invoice_id}:${allocationId}`, allocation);

    // Update payment allocation status
    const newTotalAllocated = totalAllocated + amount;
    if (newTotalAllocated >= payment.amount) {
      payment.allocation_status = 'allocated';
    } else {
      payment.allocation_status = 'partial';
    }
    await kv.set(`payment:${paymentId}`, payment);

    // Update invoice paid amount and status
    invoice.paid_amount += amount;
    invoice.balance = invoice.total - invoice.paid_amount;
    
    if (invoice.balance <= 0) {
      invoice.status = 'paid';
    } else if (invoice.paid_amount > 0) {
      invoice.status = 'part_paid';
    }
    
    invoice.updated_at = new Date().toISOString();
    await kv.set(`invoice:${invoice_id}`, invoice);

    console.log(`Allocated £${amount} from payment ${paymentId} to invoice ${invoice.invoice_number}`);

    return c.json({ allocation, invoice, payment });
  } catch (error) {
    console.error('Error allocating payment:', error);
    return c.json({ error: 'Failed to allocate payment' }, 500);
  }
});

// ============================================================================
// CREDITS & REFUNDS
// ============================================================================

app.get('/credits', async (c) => {
  try {
    const { household_id } = c.req.query();

    let credits = await kv.getByPrefix<Credit>('credit:');

    if (household_id) {
      credits = credits.filter(cr => cr.household_id === household_id);
    }

    // Filter to active credits only (balance > 0 and not expired)
    const now = new Date();
    credits = credits.filter(cr => {
      if (cr.balance <= 0) return false;
      if (cr.expires_at && new Date(cr.expires_at) < now) return false;
      return true;
    });

    credits.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json({ credits });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return c.json({ error: 'Failed to fetch credits' }, 500);
  }
});

app.post('/credits', requireRole('admin', 'manager'), async (c) => {
  try {
    const data = await c.req.json();
    const { household_id, household_name, amount, reason, source, expires_days, created_by } = data;

    const id = crypto.randomUUID();

    const expiresAt = expires_days ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString() : undefined;

    const credit: Credit = {
      id,
      household_id,
      household_name,
      amount,
      reason,
      source: source || 'goodwill',
      expires_at: expiresAt,
      used_amount: 0,
      balance: amount,
      created_by,
      created_at: new Date().toISOString(),
    };

    await kv.set(`credit:${id}`, credit);

    console.log(`Created credit of £${amount} for household ${household_name}: ${reason}`);

    return c.json({ credit }, 201);
  } catch (error) {
    console.error('Error creating credit:', error);
    return c.json({ error: 'Failed to create credit' }, 500);
  }
});

app.get('/refunds', async (c) => {
  try {
    const { household_id } = c.req.query();

    let refunds = await kv.getByPrefix<Refund>('refund:');

    if (household_id) {
      refunds = refunds.filter(r => r.household_id === household_id);
    }

    refunds.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json({ refunds });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    return c.json({ error: 'Failed to fetch refunds' }, 500);
  }
});

app.post('/refunds', requireRole('admin', 'manager'), async (c) => {
  try {
    const data = await c.req.json();
    const { payment_id, invoice_id, household_id, household_name, amount, method, provider_reference, reason, approved_by, created_by } = data;

    if (!reason) {
      return c.json({ error: 'Refund reason is required' }, 400);
    }

    const id = crypto.randomUUID();

    const refund: Refund = {
      id,
      payment_id,
      invoice_id,
      household_id,
      household_name,
      amount,
      method,
      provider_reference,
      reason,
      approved_by,
      created_by,
      created_at: new Date().toISOString(),
    };

    await kv.set(`refund:${id}`, refund);

    console.log(`Issued refund of £${amount} for household ${household_name}: ${reason}`);

    return c.json({ refund }, 201);
  } catch (error) {
    console.error('Error issuing refund:', error);
    return c.json({ error: 'Failed to issue refund' }, 500);
  }
});

// ============================================================================
// FEES & ADJUSTMENTS
// ============================================================================

app.get('/fees', async (c) => {
  try {
    const { household_id, location_id, invoiced } = c.req.query();

    let fees = await kv.getByPrefix<Fee>('fee:');

    if (household_id) {
      fees = fees.filter(f => f.household_id === household_id);
    }
    if (location_id && location_id !== 'all') {
      fees = fees.filter(f => f.location_id === location_id);
    }
    if (invoiced !== undefined) {
      fees = fees.filter(f => f.invoiced === (invoiced === 'true'));
    }

    fees.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json({ fees });
  } catch (error) {
    console.error('Error fetching fees:', error);
    return c.json({ error: 'Failed to fetch fees' }, 500);
  }
});

app.post('/fees', requireRole('admin', 'manager'), async (c) => {
  try {
    const data = await c.req.json();
    const { household_id, household_name, location_id, fee_type, amount, reason, booking_reference, created_by } = data;

    if (!reason) {
      return c.json({ error: 'Fee reason is required' }, 400);
    }

    const id = crypto.randomUUID();

    const fee: Fee = {
      id,
      household_id,
      household_name,
      location_id,
      fee_type,
      amount,
      reason,
      booking_reference,
      invoiced: false,
      created_by,
      created_at: new Date().toISOString(),
    };

    await kv.set(`fee:${id}`, fee);

    console.log(`Created ${fee_type} fee of £${amount} for household ${household_name}: ${reason}`);

    return c.json({ fee }, 201);
  } catch (error) {
    console.error('Error creating fee:', error);
    return c.json({ error: 'Failed to create fee' }, 500);
  }
});

// ============================================================================
// EXPORTS & RECONCILIATION
// ============================================================================

app.post('/exports', requireRole('admin', 'manager'), async (c) => {
  try {
    const data = await c.req.json();
    const { export_type, scope, format, filters, created_by } = data;

    const id = crypto.randomUUID();

    const billingExport: BillingExport = {
      id,
      export_type,
      scope,
      format: format || 'csv',
      filters: filters || {},
      created_by,
      created_at: new Date().toISOString(),
    };

    await kv.set(`export:${id}`, billingExport);

    console.log(`Created ${export_type} export (${format}) for scope: ${scope}`);

    return c.json({ export: billingExport }, 201);
  } catch (error) {
    console.error('Error creating export:', error);
    return c.json({ error: 'Failed to create export' }, 500);
  }
});

app.get('/exports', async (c) => {
  try {
    const exports = await kv.getByPrefix<BillingExport>('export:');
    exports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return c.json({ exports });
  } catch (error) {
    console.error('Error fetching exports:', error);
    return c.json({ error: 'Failed to fetch exports' }, 500);
  }
});

app.get('/reconciliation/unallocated-payments', async (c) => {
  try {
    const payments = await kv.getByPrefix<Payment>('payment:');
    const unallocated = payments.filter(p => 
      p.status === 'completed' && 
      (p.allocation_status === 'unallocated' || p.allocation_status === 'partial')
    );

    return c.json({ payments: unallocated });
  } catch (error) {
    console.error('Error fetching unallocated payments:', error);
    return c.json({ error: 'Failed to fetch unallocated payments' }, 500);
  }
});

// ============================================================================
// SEED DATA (FOR TESTING)
// ============================================================================

app.post('/seed', requireSeedEnabled, requireRole('admin', 'manager'), async (c) => {
  try {
    console.log('Seeding billing data...');

    // Create sample invoices
    const invoice1: Invoice = {
      id: crypto.randomUUID(),
      invoice_number: 'INV-2025-001',
      household_id: 'household-1',
      household_name: 'The Johnsons',
      location_id: 'london-central',
      location_name: 'London Central',
      status: 'issued',
      issue_date: new Date('2025-01-15').toISOString(),
      due_date: new Date('2025-01-22').toISOString(),
      subtotal: 120.00,
      tax_total: 24.00,
      total: 144.00,
      paid_amount: 0,
      balance: 144.00,
      tags: ['daycare'],
      created_by: 'admin',
      created_at: new Date('2025-01-15').toISOString(),
      updated_at: new Date('2025-01-15').toISOString(),
    };

    const invoice2: Invoice = {
      id: crypto.randomUUID(),
      invoice_number: 'INV-2025-002',
      household_id: 'household-2',
      household_name: 'The Smiths',
      location_id: 'london-central',
      location_name: 'London Central',
      status: 'paid',
      issue_date: new Date('2025-01-10').toISOString(),
      due_date: new Date('2025-01-17').toISOString(),
      subtotal: 80.00,
      tax_total: 16.00,
      total: 96.00,
      paid_amount: 96.00,
      balance: 0,
      tags: ['grooming'],
      created_by: 'admin',
      created_at: new Date('2025-01-10').toISOString(),
      updated_at: new Date('2025-01-18').toISOString(),
    };

    await kv.set(`invoice:${invoice1.id}`, invoice1);
    await kv.set(`invoice:${invoice2.id}`, invoice2);

    // Create sample payment
    const payment1: Payment = {
      id: crypto.randomUUID(),
      household_id: 'household-2',
      household_name: 'The Smiths',
      location_id: 'london-central',
      amount: 96.00,
      method: 'card',
      provider_reference: 'ch_3ABC123',
      status: 'completed',
      allocation_status: 'allocated',
      created_by: 'admin',
      created_at: new Date('2025-01-18').toISOString(),
    };

    await kv.set(`payment:${payment1.id}`, payment1);

    console.log('Billing data seeded successfully');

    return c.json({ 
      message: 'Billing data seeded successfully',
      invoices: 2,
      payments: 1,
    });
  } catch (error) {
    console.error('Error seeding billing data:', error);
    return c.json({ error: 'Failed to seed billing data' }, 500);
  }
});

export default app;
