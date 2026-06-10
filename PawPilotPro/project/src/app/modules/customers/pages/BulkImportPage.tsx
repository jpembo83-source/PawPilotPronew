// Bulk Import Page
// UploadSimple and process CSV files to import multiple households

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, UploadSimple, FileText, Warning, CheckCircle, XCircle, DownloadSimple, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';

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
  
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/import/template`,
        {
          headers: {
            ...(await getAuthHeaders()),
            'X-Tenant-Id': activeTenantId || '',
          },
        }
      );
      
      if (!response.ok) {
        // Try to get error details
        let errorMessage = 'Failed to download template';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.error || error.message || errorMessage;
          }
        } catch {
          // Ignore JSON parse errors
        }
        throw new Error(errorMessage);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customer-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Template downloaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download template');
    }
  };
  
  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dry_run', isDryRun.toString());

      // FormData posts must not send the JSON Content-Type the shared util adds —
      // the browser has to set the multipart boundary itself.
      const { 'Content-Type': _ct, ...auth } = await getAuthHeaders();

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/import`,
        {
          method: 'POST',
          headers: {
            ...auth,
            'X-Tenant-Id': activeTenantId || '',
          },
          body: formData,
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
      
      if (isDryRun) {
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
            <li>DownloadSimple the Excel template and fill in your customer data</li>
            <li>Upload the completed file and run a dry run to validate</li>
            <li>Review the summary and fix any errors</li>
            <li>Apply the import to create/update records in your database</li>
          </ol>
        </CardContent>
      </Card>
      
      {/* Template DownloadSimple */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Step 1: DownloadSimple Template</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 mb-4">
            DownloadSimple the Excel template with the correct column headers and example data
          </p>
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
          >
            <DownloadSimple className="h-4 w-4 mr-2" />
            DownloadSimple Template
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
                    DownloadSimple Error Report
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