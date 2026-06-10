// AssignMembershipDialog — search a household and enrol them in a plan

import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { MagnifyingGlass, CheckCircle, Warning, Users, ArrowLeft } from '@phosphor-icons/react';
import { useDaycareStore } from '../../daycare/store';
import { usePackagesStore } from '../store';
import { toast } from 'sonner';
import type { MembershipPlan } from '../membership-plans';
import { formatPlanPrice, CANCELLATION_POLICY } from '../membership-plans';

interface AssignMembershipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MembershipPlan | null;
}

export function AssignMembershipDialog({ open, onOpenChange, plan }: AssignMembershipDialogProps) {
  const { searchCustomers } = useDaycareStore();
  const { purchasePackage, isLoading } = usePackagesStore();

  const [step, setStep] = useState<'search' | 'confirm'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedHousehold, setSelectedHousehold] = useState<any | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('search');
      setQuery('');
      setResults([]);
      setSelectedHousehold(null);
    }
  }, [open]);

  useEffect(() => {
    if (step !== 'search') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchCustomers(query);
        setResults(r);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, step]);

  const handleConfirm = async () => {
    if (!selectedHousehold || !plan) return;
    try {
      await purchasePackage(selectedHousehold.household_id, plan.id);
      toast.success(`${plan.name} assigned to ${selectedHousehold.household_name}`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign membership');
    }
  };

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Membership</DialogTitle>
          <DialogDescription>
            {step === 'search'
              ? 'Search for the household to enrol'
              : `Confirm membership for ${selectedHousehold?.household_name}`}
          </DialogDescription>
        </DialogHeader>

        {/* Plan summary chip */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary-tint border border-primary/20">
          <div>
            <span className="text-xs font-mono text-primary/70">{plan.id}</span>
            <p className="font-semibold text-slate-900 text-sm">{plan.name}</p>
          </div>
          <span className="text-lg font-bold text-primary">{formatPlanPrice(plan)}<span className="text-xs font-normal text-slate-500">/mo</span></span>
        </div>

        {step === 'search' && (
          <div className="space-y-3">
            <div className="relative">
              <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                placeholder="Search by household, pet or contact…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">Searching…</span>
              )}
            </div>

            {results.length > 0 && (
              <div className="max-h-64 overflow-y-auto divide-y rounded-lg border">
                {results.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => { setSelectedHousehold(r); setStep('confirm'); }}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-tint flex items-center justify-center flex-shrink-0">
                      <Users size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 text-sm">{r.household_name}</p>
                      <p className="text-xs text-slate-400">{r.pets?.map((p: any) => p.name).join(', ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {query.trim().length >= 2 && !searching && results.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-4">No households found</p>
            )}
          </div>
        )}

        {step === 'confirm' && selectedHousehold && (
          <div className="space-y-4">
            <button
              onClick={() => setStep('search')}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft size={14} /> Back
            </button>

            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-tint flex items-center justify-center">
                  <Users size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{selectedHousehold.household_name}</p>
                  <p className="text-xs text-slate-400">{selectedHousehold.pets?.map((p: any) => p.name).join(' · ')}</p>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Plan</span>
                  <span className="font-medium text-slate-900">{plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Monthly fee</span>
                  <span className="font-semibold text-primary">{formatPlanPrice(plan)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Included days</span>
                  <span className="font-medium">
                    {plan.daysPerMonth === 'unlimited'
                      ? 'Unlimited'
                      : `${plan.daysPerMonth} ${plan.sessionType === 'half_day' ? 'half' : 'full'} days`}
                  </span>
                </div>
                {plan.rolloverEnabled && (
                  <div className="flex items-start gap-2 mt-2 p-2 bg-amber-50 rounded-lg">
                    <CheckCircle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">{CANCELLATION_POLICY.rollover}</p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400">{CANCELLATION_POLICY.notice}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {step === 'confirm' && (
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              style={{ backgroundColor: 'var(--primary)' }}
              className="text-white hover:opacity-90"
            >
              {isLoading ? 'Enrolling…' : 'Confirm Enrolment'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
