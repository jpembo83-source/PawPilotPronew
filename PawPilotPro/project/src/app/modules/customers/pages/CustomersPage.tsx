// Customer Management System
// Modern Customer Master Database with comprehensive household management

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MagnifyingGlass, Plus, DownloadSimple, UploadSimple, Warning, Star, CurrencyDollar, FileDashed, MapPin, ArrowClockwise } from '@phosphor-icons/react';
import { useCustomerStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import type { CustomerFilters } from '../types';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { supabase } from '../../../../utils/supabase/client';

export function CustomersPage() {
  const navigate = useNavigate();
  const {
    households,
    isLoading,
    error,
    filters,
    fetchHouseholds,
    setFilters,
    clearFilters,
    reset,
  } = useCustomerStore();
  
  const { organisation, locations, fetchLocations } = useSettingsStore();
  
  const [searchInput, setSearchInput] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  useEffect(() => {
    fetchHouseholds().catch((err) => {
      toast.error('Failed to load customers');
      console.error(err);
    });
    fetchLocations(); // Fetch locations for display
  }, []);
  
  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput });
    fetchHouseholds({ ...filters, search: searchInput });
  };
  
  const handleFilterChange = (key: keyof CustomerFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchHouseholds(newFilters);
  };
  
  const handleClearFilters = () => {
    clearFilters();
    setSearchInput('');
    fetchHouseholds({});
  };
  
  const handleRowClick = (householdId: string) => {
    navigate(`/customers/${householdId}`);
  };
  
  const handleNewHousehold = () => {
    navigate('/customers/new');
  };
  
  const handleClearCache = async () => {
    setIsRefreshing(true);
    try {
      // Clear all cached data
      reset();
      clearFilters();
      setSearchInput('');
      
      // Fetch fresh data from server
      await fetchHouseholds({});
      
      toast.success('Cache cleared and data refreshed successfully');
    } catch (error: any) {
      console.error('Failed to refresh data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;
  
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
            <p className="text-sm text-slate-500 mt-1">
              {households.length} {households.length === 1 ? 'household' : 'households'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/customers/bulk-import')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
            >
              <UploadSimple className="w-4 h-4" />
              Bulk Import
            </button>
            <button
              onClick={() => navigate('/customers/export')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"
            >
              <DownloadSimple className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={handleNewHousehold}
              style={{
                backgroundColor: organisation.primaryColor || '#BA7E74',
              }}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center gap-2 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              New Household
            </button>
            <button
              onClick={handleClearCache}
              disabled={isRefreshing || isLoading}
              className={`px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 ${
                (isRefreshing || isLoading) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <ArrowClockwise className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>
        </div>
        
        {/* MagnifyingGlass and Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by household name, contact, email, phone, or pet name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={handleSearch}
            style={{
              backgroundColor: organisation.primaryColor || '#BA7E74',
            }}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Search
          </button>
          
          {activeFiltersCount > 0 && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Clear Filters ({activeFiltersCount})
            </button>
          )}
        </div>
        
        {/* Filter Pills */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <select
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          
          <button
            onClick={() => handleFilterChange('vip', filters.vip ? undefined : true)}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 ${
              filters.vip
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            VIP Only
          </button>
          
          <button
            onClick={() => handleFilterChange('payment_hold', filters.payment_hold ? undefined : true)}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 ${
              filters.payment_hold
                ? 'bg-red-100 text-red-800 border border-red-300'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <CurrencyDollar className="w-3.5 h-3.5" />
            Payment Hold
          </button>
        </div>
      </div>
      
      {/* Table */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <Warning className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">Error loading customers</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div 
                className="inline-block w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                style={{
                  borderColor: organisation.primaryColor || '#BA7E74',
                  borderTopColor: 'transparent',
                }}
              ></div>
              <p className="text-sm text-slate-500 mt-3">Loading customers...</p>
            </div>
          </div>
        ) : households.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <MagnifyingGlass className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-900">No customers found</p>
            <p className="text-sm text-slate-500 mt-1 max-w-md">
              {activeFiltersCount > 0
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first household'}
            </p>
            {activeFiltersCount === 0 && (
              <button
                onClick={handleNewHousehold}
                style={{
                  backgroundColor: organisation.primaryColor || '#BA7E74',
                }}
                className="mt-4 px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 flex items-center gap-2 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                New Household
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white m-6 rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Household
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Primary Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Pets
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Alerts
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {households
                  .filter(household => household && household.id) // Filter out any invalid households
                  .map((household) => {
                  // Debug: Log household details to console
                  console.log('Household in list:', {
                    id: household.id,
                    name: household.name,
                    idLength: household.id?.length,
                    idStartsWith: household.id?.substring(0, 3)
                  });
                  
                  return (
                    <tr
                      key={household.id}
                      onClick={() => handleRowClick(household.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-900">{household.name || 'Unnamed Household'}</div>
                          {household.id && (
                            <span className="text-xs text-slate-400 font-mono">
                              ({household.id.split('-').pop()?.substring(0, 6)})
                            </span>
                          )}
                          {household.vip && (
                            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {household.primary_contact ? (
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {household.primary_contact.first_name} {household.primary_contact.last_name}
                            </div>
                            <div className="text-sm text-slate-500">{household.primary_contact.email}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">No primary contact</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-900">{household.pets_count || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {household.primary_location_id ? (
                          <div className="flex items-center gap-1.5 text-sm text-slate-600">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>
                              {locations.find(loc => loc.id === household.primary_location_id)?.name || 'Location'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            household.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {household.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {household.payment_hold && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                              <CurrencyDollar className="w-3 h-3" />
                              Payment Hold
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}