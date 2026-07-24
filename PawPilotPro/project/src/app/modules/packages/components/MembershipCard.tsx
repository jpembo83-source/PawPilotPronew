// Membership / Package card for the household and pet profiles: shows the
// household's live membership (memberships are per-household — every dog in
// the household draws from it) and lets admin/manager assign one from the
// catalogue, define a custom agreement, or clear it back to pay-as-you-go.
// The booking engine's existing draw-down picks the assignment up untouched:
// it resolves the household's active membership itself at booking time.

import { useEffect, useState } from 'react';
import { Medal, Plus, X } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Textarea } from '../../../components/ui/textarea';
import { useAuth } from '../../../context/AuthContext';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { usePackagesStore } from '../store';
import { useServicesPricingStore } from '../../services-pricing/store';
import {
  MEMBERSHIP_PLANS,
  formatPlanPrice,
  planFromServer,
  type MembershipPlan,
} from '../membership-plans';
import type { CustomerPackage } from '../types';

interface MembershipCardProps {
  householdId: string;
}

const isCustom = (pkg: CustomerPackage) => pkg.package_id.startsWith('custom-');

function describeAllowance(pkg: CustomerPackage): string {
  if (pkg.package_type === 'unlimited') return 'Unlimited days';
  const session = pkg.session_type === 'half_day' ? 'half' : 'full';
  if (pkg.credits_remaining != null) {
    return `${pkg.credits_remaining} ${session}-day credit${pkg.credits_remaining === 1 ? '' : 's'} remaining`;
  }
  return `${session}-day credits`;
}

