// MDC Daycare Membership Plans — canonical product catalog
// Days accrue and roll over to the following month (unused days never expire mid-subscription)

export type SessionType = 'full_day' | 'half_day';
export type MembershipTier = 'MO01' | 'MO02' | 'MO03' | 'MO04' | 'MO05';

export interface MembershipPlan {
  id: MembershipTier;
  name: string;
  tagline: string;
  price: number;
  currency: string;
  sessionType: SessionType;
  daysPerMonth: number | 'unlimited';
  billingPeriod: 'monthly';
  rolloverEnabled: boolean;
  rolloverLimit: number | null; // null = carry all unused days
  featured: boolean;
  serviceType: 'daycare';
}

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    id: 'MO01',
    name: 'SPLIT MY SOCIAL',
    tagline: '8 half daycare days/mo',
    price: 493,
    currency: 'CHF',
    sessionType: 'half_day',
    daysPerMonth: 8,
    billingPeriod: 'monthly',
    rolloverEnabled: true,
    rolloverLimit: null,
    featured: false,
    serviceType: 'daycare',
  },
  {
    id: 'MO02',
    name: 'STAYIN IN CONTACT',
    tagline: '5 full daycare days/mo',
    price: 473,
    currency: 'CHF',
    sessionType: 'full_day',
    daysPerMonth: 5,
    billingPeriod: 'monthly',
    rolloverEnabled: true,
    rolloverLimit: null,
    featured: false,
    serviceType: 'daycare',
  },
  {
    id: 'MO03',
    name: 'FUN ON THE REGULAR',
    tagline: '10 full daycare days/mo',
    price: 897,
    currency: 'CHF',
    sessionType: 'full_day',
    daysPerMonth: 10,
    billingPeriod: 'monthly',
    rolloverEnabled: true,
    rolloverLimit: null,
    featured: false,
    serviceType: 'daycare',
  },
  {
    id: 'MO04',
    name: 'ZURICH SOCIALITE',
    tagline: '15 full daycare days/mo',
    price: 1255,
    currency: 'CHF',
    sessionType: 'full_day',
    daysPerMonth: 15,
    billingPeriod: 'monthly',
    rolloverEnabled: true,
    rolloverLimit: null,
    featured: true,
    serviceType: 'daycare',
  },
  {
    id: 'MO05',
    name: 'FEAR OF MISSING OUT',
    tagline: 'Everyday daycare access',
    price: 1605,
    currency: 'CHF',
    sessionType: 'full_day',
    daysPerMonth: 'unlimited',
    billingPeriod: 'monthly',
    rolloverEnabled: false, // unlimited — no rollover needed
    rolloverLimit: null,
    featured: false,
    serviceType: 'daycare',
  },
];

export const CANCELLATION_POLICY = {
  rollover: 'Unused days accrue and can be used in the following month.',
  notice: 'Cancel anytime — membership remains active until the end of the current billing period.',
};

export function formatPlanPrice(plan: MembershipPlan): string {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.price);
}

export function getPlanById(id: string): MembershipPlan | undefined {
  return MEMBERSHIP_PLANS.find(p => p.id === id);
}

/**
 * Map a managed catalogue plan (the Layer-4 shape served by
 * GET /pricing/memberships and edited at Settings → Services & Pricing →
 * Memberships) into this module's display shape. Returns null for plans that
 * aren't day-based daycare plans (e.g. hourly credit units) — the dashboard
 * only sells what bookings can honour.
 */
export function planFromServer(record: {
  id: string;
  name?: string;
  displayName?: string;
  description?: string;
  monthlyPrice?: number;
  currency?: string;
  accessType?: string;
  creditsPerMonth?: number;
  creditUnit?: string;
  isActive?: boolean;
}): MembershipPlan | null {
  if (!record.id || record.isActive === false) return null;
  if (typeof record.monthlyPrice !== 'number' || record.monthlyPrice < 0) return null;

  const unlimited = record.accessType === 'unlimited';
  let daysPerMonth: number | 'unlimited';
  if (unlimited) {
    daysPerMonth = 'unlimited';
  } else if (
    record.accessType === 'credits' &&
    typeof record.creditsPerMonth === 'number' &&
    record.creditsPerMonth > 0
  ) {
    daysPerMonth = record.creditsPerMonth;
  } else {
    return null;
  }

  let sessionType: SessionType;
  if (record.creditUnit === 'half_day' || record.creditUnit === 'full_day') {
    sessionType = record.creditUnit;
  } else if (unlimited && record.creditUnit === undefined) {
    sessionType = 'full_day';
  } else {
    return null;
  }

  return {
    // Cast: managed-catalogue ids are free-form; the MembershipTier union only
    // describes the built-in plans. Everything reading plan.id treats it as a
    // string.
    id: record.id as MembershipTier,
    name: record.displayName || record.name || record.id,
    tagline: record.description
      || (unlimited
        ? 'Everyday daycare access'
        : `${daysPerMonth} ${sessionType === 'half_day' ? 'half' : 'full'} daycare days/mo`),
    price: record.monthlyPrice,
    currency: record.currency || 'CHF',
    sessionType,
    daysPerMonth,
    billingPeriod: 'monthly',
    rolloverEnabled: !unlimited,
    rolloverLimit: null,
    featured: false,
    serviceType: 'daycare',
  };
}
