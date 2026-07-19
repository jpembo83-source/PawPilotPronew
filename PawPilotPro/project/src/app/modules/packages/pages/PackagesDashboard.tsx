// Packages & Memberships Dashboard — MDC Operations Centre

import React, { useEffect, useState } from 'react';
import { usePackagesStore } from '../store';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import {
  UserPlus,
  ArrowRight,
  CheckCircle,
  Infinity,
  Calendar,
  Warning,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { MEMBERSHIP_PLANS, CANCELLATION_POLICY, formatPlanPrice, planFromServer } from '../membership-plans';
import type { MembershipPlan } from '../membership-plans';
import { useServicesPricingStore } from '../../services-pricing/store';
import { AssignMembershipDialog } from '../components/AssignMembershipDialog';
import type { CustomerPackage } from '../types';

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, onAssign }: { plan: MembershipPlan; onAssign: () => void }) {
  const isUnlimited = plan.daysPerMonth === 'unlimited';

  return (
    <div
      className={`relative flex flex-col rounded-2xl border overflow-hidden transition-shadow hover:shadow-lg ${
        plan.featured
          ? 'border-primary shadow-md shadow-primary/10'
          : 'border-slate-200'
      }`}
    >
      {plan.featured && (
        <div className="absolute top-0 inset-x-0 h-0.5 bg-primary" />
      )}

      {/* Header */}
      <div className={`px-5 pt-5 pb-4 ${plan.featured ? 'bg-primary-tint' : 'bg-white'}`}>
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-mono text-slate-400">{plan.id}</span>
          {plan.featured && (
            <Badge className="bg-primary text-white border-0 text-xs">Popular</Badge>
          )}
        </div>
        <h3 className="text-base font-black tracking-tight text-slate-900 leading-tight mb-1">
          {plan.name}
        </h3>
        <div className="flex items-end gap-1 mt-3">
          <span className="text-3xl font-black text-slate-900">
            {formatPlanPrice(plan).replace('CHF', '').trim()}
          </span>
          <div className="pb-1">
            <span className="text-sm font-semibold text-slate-500">CHF</span>
            <span className="text-xs text-slate-400 block -mt-0.5">/month</span>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-5 py-4 flex-1 space-y-2.5 border-t">
        <FeatureRow
          icon={isUnlimited ? <Infinity size={14} /> : <Calendar size={14} />}
          text={
            isUnlimited
              ? 'Everyday daycare access'
              : `${plan.daysPerMonth} ${plan.sessionType === 'half_day' ? 'half-day' : 'full-day'} sessions`
          }
        />
        {plan.rolloverEnabled && (
          <FeatureRow
            icon={<CheckCircle size={14} />}
            text="Unused days roll over"
          />
        )}
        <FeatureRow
          icon={<CheckCircle size={14} />}
          text={plan.sessionType === 'half_day' ? 'Half-day sessions (AM or PM)' : 'Full-day sessions'}
        />
        <FeatureRow
          icon={<CheckCircle size={14} />}
          text="Cancel anytime"
        />
      </div>

      {/* CTA */}
      <div className="px-5 pb-5 pt-3 border-t">
        <Button
          onClick={onAssign}
          className={`w-full gap-2 ${
            plan.featured
              ? 'text-white hover:opacity-90'
              : 'bg-slate-900 text-white hover:bg-slate-700'
          }`}
          style={plan.featured ? { backgroundColor: 'var(--primary)' } : undefined}
        >
          <UserPlus size={15} weight="bold" />
          Assign to Customer
        </Button>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-primary mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-sm text-slate-600">{text}</span>
    </div>
  );
}

// ─── Active Membership Row ────────────────────────────────────────────────────

