import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../../../context/AuthContext';
import { useDashboardStore } from '../../dashboard/store';
import { useReportingStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { ArrowLeft, DownloadSimple, Table as TableIcon, Warning, ArrowClockwise, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { ReportFilters } from '../components/ReportFilters';
import { REPORT_DEFINITIONS, REPORT_CATEGORY_LABELS, REPORT_CATEGORY_COLOURS, type ReportId, type ReportColumn } from '../types';

const PAGE_SIZE = 25;

function canAccess(role: string, reportId: string): boolean {
  const def = REPORT_DEFINITIONS.find((r) => r.id === reportId);
  if (!def) return false;
  return def.requiredRole.includes(role as any);
}

function CellValue({ value, type }: { value: any; type: ReportColumn['type'] }) {
  if (value === undefined || value === null || value === '') return <span className="text-slate-300">—</span>;

  switch (type) {
    case 'badge': {
      const isPositive = value === 'Yes' || value === 'active';
      const isWarning = value === 'payment_hold' || value === 'Payment Hold';
      const isNegative = value === 'No' || value === 'inactive' || value === 'cancelled';
      const cls = isPositive
        ? 'bg-green-100 text-green-800'
        : isWarning
        ? 'bg-orange-100 text-orange-800'
        : isNegative
        ? 'bg-slate-100 text-slate-600'
        : 'bg-blue-100 text-blue-800';
      return <Badge className={`text-xs ${cls}`}>{value}</Badge>;
    }
    case 'percentage':
      return <span>{value}%</span>;
    case 'number':
      return <span className="font-mono">{typeof value === 'number' ? value.toLocaleString() : value}</span>;
    default:
      return <span>{String(value)}</span>;
  }
}

function exportToXlsx(reportTitle: string, rows: any[], columns: ReportColumn[]) {
  if (rows.length === 0) { toast.error('No data to export'); return; }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: columns.map((c) => c.key) });

  // Set column widths
  ws['!cols'] = columns.map((col) => {
    const maxLen = Math.max(
      col.label.length,
      ...rows.map((r) => String(r[col.key] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, reportTitle.slice(0, 31));
  const filename = `${reportTitle.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast.success(`Exported ${rows.length} rows to ${filename}`);
}

export function ReportViewerPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { locations, fetchLocations } = useSettingsStore();
  const { filters, result, isLoading, error, setFilters, runReport } = useReportingStore();
  const [page, setPage] = useState(1);

  const definition = REPORT_DEFINITIONS.find((r) => r.id === reportId);
  const role = user?.role || 'staff';

  useEffect(() => {
    fetchLocations().catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedLocationId) {
      setFilters({ locationId: selectedLocationId });
    }
  }, [selectedLocationId]);

  useEffect(() => {
    setPage(1);
  }, [result]);

  if (!definition) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">Report not found.</p>
        <Button variant="ghost" onClick={() => navigate('/reports')} className="mt-4">Back to Reports</Button>
      </div>
    );
  }

  if (!canAccess(role, reportId!)) {
    return (
      <div className="p-6 max-w-xl mx-auto text-center">
        <Warning className="h-10 w-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-800">Access Restricted</h2>
        <p className="text-slate-500 mt-1 text-sm">This report requires Manager or Admin access.</p>
        <Button variant="ghost" onClick={() => navigate('/reports')} className="mt-4">Back to Reports</Button>
      </div>
    );
  }

  const handleRun = () => {
    runReport(reportId as ReportId);
  };

  const locList = locations.map((l: any) => ({ id: l.id, name: l.name }));
  const columns = result?.columns || [];
  const rows = result?.rows || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/reports')} className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Reports
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`text-xs ${REPORT_CATEGORY_COLOURS[definition.category]}`}>
                {REPORT_CATEGORY_LABELS[definition.category]}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{definition.title}</h1>
            <p className="text-slate-500 text-sm mt-1">{definition.description}</p>
          </div>
          {result && rows.length > 0 && (
            <Button
              onClick={() => exportToXlsx(definition.title, rows, columns)}
              className="bg-green-600 hover:bg-green-700 text-white shrink-0"
            >
              <DownloadSimple className="h-4 w-4 mr-2" />Export XLSX
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <ReportFilters
        filters={filters}
        locations={locList}
        requiresDateRange={definition.requiresDateRange}
        isLoading={isLoading}
        onFiltersChange={setFilters}
        onRun={handleRun}
      />

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <Warning className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Report failed</p>
            <p className="text-sm">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={handleRun} className="ml-auto">
            <ArrowClockwise className="h-4 w-4 mr-1" />Retry
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      {result && result.kpis.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {result.kpis.map((kpi) => (
            <Card key={kpi.label} className="bg-slate-50 border-slate-200">
              <CardContent className="pt-4 pb-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{kpi.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</p>
                {kpi.description && <p className="text-xs text-slate-400 mt-0.5">{kpi.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty / Loading / Table */}
      {!result && !isLoading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <TableIcon className="h-12 w-12 text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Set your filters and run the report</p>
          <p className="text-slate-400 text-sm mt-1">Results will appear here</p>
          <Button onClick={handleRun} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white">
            <ArrowClockwise className="h-4 w-4 mr-2" />Run Report
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20">
          <ArrowClockwise className="h-8 w-8 text-blue-500 animate-spin mb-3" />
          <p className="text-slate-500">Fetching data…</p>
        </div>
      )}

      {result && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Warning className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No data found</p>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your filters or date range</p>
        </div>
      )}

      {result && rows.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  {columns.map((col) => (
                    <TableHead key={col.key} className="font-semibold text-slate-700 whitespace-nowrap">
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row, i) => (
                  <TableRow key={i} className="hover:bg-slate-50">
                    {columns.map((col) => (
                      <TableCell key={col.key} className="whitespace-nowrap text-sm">
                        <CellValue value={row[col.key]} type={col.type} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} rows
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <CaretLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <CaretRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Generated at {new Date(result.generatedAt).toLocaleString('en-GB')} · {result.totalRows} total rows
            </p>
            <Button
              size="sm"
              onClick={() => exportToXlsx(definition.title, rows, columns)}
              className="bg-green-600 hover:bg-green-700 text-white text-xs"
            >
              <DownloadSimple className="h-3.5 w-3.5 mr-1.5" />Export XLSX
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
