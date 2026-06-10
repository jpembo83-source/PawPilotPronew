import React, { useState } from 'react';
import { Plus, MagnifyingGlass, Package, Clock, UsersThree as UsersIcon, Power } from '@phosphor-icons/react';
import { useServicesPricingStore } from '../../store';
import { Service, ModuleType } from '../../types';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';

const MODULE_LABELS: Record<ModuleType, string> = {
  daycare: 'Daycare',
  grooming: 'Grooming/Spa',
  boutique: 'Boutique',
  transport: 'Transportation',
};

const MODULE_COLORS: Record<ModuleType, string> = {
  daycare: 'bg-blue-50 text-blue-700 border-blue-200',
  grooming: 'bg-purple-50 text-purple-700 border-purple-200',
  boutique: 'bg-pink-50 text-pink-700 border-pink-200',
  transport: 'bg-green-50 text-green-700 border-green-200',
};

export function ServicesTab() {
  const { services, toggleServiceStatus } = useServicesPricingStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState<ModuleType | 'all'>('all');

  // Group services by module
  const groupedServices = services.reduce((acc, service) => {
    if (!acc[service.module]) {
      acc[service.module] = [];
    }
    acc[service.module].push(service);
    return acc;
  }, {} as Record<ModuleType, Service[]>);

  // Filter services
  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule = moduleFilter === 'all' || service.module === moduleFilter;
    return matchesSearch && matchesModule;
  });

  const filteredGrouped = filteredServices.reduce((acc, service) => {
    if (!acc[service.module]) {
      acc[service.module] = [];
    }
    acc[service.module].push(service);
    return acc;
  }, {} as Record<ModuleType, Service[]>);

  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">No services yet</h3>
        <p className="text-sm text-slate-500 mb-4">
          Create your first service to begin building your service catalogue
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <Button
            variant={moduleFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setModuleFilter('all')}
          >
            All Modules
          </Button>
          {Object.entries(MODULE_LABELS).map(([module, label]) => (
            <Button
              key={module}
              variant={moduleFilter === module ? 'default' : 'outline'}
              size="sm"
              onClick={() => setModuleFilter(module as ModuleType)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Services grouped by module */}
      <div className="space-y-6">
        {Object.entries(filteredGrouped).map(([module, moduleServices]) => (
          <div key={module} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900">{MODULE_LABELS[module as ModuleType]}</h3>
              <Badge variant="outline" className="text-xs">
                {moduleServices.length} {moduleServices.length === 1 ? 'service' : 'services'}
              </Badge>
            </div>
            
            <div className="grid gap-3">
              {moduleServices.map((service) => (
                <div
                  key={service.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium text-slate-900">
                          {service.name}
                          {(service as any).displayName && (
                            <span className="text-sm text-slate-500 ml-2">
                              ({(service as any).displayName})
                            </span>
                          )}
                        </h4>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${MODULE_COLORS[service.module]}`}>
                          {MODULE_LABELS[service.module]}
                        </span>
                        {!service.isActive && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      
                      {service.description && (
                        <p className="text-sm text-slate-600">{service.description}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        {service.durationMinutes && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {service.durationMinutes} min
                            {service.bufferMinutes && ` (+${service.bufferMinutes} buffer)`}
                          </div>
                        )}
                        {service.capacityImpact && (
                          <div className="flex items-center gap-1">
                            <UsersIcon className="h-3 w-3" />
                            Capacity: {service.capacityImpact}
                          </div>
                        )}
                        {service.frequencyTiers && service.frequencyTiers.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {service.frequencyTiers.length} frequency tiers
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleServiceStatus(service.id)}
                        className={service.isActive ? 'text-emerald-600' : 'text-slate-400'}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}