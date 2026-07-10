// Export Page
// Export customer data to Excel

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, DownloadSimple, CircleNotch, CalendarBlank } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { useCustomerStore } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import * as XLSX from 'xlsx';
import type { CustomerFilters } from '../types';

import { useBackNavigation } from '../../../components/BackButton';
const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers`;

export function ExportPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/customers');
  const { activeTenantId } = useAuth();
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
      const authHeaders = await getAuthHeaders();
      
      // Fetch all households
      const params = new URLSearchParams();
      if (exportFilters.search) params.set('search', exportFilters.search);
      if (exportFilters.status) params.set('status', exportFilters.status);
      if (exportFilters.location) params.set('location', exportFilters.location);
      if (exportFilters.vip !== undefined) params.set('vip', exportFilters.vip.toString());
      if (exportFilters.paymentHold !== undefined) params.set('paymentHold', exportFilters.paymentHold.toString());
      if (!includeInactive) params.set('status', exportFilters.status || 'active');
      
      const hhUrl = params.toString() ? `${BASE_URL}/households?${params}` : `${BASE_URL}/households`;
      const hhRes = await fetch(hhUrl, { headers: authHeaders });
      if (!hhRes.ok) {
        const err = await hhRes.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch households (${hhRes.status})`);
      }
      const households: any[] = await hhRes.json();
      
      // Build household rows
      const householdRows = households.map((h: any) => ({
        'Household ID': h.id,
        'Household Name': h.household_name || h.name || '',
        'Status': h.status || '',
        'Location': h.location || '',
        'VIP': h.is_vip ? 'Yes' : 'No',
        'Payment Hold': h.payment_hold ? 'Yes' : 'No',
        'Primary Contact': h.primary_contact_name || '',
        'Primary Email': h.primary_contact_email || '',
        'Primary Phone': h.primary_contact_phone || '',
        'Created': h.created_at ? new Date(h.created_at).toISOString().split('T')[0] : '',
      }));
      
      const contactRows: any[] = [];
      const petRows: any[] = [];
      
      // Fetch contacts and pets per household
      for (const h of households) {
        const householdName = h.household_name || h.name || '';
        
        if (includeContacts) {
          const cRes = await fetch(`${BASE_URL}/households/${h.id}/contacts`, { headers: authHeaders });
          if (cRes.ok) {
            const contacts: any[] = await cRes.json();
            contacts.forEach((c: any) => {
              if (!c.deleted_at) {
                contactRows.push({
                  'Contact ID': c.id,
                  'Household ID': h.id,
                  'Household Name': householdName,
                  'First Name': c.first_name || '',
                  'Last Name': c.last_name || '',
                  'Email': c.email || '',
                  'Phone': c.phone || '',
                  'Type': c.contact_type || '',
                  'Relationship': c.relationship || '',
                  'Primary': c.is_primary ? 'Yes' : 'No',
                  'Emergency': c.is_emergency ? 'Yes' : 'No',
                  'Billing': c.is_billing ? 'Yes' : 'No',
                });
              }
            });
          }
        }
        
        if (includePets) {
          const pRes = await fetch(`${BASE_URL}/households/${h.id}/pets`, { headers: authHeaders });
          if (pRes.ok) {
            const pets: any[] = await pRes.json();
            pets.forEach((p: any) => {
              if (!p.deleted_at) {
                petRows.push({
                  'Pet ID': p.id,
                  'Household ID': h.id,
                  'Household Name': householdName,
                  'Name': p.name || '',
                  'Species': p.species || '',
                  'Breed': p.breed || '',
                  'Sex': p.sex || '',
                  'Date of Birth': p.date_of_birth || '',
                  'Age (years)': p.age_years || '',
                  'Weight (lbs)': p.weight_lbs || '',
                  'Colour': p.colour || '',
                  'Microchip': p.microchip || '',
                  'Spayed/Neutered': p.spayed_neutered ? 'Yes' : 'No',
                  'Medical Conditions': Array.isArray(p.medical_conditions) ? p.medical_conditions.join(', ') : (p.medical_conditions || ''),
                  'Behaviour Notes': p.behaviour_notes || '',
                  'Active': p.is_active !== false ? 'Yes' : 'No',
                });
              }
            });
          }
        }
      }
      
      // Build XLSX workbook
      const wb = XLSX.utils.book_new();
      
      const hhSheet = XLSX.utils.json_to_sheet(householdRows.length > 0 ? householdRows : [{}]);
      XLSX.utils.book_append_sheet(wb, hhSheet, 'Households');
      
      if (includeContacts) {
        const cSheet = XLSX.utils.json_to_sheet(contactRows.length > 0 ? contactRows : [{}]);
        XLSX.utils.book_append_sheet(wb, cSheet, 'Contacts');
      }
      
      if (includePets) {
        const pSheet = XLSX.utils.json_to_sheet(petRows.length > 0 ? petRows : [{}]);
        XLSX.utils.book_append_sheet(wb, pSheet, 'Pets');
      }
      
      // Write and download
      const exportDate = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `customers-export-${exportDate}.xlsx`);
      
      toast.success(`Exported ${householdRows.length} households successfully`);
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
          onClick={goBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Customers
        </Button>
        
        <h1 className="text-3xl font-bold text-slate-900">Export Customers</h1>
        <p className="text-slate-600 mt-2">
          DownloadSimple customer data as an Excel spreadsheet
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
            <CalendarBlank className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Export Format</p>
              <p>
                The export includes separate sheets for Households, Contacts, and Pets.
                Open the file in Excel or Google Sheets.
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
              <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <DownloadSimple className="h-4 w-4 mr-2" />
              Export to Excel
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
