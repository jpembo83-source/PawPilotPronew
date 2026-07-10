// Customer Management System
// Modern Customer Master Database with comprehensive household management

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { MagnifyingGlass, Plus, DownloadSimple, UploadSimple, Warning, Star, CurrencyDollar, FileDashed, MapPin, ArrowClockwise, CaretUp, CaretDown } from '@phosphor-icons/react';
import { useCustomerStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import type { CustomerFilters, HouseholdSortKey, HouseholdSummary } from '../types';
import { ContactLink } from '../components/ContactLink';
import { toast } from 'sonner';

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
  const [sortKey, setSortKey] = useState<HouseholdSortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchHouseholds().catch((err) => {
      toast.error('Failed to load customers');
      console.error(err);
    });
    fetchLocations(); // Fetch locations for display
  }, []);

  const runSearch = (value: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const newFilters = { ...filters, search: value || undefined };
    setFilters(newFilters);
    fetchHouseholds(newFilters).catch(() => {}); // store surfaces the error state
  };

  // Debounced live search (350ms, matching CreateBookingDialog); Enter and
  // the Search button stay as immediate triggers via runSearch.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (searchInput === (filters.search ?? '')) return; // already applied (covers initial mount)

    searchDebounceRef.current = setTimeout(() => runSearch(searchInput), 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchInput]);

  const handleSearch = () => {
    runSearch(searchInput);
  };

  const handleSort = (key: HouseholdSortKey) => {
    if (sortKey === key) {
      setSortDir(dir => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
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

  // Client-side sort over the loaded set; default alphabetical by household.
  const sortedHouseholds = useMemo(() => {
    const contactName = (h: HouseholdSummary) =>
      h.primary_contact
        ? `${h.primary_contact.first_name ?? ''} ${h.primary_contact.last_name ?? ''}`.trim()
        : '';
    const sortValue = sortKey === 'primary_contact' ? contactName : (h: HouseholdSummary) => h.name ?? '';

    const rows = households.filter(household => household && household.id);
    rows.sort((a, b) => sortValue(a).localeCompare(sortValue(b), undefined, { sensitivity: 'base' }));
    if (sortDir === 'desc') rows.reverse();
    return rows;
  }, [households, sortKey, sortDir]);

  const SortIndicator = ({ column }: { column: HouseholdSortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc'
      ? <CaretUp className="w-3 h-3" aria-hidden="true" />
      : <CaretDown className="w-3 h-3" aria-hidden="true" />;
  };
  
  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
            <p className="text-sm text-slate-500 mt-1">
              {households.length} {households.length === 1 ? 'household' : 'households'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                    aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 uppercase tracking-wider hover:text-slate-700"
                    >
                      Household
                      <SortIndicator column="name" />
                    </button>
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                    aria-sort={sortKey === 'primary_contact' ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    <button
                      onClick={() => handleSort('primary_contact')}
                      className="flex items-center gap-1 uppercase tracking-wider hover:text-slate-700"
                    >
                      Primary Contact
                      <SortIndicator column="primary_contact" />
                    </button>
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
                {sortedHouseholds.map((household) => {
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
                            <div className="text-sm text-slate-500">
                              <ContactLink
                                kind="email"
                                value={household.primary_contact.email}
                                contactName={`${household.primary_contact.first_name} ${household.primary_contact.last_name}`}
                              />
                            </div>
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