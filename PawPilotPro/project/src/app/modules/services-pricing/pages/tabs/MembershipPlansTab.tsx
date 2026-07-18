import React, { useState } from 'react';
import { Plus, PencilSimple, Power, Medal, Infinity as InfinityIcon, Calendar } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useServicesPricingStore } from '../../store';
import { MembershipPlan } from '../../types';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Badge } from '../../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import { Switch } from '../../../../components/ui/switch';

interface PlanFormState {
  displayName: string;
  name: string;
  monthlyPrice: string;
  currency: string;
  accessType: 'credits' | 'unlimited';
  creditsPerMonth: string;
  creditUnit: 'half_day' | 'full_day';
  isActive: boolean;
}

const EMPTY_FORM: PlanFormState = {
  displayName: '',
  name: '',
  monthlyPrice: '',
  currency: 'CHF',
  accessType: 'credits',
  creditsPerMonth: '',
  creditUnit: 'full_day',
  isActive: true,
};

function accessSummary(plan: MembershipPlan): string {
  if (plan.accessType === 'unlimited') return 'Unlimited daycare access';
  const unit = plan.creditUnit === 'half_day' ? 'half-day' : 'full-day';
  return `${plan.creditsPerMonth ?? 0} ${unit} sessions / month`;
}

export function MembershipPlansTab() {
  const { membershipPlans, createMembershipPlan, updateMembershipPlan, toggleMembershipStatus } =
    useServicesPricingStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (plan: MembershipPlan) => {
    setEditingId(plan.id);
    setForm({
      displayName: plan.displayName,
      name: plan.name,
      monthlyPrice: String(plan.monthlyPrice),
      creditsPerMonth: plan.creditsPerMonth != null ? String(plan.creditsPerMonth) : '',
      currency: plan.currency || 'CHF',
      accessType: plan.accessType,
      creditUnit: plan.creditUnit === 'half_day' ? 'half_day' : 'full_day',
      isActive: plan.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const price = Number(form.monthlyPrice);
    const credits = Number(form.creditsPerMonth);
    if (!form.displayName.trim() || !form.name.trim()) {
      toast.error('Display name and internal name are required');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error('Monthly price must be a non-negative number');
      return;
    }
    if (form.accessType === 'credits' && (!Number.isInteger(credits) || credits <= 0)) {
      toast.error('Credits plans need a whole number of sessions per month');
      return;
    }

    const payload = {
      module: 'daycare' as const,
      name: form.name.trim(),
      displayName: form.displayName.trim(),
      monthlyPrice: price,
      currency: form.currency.trim() || 'CHF',
      accessType: form.accessType,
      creditsPerMonth: form.accessType === 'credits' ? credits : undefined,
      creditUnit: form.creditUnit,
      allowedServiceIds: [],
      allowsMultipleDogs: false,
      isActive: form.isActive,
      requiresContract: false,
      allowPause: true,
      allowProration: true,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateMembershipPlan(editingId, payload);
        toast.success(`${form.displayName} updated`);
      } else {
        await createMembershipPlan(payload);
        toast.success(`${form.displayName} created`);
      }
      setDialogOpen(false);
    } catch {
      toast.error(editingId ? 'Failed to update plan' : 'Failed to create plan');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (plan: MembershipPlan) => {
    try {
      await toggleMembershipStatus(plan.id);
      toast.success(`${plan.displayName} ${plan.isActive ? 'archived' : 'reactivated'}`);
    } catch {
      toast.error('Failed to update plan status');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Membership plans</h2>
          <p className="text-sm text-slate-500">
            The catalogue staff assign from and bookings draw credits against.
            Archived plans stop being assignable; existing members keep what they bought.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New plan
        </Button>
      </div>

      {membershipPlans.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-lg py-12 text-center">
          <Medal className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No plans in the managed catalogue yet</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Until plans are created here, the built-in MDC plans (MO01–MO05) remain
            available for assignment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {membershipPlans.map((plan) => (
            <div
              key={plan.id}
              className={`border rounded-lg p-4 bg-white flex flex-col gap-3 ${
                plan.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{plan.displayName}</p>
                  <p className="text-xs font-mono text-slate-400">{plan.name}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    plan.isActive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }
                >
                  {plan.isActive ? 'Active' : 'Archived'}
                </Badge>
              </div>

              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-slate-900">{plan.monthlyPrice}</span>
                <span className="text-sm text-slate-500 pb-0.5">{plan.currency || 'CHF'}/month</span>
              </div>

              <p className="text-sm text-slate-600 flex items-center gap-2">
                {plan.accessType === 'unlimited' ? (
                  <InfinityIcon className="h-4 w-4 text-slate-400" />
                ) : (
                  <Calendar className="h-4 w-4 text-slate-400" />
                )}
                {accessSummary(plan)}
              </p>

              <div className="flex gap-2 mt-auto pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => openEdit(plan)}>
                  <PencilSimple className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => void handleToggle(plan)}>
                  <Power className="h-3.5 w-3.5" />
                  {plan.isActive ? 'Archive' : 'Reactivate'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit membership plan' : 'New membership plan'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Changes apply to future assignments. Existing members keep the terms they signed up for.'
                : 'Plans created here become assignable to households immediately.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="plan-display-name">Display name</Label>
              <Input
                id="plan-display-name"
                placeholder="e.g. Fun on the Regular"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Internal name / code</Label>
              <Input
                id="plan-name"
                placeholder="e.g. MO03"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-price">Monthly price</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min="0"
                  value={form.monthlyPrice}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-currency">Currency</Label>
                <Input
                  id="plan-currency"
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Access</Label>
              <Select
                value={form.accessType}
                onValueChange={(v) => setForm((f) => ({ ...f, accessType: v as 'credits' | 'unlimited' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credits">Monthly session credits</SelectItem>
                  <SelectItem value="unlimited">Unlimited access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.accessType === 'credits' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-credits">Sessions / month</Label>
                  <Input
                    id="plan-credits"
                    type="number"
                    min="1"
                    step="1"
                    value={form.creditsPerMonth}
                    onChange={(e) => setForm((f) => ({ ...f, creditsPerMonth: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Session length</Label>
                  <Select
                    value={form.creditUnit}
                    onValueChange={(v) => setForm((f) => ({ ...f, creditUnit: v as 'half_day' | 'full_day' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_day">Full day</SelectItem>
                      <SelectItem value="half_day">Half day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-slate-900">Active</p>
                <p className="text-xs text-slate-500">Assignable to households</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
