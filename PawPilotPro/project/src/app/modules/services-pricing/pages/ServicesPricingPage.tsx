import React, { useState, useEffect } from 'react';
import { Package, DollarSign, Users, MapPin, Receipt, CheckSquare } from 'lucide-react';
import { useServicesPricingStore } from '../store';
import { ServicesTab } from './tabs/ServicesTab';

type TabId = 'services' | 'price-books' | 'memberships' | 'location-pricing' | 'fees-discounts' | 'approvals';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ElementType;
}

const TABS: Tab[] = [
  { id: 'services', label: 'Services', icon: Package },
  { id: 'price-books', label: 'Price Books', icon: DollarSign },
  { id: 'memberships', label: 'Memberships & Packages', icon: Users },
  { id: 'location-pricing', label: 'Location Pricing', icon: MapPin },
  { id: 'fees-discounts', label: 'Discounts & Fees', icon: Receipt },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare },
];

export function ServicesPricingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('services');
  const { 
    fetchServices, 
    fetchPriceBooks, 
    fetchMembershipPlans,
    fetchLocationOverrides,
    fetchMultiDogRules,
    fetchFeeRules,
    fetchDiscountRules,
    services,
    priceBooks,
    membershipPlans,
  } = useServicesPricingStore();

  useEffect(() => {
    // Fetch all data on mount
    fetchServices();
    fetchPriceBooks();
    fetchMembershipPlans();
    fetchLocationOverrides();
    fetchMultiDogRules();
    fetchFeeRules();
    fetchDiscountRules();
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'services':
        return <ServicesTab />;
      default:
        return null;
    }
  };

  const getDataSummary = () => {
    return {
      services: services.length,
      priceBooks: priceBooks.length,
      memberships: membershipPlans.length,
    };
  };

  const summary = getDataSummary();
  const hasData = summary.services > 0 || summary.priceBooks > 0 || summary.memberships > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Services & Pricing</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage service catalogue, price books, memberships, and location-specific pricing
          </p>
        </div>
      </div>

      {/* Data Summary Cards */}
      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
                <Package className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{summary.services}</p>
                <p className="text-xs text-slate-500">Services</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{summary.priceBooks}</p>
                <p className="text-xs text-slate-500">Price Books</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{summary.memberships}</p>
                <p className="text-xs text-slate-500">Memberships</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50/50">
          <nav className="flex -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                    ${isActive
                      ? 'border-primary text-primary bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}