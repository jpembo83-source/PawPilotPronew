// Incidents List Page
// View and filter all incidents

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useIncidentsStore } from '../store';
import { useAuth } from '../../../context/AuthContext';
import { useDashboardStore } from '../../dashboard/store';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { AlertCircle, Plus, Search, Filter, Download, Eye, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { CreateIncidentModal } from '../components/CreateIncidentModal';
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INCIDENT_MODULES,
} from '../types';
import type { Incident, IncidentFilters } from '../types';

export function IncidentsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const {
    incidents,
    stats,
    filters,
    isLoading,
    error,
    fetchIncidents,
    fetchStats,
    setFilters,
    clearFilters,
    exportIncidents,
    clearError,
  } = useIncidentsStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [selectedLocationId]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);

  const loadData = async () => {
    try {
      await fetchIncidents();
      await fetchStats(selectedLocationId === 'ALL' ? undefined : selectedLocationId);
    } catch (err) {
      // Error handled by store
    }
  };

  const handleSearch = () => {
    setFilters({ ...filters, search: searchQuery });
    fetchIncidents();
  };

  const handleFilterChange = (key: keyof IncidentFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    fetchIncidents(newFilters);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    clearFilters();
    fetchIncidents({});
  };

  const handleExport = async () => {
    try {
      const data = await exportIncidents();
      
      // Convert to CSV
      const headers = [
        'ID',
        'Date',
        'Location',
        'Module',
        'Category',
        'Severity',
        'Status',
        'Summary',
        'Pet',
        'Household',
        'Created By',
        'Assigned To',
      ];
      
      const rows = data.map(i => [
        i.id,
        new Date(i.occurred_at).toLocaleString('en-GB'),
        i.location_name,
        INCIDENT_MODULES[i.module],
        INCIDENT_CATEGORIES[i.category],
        INCIDENT_SEVERITIES[i.severity].label,
        INCIDENT_STATUSES[i.status].label,
        i.summary,
        i.pet_name || '',
        i.household_name || '',
        i.created_by_name,
        i.assigned_to_name || '',
      ]);
      
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `incidents-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Incidents exported successfully');
    } catch (err) {
      // Error handled by store
    }
  };

  const handleViewIncident = (incident: Incident) => {
    navigate(`/incidents/${incident.id}`);
  };

  const canCreate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'staff' || user?.role === 'driver' || user?.role === 'night_shift';
  const canExport = user?.role === 'admin' || user?.role === 'manager';

  const activeFiltersCount = Object.values(filters).filter(v => v !== undefined && v !== '').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Incidents</h1>
          <p className="text-slate-600 mt-1">Report and manage operational incidents</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <Button variant="outline" onClick={handleExport} disabled={isLoading || incidents.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Report Incident
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Incidents</CardDescription>
              <CardTitle className="text-2xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open</CardDescription>
              <CardTitle className="text-2xl">{stats.open}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-orange-900">High/Critical</CardDescription>
              <CardTitle className="text-2xl text-orange-900">{stats.high_critical}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardDescription className="text-red-900">Overdue</CardDescription>
              <CardTitle className="text-2xl text-red-900">{stats.overdue}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Assigned to Me</CardDescription>
              <CardTitle className="text-2xl">{stats.assigned_to_me}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear all ({activeFiltersCount})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search incidents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch}>Search</Button>
              </div>
            </div>

            {/* Module */}
            <Select
              value={filters.module || 'all'}
              onValueChange={(value) => handleFilterChange('module', value === 'all' ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {Object.entries(INCIDENT_MODULES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Severity */}
            <Select
              value={filters.severity || 'all'}
              onValueChange={(value) => handleFilterChange('severity', value === 'all' ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {Object.entries(INCIDENT_SEVERITIES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(INCIDENT_STATUSES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category */}
            <Select
              value={filters.assigned_to_me ? 'assigned' : filters.open_only ? 'open' : 'all'}
              onValueChange={(value) => {
                if (value === 'assigned') {
                  handleFilterChange('assigned_to_me', true);
                  handleFilterChange('open_only', undefined);
                } else if (value === 'open') {
                  handleFilterChange('open_only', true);
                  handleFilterChange('assigned_to_me', undefined);
                } else {
                  handleFilterChange('assigned_to_me', undefined);
                  handleFilterChange('open_only', undefined);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Incidents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Incidents</SelectItem>
                <SelectItem value="assigned">Assigned to Me</SelectItem>
                <SelectItem value="open">Open Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Incidents ({incidents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading incidents...</div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No incidents found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Pet/Household</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => (
                    <TableRow
                      key={incident.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => handleViewIncident(incident)}
                    >
                      <TableCell className="font-mono text-sm">{incident.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">
                        {new Date(incident.occurred_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${INCIDENT_SEVERITIES[incident.severity].bgColor} ${INCIDENT_SEVERITIES[incident.severity].color} border-0`}>
                          {INCIDENT_SEVERITIES[incident.severity].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${INCIDENT_STATUSES[incident.status].bgColor} ${INCIDENT_STATUSES[incident.status].color} border-0`}>
                          {INCIDENT_STATUSES[incident.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{INCIDENT_CATEGORIES[incident.category]}</TableCell>
                      <TableCell className="max-w-xs truncate">{incident.summary}</TableCell>
                      <TableCell className="text-sm">
                        {incident.pet_name && (
                          <div>{incident.pet_name}</div>
                        )}
                        {incident.household_name && (
                          <div className="text-slate-500">{incident.household_name}</div>
                        )}
                        {!incident.pet_name && !incident.household_name && (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{incident.location_name}</TableCell>
                      <TableCell className="text-sm">{incident.assigned_to_name || <span className="text-slate-400">Unassigned</span>}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewIncident(incident);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Incident Modal */}
      <CreateIncidentModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadData();
        }}
      />
    </div>
  );
}