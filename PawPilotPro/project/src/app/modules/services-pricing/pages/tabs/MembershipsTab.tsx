import React from 'react';
import { CreditCard, Infinity, Calendar, CheckCircle2, Award } from 'lucide-react';
import { useServicesPricingStore } from '../../store';
import { MembershipPlan } from '../../types';
import { Badge } from '../../../../components/ui/badge';

export function MembershipsTab() {
  const { membershipPlans, multiDogRules } = useServicesPricingStore();

  if (membershipPlans.length === 0) {
    return (
      <div className="text-center py-12">
        <CreditCard className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No membership plans yet</h3>
        <p className="text-sm text-slate-500 mb-4">
          Create a membership plan to offer recurring services
        </p>
      </div>
    );
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: currency || 'CHF',
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      {/* Membership Plans */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Membership Plans</h3>
          <Badge variant="outline" className="text-xs">
            {membershipPlans.filter(p => p.isActive).length} active
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {membershipPlans.map((plan) => (
            <div
              key={plan.id}
              className={`
                border rounded-lg p-5 transition-all
                ${plan.isActive 
                  ? 'border-slate-200 hover:border-slate-300 bg-white shadow-sm' 
                  : 'border-slate-100 bg-slate-50'
                }
              `}
            >
              <div className="space-y-4">
                {/* Plan Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold text-slate-900">{plan.name}</h4>
                    </div>
                    {!plan.isActive && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg font-bold text-primary">{plan.displayName}</p>
                  {plan.description && (
                    <p className="text-sm text-slate-600 mt-2">{plan.description}</p>
                  )}
                </div>

                {/* Pricing */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="text-center py-3">
                    <p className="text-3xl font-bold text-slate-900">
                      {formatCurrency(plan.monthlyPrice, plan.currency)}
                    </p>
                    <p className="text-sm text-slate-500">per month</p>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-2 text-sm">
                  {plan.accessType === 'credits' ? (
                    <div className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>
                        {plan.creditsPerMonth} {plan.creditUnit?.replace('_', ' ')} {plan.creditsPerMonth === 1 ? 'credit' : 'credits'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Infinity className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Unlimited access</span>
                    </div>
                  )}
                  
                  {plan.allowsMultipleDogs && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Users className="h-4 w-4 text-blue-500 shrink-0" />
                      <span>Multi-dog eligible</span>
                    </div>
                  )}
                  
                  {plan.minimumTermMonths && plan.minimumTermMonths > 1 && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <Calendar className="h-4 w-4 text-purple-500 shrink-0" />
                      <span>{plan.minimumTermMonths} month minimum</span>
                    </div>
                  )}
                  
                  {plan.allowPause && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Pause allowed</span>
                    </div>
                  )}
                  
                  {plan.allowProration && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>Pro-rated billing</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Dog Discount Rules */}
      {multiDogRules.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Multi-Dog Discount Rules</h3>
            <Badge variant="outline" className="text-xs">
              {multiDogRules.filter(r => r.isActive).length} active
            </Badge>
          </div>

          <div className="grid gap-3">
            {multiDogRules.map((rule) => (
              <div
                key={rule.id}
                className="border border-slate-200 rounded-lg p-4 bg-gradient-to-r from-blue-50/50 to-purple-50/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      <h4 className="font-medium text-slate-900">{rule.name}</h4>
                      {!rule.isActive && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                          Inactive
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 space-y-1">
                      <p>
                        <span className="font-medium">
                          {rule.applicableDogPosition === 2 ? 'Second' : 
                           rule.applicableDogPosition === 3 ? 'Third' : 
                           `${rule.applicableDogPosition}th`} dog
                        </span>
                        {' '}receives{' '}
                        <span className="font-semibold text-emerald-600">
                          {rule.discountType === 'percentage' 
                            ? `${rule.discountValue}% discount` 
                            : `CHF ${rule.discountValue} off`
                          }
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Applies to {rule.applicableMembershipIds.length} membership plan(s)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Users className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-1">Multi-Dog Household Support</p>
            <p className="text-blue-700">
              Memberships with multi-dog eligibility can be purchased for multiple dogs in the same household. 
              Discount rules are automatically applied based on the configured percentage or fixed amount.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}