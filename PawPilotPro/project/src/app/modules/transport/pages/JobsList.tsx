/**
 * Transport Jobs List - Filterable view of all transport jobs
 * British English throughout, production-grade, no mock data
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTransportStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { 
  MagnifyingGlass, 
  Funnel, 
  DownloadSimple,
  CircleNotch,
  Warning,
  Plus,
  CaretDown,
  X
} from '@phosphor-icons/react';
import { format, subDays, addDays } from 'date-fns';
import type { TransportJobWithDetails } from '../types';

export function JobsList() {
  const navigate = useNavigate();
  const { jobs, isLoading, error, fetchJobs } = useTransportStore();
  const { locations } = useSettingsStore();
  
  // Filters
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Fetch data
  useEffect(() => {
    fetchJobs({
      location_id: locationFilter || undefined
    });
  }, [fetchJobs]);
  
  // Funnel jobs client-side
  const filteredJobs = jobs.filter(job => {
    // Date range
    const jobDate = new Date(job.service_date);
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    if (jobDate < fromDate || jobDate > toDate) return false;
    
    // Location
    if (locationFilter && job.location_id !== locationFilter) return false;
    
    // Status
    if (statusFilter && job.status !== statusFilter) return false;
    
    // Direction
    if (directionFilter && job.direction !== directionFilter) return false;
    
    // MagnifyingGlass
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesPet = job.pet_name.toLowerCase().includes(query);
      const matchesHousehold = job.household_name.toLowerCase().includes(query);
      const matchesAddress = 
        job.address_pickup?.toLowerCase().includes(query) ||
        job.address_dropoff?.toLowerCase().includes(query);
      if (!matchesPet && !matchesHousehold && !matchesAddress) return false;
    }
    
    return true;
  });
  
  const activeFilterCount = [
    locationFilter,
    statusFilter,
    directionFilter
  ].filter(Boolean).length;
  
  const clearFilters = () => {
    setLocationFilter('');
    setStatusFilter('');
    setDirectionFilter('');
    setSearchQuery('');
  };
  
  return (
    <div className="h-[calc(100vh-100px)] flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Transport Jobs</h2>
            <p className="text-slate-500 mt-1">View and manage all transport jobs</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Funnel className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
              )}
            </Button>
            <Button onClick={() => navigate('/transport/jobs/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Job
            </Button>
          </div>
        </div>
        
        {/* MagnifyingGlass */}
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by pet, household, or address..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-slate-200 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Date Range */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white"
                />
              </div>
              
              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Location</label>
                <select
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white"
                >
                  <option value="">All Locations</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              
              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              {/* Direction */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Direction</label>
                <select
                  value={directionFilter}
                  onChange={e => setDirectionFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white"
                >
                  <option value="">All Directions</option>
                  <option value="pickup">Pick-up</option>
                  <option value="dropoff">Drop-off</option>
                  <option value="roundtrip">Round Trip</option>
                </select>
              </div>
            </div>
            
            {activeFilterCount > 0 && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <Warning className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-900">Error Loading Jobs</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}
      
      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <CircleNotch className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
            <p className="text-slate-500">Loading jobs...</p>
          </div>
        </div>
      )}
      
      {/* Results */}
      {!isLoading && !error && (
        <div className="flex-1 overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
          {/* Results Header */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between sticky top-0">
            <div className="text-sm text-slate-600">
              {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} found
            </div>
          </div>
          
          {filteredJobs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-slate-500">No jobs match your filters</p>
                {activeFilterCount > 0 && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Clear filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider sticky top-12">
                <div className="col-span-1">Date</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-2">Pet & Household</div>
                <div className="col-span-1">Direction</div>
                <div className="col-span-3">Address</div>
                <div className="col-span-2">Driver/Vehicle</div>
                <div className="col-span-1">Time</div>
                <div className="col-span-1">Actions</div>
              </div>
              
              {/* Jobs */}
              {filteredJobs.map(job => (
                <JobRow 
                  key={job.id} 
                  job={job}
                  onClick={() => navigate(`/transport/jobs/${job.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Job Row Component
function JobRow({ job, onClick }: { job: TransportJobWithDetails; onClick: () => void }) {
  const statusColors = {
    scheduled: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-green-100 text-green-700',
    completed: 'bg-teal-100 text-teal-700',
    cancelled: 'bg-red-100 text-red-700'
  };
  
  const directionColors = {
    pickup: 'text-green-600 bg-green-50',
    dropoff: 'text-orange-600 bg-orange-50',
    roundtrip: 'text-blue-600 bg-blue-50'
  };
  
  const address = job.direction === 'pickup' 
    ? job.address_pickup 
    : job.direction === 'dropoff'
    ? job.address_dropoff
    : `${job.address_pickup} → ${job.address_dropoff}`;
  
  return (
    <div 
      onClick={onClick}
      className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
    >
      <div className="col-span-1">
        <div className="text-sm text-slate-900 font-medium">
          {format(new Date(job.service_date), 'MMM d')}
        </div>
        <div className="text-xs text-slate-500">
          {format(new Date(job.service_date), 'yyyy')}
        </div>
      </div>
      
      <div className="col-span-1">
        <Badge className={statusColors[job.status]} variant="secondary">
          {job.status.replace('_', ' ')}
        </Badge>
      </div>
      
      <div className="col-span-2">
        <div className="font-medium text-slate-900">{job.pet_name}</div>
        <div className="text-sm text-slate-500">{job.household_name}</div>
      </div>
      
      <div className="col-span-1">
        <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${directionColors[job.direction]}`}>
          {job.direction === 'roundtrip' ? 'round trip' : job.direction}
        </div>
      </div>
      
      <div className="col-span-3">
        <div className="text-sm text-slate-600 line-clamp-2">{address}</div>
      </div>
      
      <div className="col-span-2">
        {job.assigned_driver_user_id ? (
          <div className="text-sm text-slate-600">
            {job.vehicle_name || 'Assigned'}
          </div>
        ) : (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            Unassigned
          </Badge>
        )}
      </div>
      
      <div className="col-span-1">
        {job.time_window_start ? (
          <div className="text-sm text-slate-600">
            {job.time_window_start}
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </div>
      
      <div className="col-span-1">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          View
        </Button>
      </div>
    </div>
  );
}
