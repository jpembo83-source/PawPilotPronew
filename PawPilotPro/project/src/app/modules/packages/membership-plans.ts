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
