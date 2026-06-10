import React, { useState, useEffect } from 'react';
import { MapPin, CurrencyDollar } from '@phosphor-icons/react';
import { useServicesPricingStore } from '../../store';
import { useSettingsStore } from '../../../settings/store';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { useAuth } from '../../../../context/AuthContext';

export function LocationPricingTab() {
  const { locations, fetchLocations } = useSettingsStore();
  const { services, activePriceBook, locationOverrides, fetchLocationOverrides } = useServicesPricingStore();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch when user is authenticated and not loading
    if (!isAuthLoading && user) {
      fetchLocations();
      fetchLocationOverrides();
    }
  }, [isAuthLoading, user]);

  useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locations[0].id);
    }
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No locations configured</h3>
        <p className="text-sm text-slate-500 mb-4">
          Create locations in Settings → Locations to configure location-specific pricing
        </p>
      </div>
    );
  }

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  
  if (!activePriceBook) {
    return (
      <div className="text-center py-12">
        <CurrencyDollar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No active price book</h3>
        <p className="text-sm text-slate-500 mb-4">
          Activate a price book to configure location pricing
        </p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: activePriceBook.currency || 'CHF',
    }).format(amount);
  };

  // Get overrides for selected location
  const locationSpecificOverrides = locationOverrides.filter(
    o => o.locationId === selectedLocationId
  );

  return (
    <div className="space-y-6">
      {/* Location Selector */}
      <div className="flex flex-wrap gap-2">
        {locations.map((location) => (
          <Button
            key={location.id}
            variant={selectedLocationId === location.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedLocationId(location.id)}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {location.name}
          </Button>
        ))}
      </div>

      {/* Selected Location Info */}
      {selectedLocation && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">{selectedLocation.name}</h3>
              <p className="text-sm text-slate-600">{selectedLocation.address}</p>
            </div>
            <Badge variant="outline">
              {locationSpecificOverrides.length} override{locationSpecificOverrides.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      )}

      {/* Pricing Table */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-900">Service Pricing</h3>
          <p className="text-sm text-slate-500">
            Showing prices from: <span className="font-medium">{activePriceBook.name}</span>
          </p>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Service</th>
                <th className="text-left px-4 py-3 font-medium">Frequency Tier</th>
                <th className="text-right px-4 py-3 font-medium">Base Price</th>
                <th className="text-right px-4 py-3 font-medium">Location Price</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activePriceBook.entries.map((entry) => {
                const service = services.find(s => s.id === entry.serviceId);
                const tier = service?.frequencyTiers?.find(t => t.id === entry.frequencyTierId);
                const override = locationSpecificOverrides.find(
                  o => o.serviceId === entry.serviceId && 
                       ((!o.frequencyTierId && !entry.frequencyTierId) ||
                        o.frequencyTierId === entry.frequencyTierId)
                );
                
                const effectivePrice = override ? override.overridePrice : entry.basePrice;
                const hasOverride = !!override;
                
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
                    <td className="px-4 py-3 text-right">
                      <span className={hasOverride ? 'line-through text-slate-400' : 'font-medium text-slate-900'}>
                        {formatCurrency(entry.basePrice)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasOverride ? (
                        <span className="font-medium text-emerald-600">
                          {formatCurrency(effectivePrice)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {hasOverride ? (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200">
                          Overridden
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-slate-500">
                          Inherited
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <MapPin className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-1">Location Pricing Overrides</p>
            <p className="text-blue-700">
              Location-specific prices override the base price book. All changes are audited with timestamps and user information. 
              Only users with appropriate permissions can create or modify location overrides.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}