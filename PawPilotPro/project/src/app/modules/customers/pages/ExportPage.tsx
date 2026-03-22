// Export Page
// Export customer data to Excel

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Download, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { useCustomerStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import type { CustomerFilters } from '../types';

export function ExportPage() {
  const navigate = useNavigate();
  const { user, activeTenantId } = useAuth();
  const { filters } = useCustomerStore();
  
  const [isExporting, setIsExporting] = useState(false);
  const [exportFilters, setExportFilters] = useState<CustomerFilters>({ ...filters });
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeContacts, setIncludeContacts] = useState(true);
  const [includePets, setIncludePets] = useState(true);
  const [includeDocuments, setIncludeDocuments] = useState(false);
  
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const queryParams = new URLSearchParams();
      
      // Add filters
      if (exportFilters.search) queryParams.set('search', exportFilters.search);
      if (exportFilters.status) queryParams.set('status', exportFilters.status);
      if (exportFilters.location) queryParams.set('location', exportFilters.location);
      if (exportFilters.vip !== undefined) queryParams.set('vip', exportFilters.vip.toString());
      if (exportFilters.paymentHold !== undefined) queryParams.set('paymentHold', exportFilters.paymentHold.toString());
      if (exportFilters.documentAlerts !== undefined) queryParams.set('documentAlerts', exportFilters.documentAlerts.toString());
      
      // Add export options
      queryParams.set('includeInactive', includeInactive.toString());
      queryParams.set('includeContacts', includeContacts.toString());
      queryParams.set('includePets', includePets.toString());
      queryParams.set('includeDocuments', includeDocuments.toString());
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/export?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-User-Token': `Bearer ${user?.access_token}`,
            'X-Tenant-Id': activeTenantId || '',
          },
        }
      );
      
      if (!response.ok) {
        // Try to parse error as JSON, but handle non-JSON responses
        let errorMessage = 'Export failed';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || error.message || 'Export failed';
          } else {
            const text = await response.text();
            errorMessage = text.substring(0, 100) || `Export failed (${response.status})`;
          }
        } catch {
          errorMessage = `Export failed (${response.status})`;
        }
        throw new Error(errorMessage);
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `customers-export-${timestamp}.xlsx`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Export completed successfully');
    } catch (error: any) {
      toast.error(error.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/customers')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        
        <h1 className="text-3xl font-bold text-slate-900">Export Customers</h1>
        <p className="text-slate-600 mt-2">
          Download customer data as an Excel spreadsheet
        </p>
      </div>
      
      {/* Export Options */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* What to Include */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Data to Include</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeContacts}
                  onChange={(e) => setIncludeContacts(e.target.checked)}
                  className="w-4 h-4 border-slate-300 rounded text-blue-600 focus:ring-blue-500"
                />
                Include contact information
              </label>
              
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includePets}
                  onChange={(e) => setIncludePets(e.target.checked)}
                  className="w-4 h-4 border-slate-300 rounded text-blue-600 focus:ring-blue-500"
                />
                Include pet profiles
              </label>
              
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeDocuments}
                  onChange={(e) => setIncludeDocuments(e.target.checked)}
                  className="w-4 h-4 border-slate-300 rounded text-blue-600 focus:ring-blue-500"
                />
                Include document status
              </label>
              
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  className="w-4 h-4 border-slate-300 rounded text-blue-600 focus:ring-blue-500"
                />
                Include inactive households
              </label>
            </div>
          </div>
          
          {/* Filters */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Filters</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={exportFilters.search || ''}
                  onChange={(e) => setExportFilters({ ...exportFilters, search: e.target.value })}
                  placeholder="Filter by name, email, or phone"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={exportFilters.status || ''}
                  onChange={(e) => setExportFilters({ ...exportFilters, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location
                </label>
                <select
                  value={exportFilters.location || ''}
                  onChange={(e) => setExportFilters({ ...exportFilters, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">All locations</option>
                  <option value="loc_main">Main Facility</option>
                  <option value="loc_north">North Branch</option>
                  <option value="loc_south">South Branch</option>
                </select>
              </div>
              
              {/* VIP */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  VIP Status
                </label>
                <select
                  value={exportFilters.vip === undefined ? '' : exportFilters.vip.toString()}
                  onChange={(e) => setExportFilters({ 
                    ...exportFilters, 
                    vip: e.target.value === '' ? undefined : e.target.value === 'true' 
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">All customers</option>
                  <option value="true">VIP only</option>
                  <option value="false">Non-VIP only</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Info Card */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Export Format</p>
              <p>
                The export will include multiple sheets for households, contacts, and pets. 
                You can re-import this file after making changes using the Bulk Import feature.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Export Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </>
          )}
        </Button>
      </div>
    </div>
  );
}