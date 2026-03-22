import { useState } from 'react';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { useAuth } from '../../../context/AuthContext';
import { exportToXlsx } from '../../reports/utils/exportXlsx';
import type { ExportColumn } from '../../reports/utils/exportXlsx';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/reports`;

const BEXIO_COLUMNS: ExportColumn[] = [
  { key: 'invoiceNumber', header: 'Invoice Number', width: 18 },
  { key: 'contactName', header: 'Contact Name', width: 28 },
  { key: 'issueDate', header: 'Issue Date', width: 14 },
  { key: 'dueDate', header: 'Due Date', width: 14 },
  { key: 'currency', header: 'Currency', width: 10 },
  { key: 'subtotal', header: 'Subtotal', width: 14 },
  { key: 'taxRate', header: 'Tax Rate %', width: 12 },
  { key: 'taxAmount', header: 'Tax Amount', width: 14 },
  { key: 'total', header: 'Total', width: 14 },
  { key: 'status', header: 'Status', width: 12 },
  { key: 'reference', header: 'Reference', width: 24 },
];

export function BillingExports() {
  const { session } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBexioExport = async () => {
    setLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      };
      if (session?.access_token) {
        headers['X-User-Token'] = session.access_token;
      }

      let url = `${BASE_URL}/bexio-export?`;
      if (fromDate) url += `from_date=${fromDate}&`;
      if (toDate) url += `to_date=${toDate}&`;

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();

      if (!json.rows || json.rows.length === 0) {
        setError('No invoices found for the selected period');
        return;
      }

      exportToXlsx(json.rows, BEXIO_COLUMNS, `bexio-export-${fromDate || 'all'}`, 'Invoices');
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Financial Exports</h3>
        <p className="text-sm text-slate-500">Export invoice data for accounting systems</p>
      </div>

      <div className="bg-white border rounded-lg p-6 space-y-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-blue-600" />
          <div>
            <h4 className="font-medium text-slate-900">Bexio Export</h4>
            <p className="text-sm text-slate-500">
              Export issued invoices in a format compatible with Bexio accounting software
            </p>
          </div>
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <Label className="text-xs text-slate-500">From Date</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">To Date</Label>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={handleBexioExport} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export to Excel
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    </div>
  );
}
