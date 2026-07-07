// Bulk Import Page
// UploadSimple and process CSV files to import multiple households

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, UploadSimple, FileText, Warning, CheckCircle, XCircle, DownloadSimple, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';

// Single source of truth for the workbook layout: template headers on the
// left, import field names (what the server's row schemas expect) on the
// right. The downloaded template and the upload parser both derive from this,
// so they cannot drift apart.
const IMPORT_SHEETS: Record<string, Record<string, string>> = {
  Households: {
    'Household Name': 'name',
    'External ID': 'external_id',
    'Status (active/inactive)': 'status',
    'VIP (Yes/No)': 'vip',
    'Payment Hold (Yes/No)': 'payment_hold',
    'Hold Reason': 'hold_reason',
    'Location': 'location',
    'Address': 'address',
    'Internal Notes': 'internal_notes',
  },
  Contacts: {
    'Household Name': 'household_name',
    'First Name': 'first_name',
    'Last Name': 'last_name',
    'Email': 'email',
    'Phone': 'phone',
    'Preferred Contact Method': 'preferred_contact_method',
    'Primary (Yes/No)': 'is_primary',
    'Emergency Contact (Yes/No)': 'is_emergency_contact',
    'Emergency Relationship': 'emergency_contact_relationship',
    'Marketing Consent (Yes/No)': 'marketing_consent',
    'SMS Consent (Yes/No)': 'sms_consent',
    'Email Consent (Yes/No)': 'email_consent',
  },
  Pets: {
    'Household Name': 'household_name',
    'Name': 'name',
    'Breed': 'breed',
    'Sex': 'sex',
    'Date of Birth (YYYY-MM-DD)': 'date_of_birth',
    'Weight (kg)': 'weight_kg',
    'Colour': 'colour',
    'Microchip': 'microchip',
    'Neutered Status (spayed/castrated/none)': 'neutered_status',
    'Medical Notes': 'medical_notes',
    'Behaviour Notes': 'behaviour_notes',
    'Allergies': 'allergies',
    'Feeding Instructions': 'feeding_instructions',
    'Vet Name': 'vet_name',
    'Vet Phone': 'vet_phone',
    'Vet Address': 'vet_address',
    'Vaccination Expiry (YYYY-MM-DD)': 'vaccination_expiry_date',
    'Daycare (Yes/No)': 'daycare_enrolled',
    'Grooming (Yes/No)': 'grooming_enrolled',
    'Transport (Yes/No)': 'transport_enrolled',
    'Overnights (Yes/No)': 'overnights_enrolled',
  },
};

// One example row per sheet, keyed by template header. "Household Name" links
// rows across the three sheets. Yes/No cells left blank keep the existing
// value on update and use the default on create.
const TEMPLATE_EXAMPLES: Record<string, Record<string, string | number>> = {
  Households: {
    'Household Name': 'Smith Family',
    'External ID': 'CRM-1042',
    'Status (active/inactive)': 'active',
    'VIP (Yes/No)': 'No',
    'Payment Hold (Yes/No)': 'No',
    'Hold Reason': '',
    'Location': '',
    'Address': '12 Acacia Avenue, London, SW1A 1AA',
    'Internal Notes': '',
  },
  Contacts: {
    'Household Name': 'Smith Family',
    'First Name': 'Jane',
    'Last Name': 'Smith',
    'Email': 'jane.smith@example.com',
    'Phone': '+44 7700 900123',
    'Preferred Contact Method': 'email',
    'Primary (Yes/No)': 'Yes',
    'Emergency Contact (Yes/No)': 'Yes',
    'Emergency Relationship': 'Owner',
    'Marketing Consent (Yes/No)': 'No',
    'SMS Consent (Yes/No)': 'Yes',
    'Email Consent (Yes/No)': 'Yes',
  },
  Pets: {
    'Household Name': 'Smith Family',
    'Name': 'Buddy',
    'Breed': 'Labrador Retriever',
    'Sex': 'Male',
    'Date of Birth (YYYY-MM-DD)': '2021-06-15',
    'Weight (kg)': 28,
    'Colour': 'Golden',
    'Microchip': '985112003456789',
    'Neutered Status (spayed/castrated/none)': 'castrated',
    'Medical Notes': 'Mild hip dysplasia — no stairs',
    'Behaviour Notes': 'Friendly with other dogs',
    'Allergies': 'Chicken',
    'Feeding Instructions': 'Half a cup of kibble, morning and evening',
    'Vet Name': 'Acme Veterinary Clinic',
    'Vet Phone': '+44 20 7946 0999',
    'Vet Address': '1 High Street, London',
    'Vaccination Expiry (YYYY-MM-DD)': '2026-11-30',
    'Daycare (Yes/No)': 'Yes',
    'Grooming (Yes/No)': 'No',
    'Transport (Yes/No)': 'No',
    'Overnights (Yes/No)': 'No',
  },
};