function MembershipRow({ cp }: { cp: CustomerPackage }) {
  const isActive = cp.status === 'active';
  const creditsRemaining = cp.credits_remaining ?? 0;
  const creditsTotal = cp.credits_total ?? 0;
  const pct = creditsTotal > 0 ? Math.round((creditsRemaining / creditsTotal) * 100) : 0;
  const expiresDate = cp.expiry_date ? new Date(cp.expiry_date) : null;
  const expiringSoon = expiresDate
    ? expiresDate.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900 text-sm truncate">{cp.package_name}</span>
          <Badge
            className={`text-xs border-0 ${
              cp.status === 'active' ? 'bg-emerald-100 text-emerald-700'
              : cp.status === 'cancelled' ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-600'
            }`}
          >
            {cp.status}
          </Badge>
        </div>
        {expiresDate && (
          <p className={`text-xs mt-0.5 ${expiringSoon ? 'text-amber-600' : 'text-slate-400'}`}>
            {expiringSoon && <Warning size={11} className="inline mr-0.5" />}
            Renews {expiresDate.toLocaleDateString('en-GB')}
          </p>
        )}
      </div>

      {/* Credit bar — only for credit packages */}
      {creditsTotal > 0 && (
        <div className="w-32 flex-shrink-0">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{creditsRemaining} left</span>
            <span>{creditsTotal}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct > 50 ? 'bg-primary' : pct > 20 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {cp.package_type === 'unlimited' && (
        <div className="flex-shrink-0 text-slate-400">
          <Infinity size={16} />
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function PackagesDashboard() {
  const { customerPackages, stats, isLoading, error, fetchCustomerPackages, fetchStats, clearError } = usePackagesStore();
  const { membershipPlans: managedPlans, fetchMembershipPlans } = useServicesPricingStore();

  const [assignTarget, setAssignTarget] = useState<MembershipPlan | null>(null);

  useEffect(() => {
    fetchCustomerPackages();
    fetchStats();
    void fetchMembershipPlans();
  }, []);

  // Managed catalogue first (Settings → Services & Pricing → Memberships);
  // the built-in MO01–MO05 plans remain the catalogue until any managed
  // plan exists, so the dashboard is never empty on a fresh deployment.
  const activeManagedPlans = managedPlans
    .map(planFromServer)
    .filter((p): p is MembershipPlan => p !== null);
  const catalogue = activeManagedPlans.length > 0 ? activeManagedPlans : MEMBERSHIP_PLANS;

  useEffect(() => {
    if (error) { toast.error(error); clearError(); }
  }, [error]);

  const activeCount = customerPackages.filter(c => c.status === 'active').length;

  return (
    <div className="p-5 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Memberships</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} active membership{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        {stats && stats.expiring_soon > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <Warning size={15} />
            {stats.expiring_soon} renewal{stats.expiring_soon !== 1 ? 's' : ''} this week
          </div>
        )}
      </div>

      {/* Rollover policy callout */}
      <div className="flex items-start gap-3 p-4 bg-primary-tint rounded-xl border border-primary/20">
        <CheckCircle size={18} className="text-primary mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-slate-900">Day rollover policy</p>
          <p className="text-sm text-slate-600 mt-0.5">{CANCELLATION_POLICY.rollover}</p>
        </div>
      </div>

      {/* Plan grid */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Plan Catalogue</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {catalogue.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onAssign={() => setAssignTarget(plan)}
            />
          ))}
        </div>
      </div>

      {/* Active memberships */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Active Customer Memberships</h2>
        {isLoading && customerPackages.length === 0 ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : customerPackages.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center border rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ArrowRight size={22} className="text-slate-400" />
            </div>
            <p className="font-medium text-slate-600">No active memberships yet</p>
            <p className="text-sm text-slate-400 mt-1">Assign a plan above to get started</p>
          </div>
        ) : (
          <div className="border rounded-2xl overflow-hidden divide-y bg-white">
            {customerPackages
              .filter(cp => cp.status === 'active')
              .map(cp => <MembershipRow key={cp.id} cp={cp} />)}
            {customerPackages.filter(cp => cp.status !== 'active').length > 0 && (
              <details className="group">
                <summary className="px-4 py-3 text-xs text-slate-400 cursor-pointer hover:text-slate-600 list-none flex items-center gap-1">
                  <ArrowRight size={12} className="transition-transform group-open:rotate-90" />
                  {customerPackages.filter(cp => cp.status !== 'active').length} inactive memberships
                </summary>
                {customerPackages
                  .filter(cp => cp.status !== 'active')
                  .map(cp => <MembershipRow key={cp.id} cp={cp} />)}
              </details>
            )}
          </div>
        )}
      </div>

      <AssignMembershipDialog
        open={!!assignTarget}
        onOpenChange={(v) => { if (!v) setAssignTarget(null); }}
        plan={assignTarget}
      />
    </div>
  );
}