export function MembershipCard({ householdId }: MembershipCardProps) {
  const { user } = useAuth();
  const { confirm, confirmDialog } = useConfirmDialog();
  const {
    customerPackages,
    fetchCustomerPackages,
    purchasePackage,
    assignCustomPackage,
    cancelPackage,
  } = usePackagesStore();
  const { membershipPlans, fetchMembershipPlans } = useServicesPricingStore();

  const [assignOpen, setAssignOpen] = useState(false);
  const [mode, setMode] = useState<'catalogue' | 'custom'>('catalogue');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Custom agreement form
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customSession, setCustomSession] = useState<'full_day' | 'half_day'>('full_day');
  const [customUnlimited, setCustomUnlimited] = useState(false);
  const [customDays, setCustomDays] = useState('');
  const [customTerms, setCustomTerms] = useState('');

  useEffect(() => {
    void fetchCustomerPackages(householdId);
  }, [householdId, fetchCustomerPackages]);

  useEffect(() => {
    if (assignOpen) void fetchMembershipPlans();
  }, [assignOpen, fetchMembershipPlans]);

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  // Exhausted counts as live: lazy renewal tops it back up next period, and
  // the server refuses a second assignment alongside it.
  const live = customerPackages.find(
    p => p.customer_id === householdId && (p.status === 'active' || p.status === 'exhausted')
  );

  // Same catalogue rule as the Packages dashboard: managed plans (Settings →
  // Services & Pricing) when any exist, built-in MO01–MO05 otherwise.
  const managed = membershipPlans
    .map(planFromServer)
    .filter((p): p is MembershipPlan => p !== null);
  const catalogue = managed.length > 0 ? managed : MEMBERSHIP_PLANS;
  const selectedPlan = catalogue.find(p => p.id === selectedPlanId);

  const resetAssignForm = () => {
    setMode('catalogue');
    setSelectedPlanId('');
    setCustomName('');
    setCustomPrice('');
    setCustomSession('full_day');
    setCustomUnlimited(false);
    setCustomDays('');
    setCustomTerms('');
  };

  const handleAssign = async () => {
    setIsSubmitting(true);
    try {
      if (mode === 'catalogue') {
        if (!selectedPlan) return;
        await purchasePackage(householdId, selectedPlan.id);
        toast.success(`${selectedPlan.name} assigned`);
      } else {
        const price = parseFloat(customPrice);
        if (!customName.trim()) {
          toast.error('The agreement needs a name');
          return;
        }
        if (Number.isNaN(price) || price < 0) {
          toast.error('Monthly price must be a valid amount');
          return;
        }
        const days = parseInt(customDays, 10);
        if (!customUnlimited && (Number.isNaN(days) || days < 1)) {
          toast.error('Allowance must be at least 1 day per month (or unlimited)');
          return;
        }
        await assignCustomPackage(householdId, {
          name: customName.trim(),
          price,
          session_type: customSession,
          days_per_month: customUnlimited ? 'unlimited' : days,
          terms: customTerms.trim() || undefined,
        });
        toast.success(`Custom agreement "${customName.trim()}" assigned`);
      }
      setAssignOpen(false);
      resetAssignForm();
      await fetchCustomerPackages(householdId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign membership');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = async () => {
    if (!live) return;
    const confirmed = await confirm({
      title: 'Clear membership?',
      description: `${live.package_name} will be cancelled and future bookings revert to pay-as-you-go. Credits already drawn are unaffected.`,
      confirmLabel: 'Clear membership',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await cancelPackage(live.id);
      toast.success('Membership cleared — bookings revert to pay-as-you-go');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear membership');
    }
  };

  const canSubmit =
    mode === 'catalogue'
      ? !!selectedPlan
      : !!customName.trim() && !!customPrice && (customUnlimited || !!customDays);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Membership / Package</CardTitle>
            <CardDescription>
              Shared by every dog in the household — bookings draw it down automatically
            </CardDescription>
          </div>
          {canManage && !live && (
            <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Assign
            </Button>
          )}
          {canManage && live && (
            <Button variant="outline" size="sm" onClick={() => void handleClear()}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {live ? (
          <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--primary-tint)' }}>
            <Medal size={18} style={{ color: 'var(--primary)' }} className="shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-sm" style={{ color: 'var(--primary)' }}>
                  {live.package_name}
                </p>
                {isCustom(live) && <Badge variant="outline">Custom agreement</Badge>}
                {live.status === 'exhausted' && <Badge variant="outline">Exhausted</Badge>}
              </div>
              <p className="text-sm text-slate-700 mt-1">{describeAllowance(live)}</p>
              {live.next_billing_date && (
                <p className="text-sm text-slate-600 mt-0.5">
                  Renews {new Date(live.next_billing_date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
              {live.custom_terms && (
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{live.custom_terms}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-2">
            No membership — bookings are billed pay-as-you-go.
            {!canManage && ' Ask an admin or manager to assign one.'}
          </p>
        )}
      </CardContent>

      <Dialog
        open={assignOpen}
        onOpenChange={isOpen => {
          if (!isSubmitting) {
            setAssignOpen(isOpen);
            if (!isOpen) resetAssignForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Membership</DialogTitle>
            <DialogDescription>
              Pick a catalogue plan or define a custom agreement for this household.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode('catalogue')}
              className={`flex-1 py-1.5 px-3 rounded-md border text-sm font-medium transition-colors ${
                mode === 'catalogue'
                  ? 'border-primary bg-primary-tint text-primary-strong'
                  : 'border-border hover:border-input text-muted-foreground'
              }`}
            >
              From catalogue
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`flex-1 py-1.5 px-3 rounded-md border text-sm font-medium transition-colors ${
                mode === 'custom'
                  ? 'border-primary bg-primary-tint text-primary-strong'
                  : 'border-border hover:border-input text-muted-foreground'
              }`}
            >
              Custom agreement
            </button>
          </div>

          {mode === 'catalogue' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="membership-plan">Plan</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger id="membership-plan">
                    <SelectValue placeholder="Select a plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogue.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {formatPlanPrice(plan)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPlan && (
                <p className="text-sm text-slate-600">
                  {selectedPlan.daysPerMonth === 'unlimited'
                    ? 'Unlimited days'
                    : `${selectedPlan.daysPerMonth} ${
                        selectedPlan.sessionType === 'half_day' ? 'half' : 'full'
                      } days per month`}{' '}
                  · {formatPlanPrice(selectedPlan)}/mo
                </p>
              )}
            </div>
          )}

          {mode === 'custom' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom-name">Agreement name</Label>
                <Input
                  id="custom-name"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="e.g. Alisha's special arrangement"
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="custom-price">Monthly price (CHF)</Label>
                  <Input
                    id="custom-price"
                    type="number"
                    min="0"
                    step="0.05"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    placeholder="450"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="custom-session">Session type</Label>
                  <Select
                    value={customSession}
                    onValueChange={(value: 'full_day' | 'half_day') => setCustomSession(value)}
                  >
                    <SelectTrigger id="custom-session">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_day">Full day</SelectItem>
                      <SelectItem value="half_day">Half day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="custom-days">Days per month</Label>
                  <Input
                    id="custom-days"
                    type="number"
                    min="1"
                    max="62"
                    value={customDays}
                    onChange={e => setCustomDays(e.target.value)}
                    placeholder="8"
                    disabled={isSubmitting || customUnlimited}
                  />
                </div>
                <label className="flex items-center gap-2 pb-2.5 text-sm">
                  <Checkbox
                    checked={customUnlimited}
                    onCheckedChange={checked => setCustomUnlimited(checked === true)}
                    disabled={isSubmitting}
                  />
                  Unlimited
                </label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-terms">Inclusions / terms (optional)</Label>
                <Textarea
                  id="custom-terms"
                  value={customTerms}
                  onChange={e => setCustomTerms(e.target.value)}
                  placeholder="e.g. Includes 2 grooming washes per month"
                  rows={2}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleAssign()} disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </Card>
  );
}
