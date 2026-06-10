import React, { useState } from 'react';
import { Receipt, CheckCircle, CalendarBlank, MapPin } from '@phosphor-icons/react';
import { useServicesPricingStore } from '../../store';
import { PriceBook } from '../../types';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";

export function PriceBooksTab() {
  const { priceBooks, services, activePriceBook } = useServicesPricingStore();
  const [selectedPriceBook, setSelectedPriceBook] = useState<PriceBook | null>(null);

  if (priceBooks.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No price books yet</h3>
        <p className="text-sm text-slate-500 mb-4">
          Create a price book to establish your pricing structure
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Price Books List */}
      <div className="grid gap-4">
        {priceBooks.map((priceBook) => (
          <div
            key={priceBook.id}
            className={`
              border rounded-lg p-5 cursor-pointer transition-all
              ${priceBook.isActive 
                ? 'border-emerald-200 bg-emerald-50/30 shadow-sm' 
                : 'border-slate-200 hover:border-slate-300'
              }
            `}
            onClick={() => setSelectedPriceBook(priceBook)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-900">{priceBook.name}</h3>
                  {priceBook.isActive && (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {priceBook.currency}
                  </Badge>
                </div>
                
                {priceBook.description && (
                  <p className="text-sm text-slate-600">{priceBook.description}</p>
                )}
                
                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <CalendarBlank className="h-3 w-3" />
                    Effective from {formatDate(priceBook.effectiveFrom)}
                    {priceBook.effectiveTo && ` until ${formatDate(priceBook.effectiveTo)}`}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {priceBook.isOrganisationWide 
                      ? 'Organisation-wide' 
                      : `${priceBook.locationIds.length} location(s)`
                    }
                  </div>
                  <div className="flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    {priceBook.entries.length} price entries
                  </div>
                </div>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPriceBook(priceBook);
                }}
              >
                View Details
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Price Book Detail Dialog */}
      <Dialog open={!!selectedPriceBook} onOpenChange={() => setSelectedPriceBook(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedPriceBook?.name}
              {selectedPriceBook?.isActive && (
                <Badge className="bg-emerald-500 hover:bg-emerald-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedPriceBook?.description}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPriceBook && (
            <div className="space-y-6">
              {/* Price Book Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg text-sm">
                <div>
                  <p className="text-slate-500 mb-1">Currency</p>
                  <p className="font-medium">{selectedPriceBook.currency}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Scope</p>
                  <p className="font-medium">
                    {selectedPriceBook.isOrganisationWide 
                      ? 'Organisation-wide' 
                      : `${selectedPriceBook.locationIds.length} specific locations`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Effective From</p>
                  <p className="font-medium">{formatDate(selectedPriceBook.effectiveFrom)}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Effective To</p>
                  <p className="font-medium">
                    {selectedPriceBook.effectiveTo ? formatDate(selectedPriceBook.effectiveTo) : 'No end date'}
                  </p>
                </div>
              </div>

              {/* Price Entries Table */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Price Entries ({selectedPriceBook.entries.length})</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Service</th>
                        <th className="text-left px-4 py-3 font-medium">Frequency Tier</th>
                        <th className="text-right px-4 py-3 font-medium">Base Price</th>
                        <th className="text-left px-4 py-3 font-medium">Unit</th>
                        <th className="text-right px-4 py-3 font-medium">Tax Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPriceBook.entries.map((entry) => {
                        const service = services.find(s => s.id === entry.serviceId);
                        const tier = service?.frequencyTiers?.find(t => t.id === entry.frequencyTierId);
                        
                        return (
                          <tr key={entry.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-slate-900">{service?.name || 'Unknown Service'}</p>
                                {(service as any)?.displayName && (
                                  <p className="text-xs text-slate-500">({(service as any).displayName})</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {tier ? tier.label : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {formatCurrency(entry.basePrice, selectedPriceBook.currency)}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {entry.unit.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">
                              {(entry.taxRate * 100).toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}