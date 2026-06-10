import React from 'react';
import { Receipt, Warning, Tag } from '@phosphor-icons/react';
import { useServicesPricingStore } from '../../store';

export function FeesDiscountsTab() {
  const { feeRules, discountRules } = useServicesPricingStore();

  return (
    <div className="space-y-8">
      {/* Fee Rules Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Fee Rules</h3>
        </div>

        {feeRules.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
            <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              No fee rules configured. Fee rules (late pickup, cancellation, no-show) can be added here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {feeRules.map((rule) => (
              <div
                key={rule.id}
                className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 mb-1">{rule.name}</h4>
                    <p className="text-sm text-slate-600">
                      Type: {rule.type.replace(/_/g, ' ')} • 
                      Amount: {rule.unit === 'fixed' ? `CHF ${rule.amount}` : `${rule.amount}${rule.unit === 'percentage_of_booking' ? '%' : ` per ${rule.unit.replace('per_', '')}`}`}
                    </p>
                    {rule.canBeWaived && (
                      <p className="text-xs text-amber-600 mt-1">
                        Can be waived{rule.waiverRequiresPermission ? ' (requires permission)' : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discount Rules Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Discount Rules</h3>
        </div>

        {discountRules.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-200 rounded-lg">
            <Tag className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              No discount rules configured. Promotional codes and automatic discounts can be added here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {discountRules.map((rule) => (
              <div
                key={rule.id}
                className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 mb-1">{rule.name}</h4>
                    <p className="text-sm text-slate-600">
                      {rule.discountType === 'percentage' ? `${rule.discountValue}% off` : `CHF ${rule.discountValue} off`}
                      {rule.requiresCode && ` • Code: ${rule.requiresCode}`}
                    </p>
                    {rule.requiresApproval && (
                      <p className="text-xs text-amber-600 mt-1">Requires approval</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Warning className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-900 mb-1">Fees & Discounts Management</p>
            <p className="text-amber-700">
              Fee rules (late pickup, cancellation, no-show) and discount rules are automatically applied to bookings based on configured conditions. 
              Permission-based waivers ensure only authorized staff can waive fees. All applications are audited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
