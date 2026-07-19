// Export Page
// Export customer data to Excel in the SAME format as the bulk import
// template, so an exported file can be edited and re-uploaded via Bulk Import
// to make bulk changes (import matches households by name/external ID and
// updates them rather than duplicating).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, DownloadSimple, CircleNotch, CalendarBlank } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useCustomerStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import * as XLSX from 'xlsx';
import type { CustomerFilters, HouseholdFlag } from '../types';
import { IMPORT_SHEETS, toTemplateRow } from '../importFormat';
import { isPetFlagActive } from '../petFlagToggle';

import { useBackNavigation } from '../../../components/BackButton';
const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers`;

// Sheets are written with the template's canonical headers even when empty,
// so a filtered-down export still re-imports cleanly.
function appendTemplateSheet(wb: XLSX.WorkBook, sheetName: keyof typeof IMPORT_SHEETS, rows: Array<Record<string, string | number>>) {
  const headers = Object.keys(IMPORT_SHEETS[sheetName]);
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

export function ExportPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/customers');
  const { filters } = useCustomerStore();
  const { locations, fetchLocations } = useSettingsStore();

  const [isExporting, setIsExporting] = useState(false);
  const [exportFilters, setExportFilters] = useState<CustomerFilters>({ ...filters });
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeContacts, setIncludeContacts] = useState(true);
  const [includePets, setIncludePets] = useState(true);

  // Location names for the Households sheet's Location column — the import
  // resolves that column against Settings → Locations names.
  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const authHeaders = await getAuthHeaders();

      // Fetch all households
      const params = new URLSearchParams();
      if (exportFilters.search) params.set('search', exportFilters.search);
      if (!includeInactive) params.set('status', exportFilters.status || 'active');
      else if (exportFilters.status) params.set('status', exportFilters.status);

      const hhUrl = params.toString() ? `${BASE_URL}/households?${params}` : `${BASE_URL}/households`;
      const hhRes = await fetch(hhUrl, { headers: authHeaders });
      if (!hhRes.ok) {
        const err = await hhRes.json().catch(() => ({}));
        throw new Error(err.error || `Failed to fetch households (${hhRes.status})`);
      }
      let households: any[] = await hhRes.json();
      // The list endpoint only supports vip=true; filter both ways here.
      if (exportFilters.vip !== undefined) {
        households = households.filter((h: any) => (h.vip === true) === exportFilters.vip);
      }

      const locationNameById = new Map(locations.map((loc) => [loc.id, loc.name]));

      // Build household rows in the import template format
      const householdRows = households.map((h: any) =>
        toTemplateRow('Households', {
          name: h.name,
          external_id: h.external_id,
          status: h.status ?? 'active',
          vip: h.vip,
          payment_hold: h.payment_hold,
          hold_reason: h.hold_reason,
          location: h.primary_location_id ? locationNameById.get(h.primary_location_id) : undefined,
          address: h.address,
          internal_notes: h.internal_notes,
        })
      );

      const contactRows: Array<Record<string, string | number>> = [];
      const petRows: Array<Record<string, string | number>> = [];

      // Fetch contacts and pets per household
      for (const h of households) {
        const householdName = h.name || '';

        if (includeContacts) {
          const cRes = await fetch(`${BASE_URL}/households/${h.id}/contacts`, { headers: authHeaders });
          if (cRes.ok) {
            const contacts: any[] = await cRes.json();
            contacts.forEach((c: any) => {
              if (!c.deleted_at) {
                contactRows.push(toTemplateRow('Contacts', {
                  household_name: householdName,
                  first_name: c.first_name,
                  last_name: c.last_name,
                  email: c.email,
                  phone: c.phone,
                  preferred_contact_method: c.preferred_contact_method,
                  is_primary: c.is_primary,
                  is_emergency_contact: c.is_emergency_contact,
                  emergency_contact_relationship: c.emergency_contact_relationship,
                  marketing_consent: c.marketing_consent,
                  sms_consent: c.sms_consent,
                  email_consent: c.email_consent,
                }));
              }
            });
          }
        }

        if (includePets) {
          const pRes = await fetch(`${BASE_URL}/households/${h.id}/pets`, { headers: authHeaders });
          if (pRes.ok) {
            const pets: any[] = await pRes.json();
            // Needs Diaper is a pet-scoped flag, not a pet column. If the
            // flags fetch fails, leave the cells blank (blank = keep the
            // existing flag on re-import) rather than claiming "No".
            let flags: HouseholdFlag[] | null = null;
            const fRes = await fetch(`${BASE_URL}/households/${h.id}/flags`, { headers: authHeaders });
            if (fRes.ok) flags = await fRes.json();
            pets.forEach((p: any) => {
              if (!p.deleted_at) {
                petRows.push(toTemplateRow('Pets', {
                  household_name: householdName,
                  name: p.name,
                  breed: p.breed,
                  sex: p.sex,
                  date_of_birth: p.date_of_birth,
                  weight_kg: p.weight_kg,
                  colour: p.colour,
                  microchip: p.microchip,
                  neutered_status: p.neutered_status,
                  medical_notes: p.medical_notes,
                  behaviour_notes: p.behaviour_notes,
                  allergies: p.allergies,
                  feeding_instructions: p.feeding_instructions,
                  vet_name: p.vet_name,
                  vet_phone: p.vet_phone,
                  vet_address: p.vet_address,
                  vaccination_expiry_date: p.vaccination_expiry_date,
                  daycare_enrolled: p.daycare_enrolled,
                  grooming_enrolled: p.grooming_enrolled,
                  transport_enrolled: p.transport_enrolled,
                  overnights_enrolled: p.overnights_enrolled,
                  needs_diaper: flags ? isPetFlagActive(flags, p.id, 'needs_diaper') : undefined,
                }));
              }
            });
          }
        }
      }

      // Build XLSX workbook mirroring the import template's sheets
      const wb = XLSX.utils.book_new();
      appendTemplateSheet(wb, 'Households', householdRows);
      if (includeContacts) appendTemplateSheet(wb, 'Contacts', contactRows);
      if (includePets) appendTemplateSheet(wb, 'Pets', petRows);

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
                The export uses the same spreadsheet format as the bulk import template,
                with separate sheets for Households, Contacts, and Pets. Edit the file in
                Excel or Google Sheets and re-upload it via Bulk Import to make bulk
                changes — existing customers are matched by household name and updated.
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