// Extract a sheet's data rows as {row, field: value} objects for the server.
// `row` is the 1-based spreadsheet row (header is row 1), so server-side
// errors point at the line the user sees in Excel. Blank rows are dropped.
function parseSheet(workbook: XLSX.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const mapping = IMPORT_SHEETS[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: '' });
  return rows
    .map((sourceRow, index) => {
      const mapped: Record<string, unknown> = { row: index + 2 };
      for (const [header, field] of Object.entries(mapping)) {
        mapped[field] = sourceRow[header] ?? '';
      }
      return mapped;
    })
    .filter((mapped) => Object.entries(mapped).some(([key, value]) => key !== 'row' && String(value).trim() !== ''));
}

interface ImportResult {
  success: boolean;
  summary: {
    totalRows: number;
    households: { created: number; updated: number; errors: number };
    contacts: { created: number; updated: number; errors: number };
    pets: { created: number; updated: number; errors: number };
  };
  errors: Array<{
    row: number;
    entity: string;
    field: string;
    message: string;
  }>;
}

export function BulkImportPage() {
  const navigate = useNavigate();
  const { user, activeTenantId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        toast.error('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      
      setFile(selectedFile);
      setResult(null); // Clear previous results
    }
  };
  
  // Generated client-side (like ExportPage) — the server template endpoint was
  // a stub that returned JSON, which saved-as-.xlsx read as a corrupt file.
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();
      for (const [sheetName, exampleRow] of Object.entries(TEMPLATE_EXAMPLES)) {
        const ws = XLSX.utils.json_to_sheet([exampleRow]);
        ws['!cols'] = Object.keys(exampleRow).map((header) => ({ wch: Math.max(header.length + 2, 14) }));
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
      XLSX.writeFile(wb, 'customer-import-template.xlsx');
      toast.success('Template downloaded');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download template');
    }
  };
  
  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }
    
    setIsProcessing(true);

    try {
      // Parse the workbook here and send plain JSON rows — the server
      // validates each row and reports errors by spreadsheet row number.
      const workbook = XLSX.read(await file.arrayBuffer());
      const payload = {
        dry_run: isDryRun,
        households: parseSheet(workbook, 'Households'),
        contacts: parseSheet(workbook, 'Contacts'),
        pets: parseSheet(workbook, 'Pets'),
      };
      if (payload.households.length + payload.contacts.length + payload.pets.length === 0) {
        toast.error('No data rows found — fill in the Households, Contacts, or Pets sheets of the template');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/import`,
        {
          method: 'POST',
          headers: {
            ...(await getAuthHeaders()),
            'X-Tenant-Id': activeTenantId || '',
          },
          body: JSON.stringify(payload),
        }
      );
      
      if (!response.ok) {
        // Try to parse error as JSON, but handle non-JSON responses
        let errorMessage = 'Import failed';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || error.message || 'Import failed';
          } else {
            const text = await response.text();
            errorMessage = text.substring(0, 100) || `Import failed (${response.status})`;
          }
        } catch {
          errorMessage = `Import failed (${response.status})`;
        }
        throw new Error(errorMessage);
      }
      
      // Parse the successful response
      let importResult: ImportResult;
      try {
        importResult = await response.json();
      } catch {
        throw new Error('Invalid response from server');
      }
      setResult(importResult);

      if (importResult.errors.length > 0) {
        toast.warning(`${isDryRun ? 'Dry run' : 'Import'} completed with ${importResult.errors.length} row error${importResult.errors.length === 1 ? '' : 's'} — review the details below`);
      } else if (isDryRun) {
        toast.success('Dry run completed - review the results below');
      } else {
        toast.success('Import completed successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Import failed');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDownloadErrors = () => {
    if (!result || result.errors.length === 0) return;
    
    // Create CSV of errors
    const csv = [
      'Row,Entity,Field,Error',
      ...result.errors.map(e => `${e.row},${e.entity},${e.field},"${e.message}"`),
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast.success('Error report downloaded');
  };
  
  const handleApplyImport = () => {
    setIsDryRun(false);
    setResult(null);
    // Will trigger actual import when user clicks "Run Import" button
  };
  
  return (
    <div className="p-6 max-w-5xl mx-auto">
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
        
        <h1 className="text-3xl font-bold text-slate-900">Bulk Import Customers</h1>
        <p className="text-slate-600 mt-2">
          Import households, contacts, and pets from an Excel spreadsheet
        </p>
      </div>
      
      {/* Instructions */}
      <Card className="mb-6 bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <h3 className="font-semibold text-blue-900 mb-2">Import Process</h3>
          <ol className="text-blue-800 text-sm space-y-1 list-decimal list-inside">
            <li>Download the Excel template and fill in your customer data</li>
            <li>Upload the completed file and run a dry run to validate</li>
            <li>Review the summary and fix any errors</li>
            <li>Apply the import to create/update records in your database</li>
          </ol>
        </CardContent>
      </Card>
      
      {/* Template DownloadSimple */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step 1: Download Template</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 mb-4">
            Download the Excel template with the correct column headers and an example row — replace the example with your data before importing
          </p>
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
          >
            <DownloadSimple className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </CardContent>
      </Card>
      
      {/* File UploadSimple */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step 2: Upload Your File</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
              >
                <UploadSimple className="h-4 w-4 mr-2" />
                Select File
              </Button>
              
              {file && (
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                  <FileText className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span className="text-slate-400">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </div>
            
            {file && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Warning className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 mb-1">
                    {isDryRun ? 'Dry Run Mode (Safe)' : 'LIVE IMPORT MODE'}
                  </p>
                  <p className="text-amber-800">
                    {isDryRun 
                      ? 'Your file will be validated but no changes will be made to the database. Review the results before applying.'
                      : 'This will create and update records in your database. Make sure you have reviewed the dry run results first!'
                    }
                  </p>
                </div>
              </div>
            )}
            
            {file && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <CircleNotch className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {isDryRun ? 'Run Dry Run' : 'Apply Import'}
                    </>
                  )}
                </Button>
                
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isDryRun}
                    onChange={(e) => setIsDryRun(e.target.checked)}
                    disabled={isProcessing}
                    className="w-4 h-4 border-slate-300 rounded text-blue-600 focus:ring-blue-500"
                  />
                  Dry run (validate only)
                </label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Results */}
      {result && (
        <Card className={result.success ? 'border-green-200' : 'border-red-200'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Import {isDryRun ? 'Validation' : 'Completed'}
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  Import Failed
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div>
              <h3 className="font-semibold mb-3">Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                {/* Households */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Households</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Created:</span>
                      <span className="font-medium text-green-600">{result.summary.households.created}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Updated:</span>
                      <span className="font-medium text-blue-600">{result.summary.households.updated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Errors:</span>
                      <span className="font-medium text-red-600">{result.summary.households.errors}</span>
                    </div>
                  </div>
                </div>
                
                {/* Contacts */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Contacts</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Created:</span>
                      <span className="font-medium text-green-600">{result.summary.contacts.created}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Updated:</span>
                      <span className="font-medium text-blue-600">{result.summary.contacts.updated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Errors:</span>
                      <span className="font-medium text-red-600">{result.summary.contacts.errors}</span>
                    </div>
                  </div>
                </div>
                
                {/* Pets */}
                <div className="p-4 bg-slate-50 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Pets</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Created:</span>
                      <span className="font-medium text-green-600">{result.summary.pets.created}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Updated:</span>
                      <span className="font-medium text-blue-600">{result.summary.pets.updated}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Errors:</span>
                      <span className="font-medium text-red-600">{result.summary.pets.errors}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Errors */}
            {result.errors.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-red-900">Errors ({result.errors.length})</h3>
                  <Button
                    onClick={handleDownloadErrors}
                    variant="outline"
                    size="sm"
                  >
                    <DownloadSimple className="h-4 w-4 mr-2" />
                    Download Error Report
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto border border-red-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-red-50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium text-red-900">Row</th>
                        <th className="text-left p-2 font-medium text-red-900">Entity</th>
                        <th className="text-left p-2 font-medium text-red-900">Field</th>
                        <th className="text-left p-2 font-medium text-red-900">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((error, idx) => (
                        <tr key={idx} className="border-t border-red-100">
                          <td className="p-2 text-slate-600">{error.row}</td>
                          <td className="p-2 text-slate-600">{error.entity}</td>
                          <td className="p-2 text-slate-600">{error.field}</td>
                          <td className="p-2 text-red-700">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Actions */}
            {isDryRun && result.success && result.errors.length === 0 && (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">Validation Successful</p>
                    <p className="text-sm text-green-800">
                      No errors found. You can now apply the import to update your database.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleApplyImport}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Apply Import
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}