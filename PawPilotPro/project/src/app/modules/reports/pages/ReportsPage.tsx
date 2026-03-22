import { useState, useEffect, useCallback } from 'react';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { supabase } from '../../../../utils/supabase/client';
import { useAuth } from '../../../context/AuthContext';
import { useDashboardStore } from '../../dashboard/store';
import { exportToXlsx } from '../utils/exportXlsx';
import type { ExportColumn } from '../utils/exportXlsx';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Download, Search, Dog, Users, BarChart3, FileText,
  Calendar, XCircle, Loader2, Filter, DollarSign, TrendingUp
} from 'lucide-react';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/reports`;

type ReportTab = 'pets' | 'breeds' | 'customers' | 'attendance' | 'service-usage' | 'revenue' | 'cancellations' | 'monthly-summary';

const TABS: { id: ReportTab; label: string; icon: any }[] = [
  { id: 'pets', label: 'Pets', icon: Dog },
  { id: 'breeds', label: 'Breeds', icon: BarChart3 },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: Calendar },
  { id: 'service-usage', label: 'Service Usage', icon: FileText },
  { id: 'revenue', label: 'Revenue & Balances', icon: DollarSign },
  { id: 'cancellations', label: 'Cancellations & No-Shows', icon: XCircle },
  { id: 'monthly-summary', label: 'Monthly Summary', icon: TrendingUp },
];

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('pets');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();

  const locationParam = selectedLocationId && selectedLocationId !== 'ALL' ? selectedLocationId : '';

  const fetchReport = useCallback(async (tab: ReportTab) => {
    setLoading(true);
    setError('');
    setData(null);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;

      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      };
      if (accessToken) {
        reqHeaders['X-User-Token'] = `Bearer ${accessToken}`;
      }

      let url = `${BASE_URL}/${tab}?`;
      if (locationParam) url += `location_id=${locationParam}&`;
      if (tab === 'monthly-summary') {
        url += `month=${selectedMonth}&`;
      } else {
        if (fromDate) url += `from_date=${fromDate}&`;
        if (toDate) url += `to_date=${toDate}&`;
      }

      const res = await fetch(url, { headers: reqHeaders });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [user, locationParam, fromDate, toDate, selectedMonth]);

  useEffect(() => {
    if (user) {
      fetchReport(activeTab);
    }
  }, [activeTab, locationParam, user]);

  const handleApplyFilters = () => fetchReport(activeTab);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Reports</h1>
            <p className="mt-1 text-sm text-slate-500">
              Generate and export operational reports
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <div className="flex space-x-1 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="pb-8">
        {activeTab === 'pets' && <PetsReport data={data} loading={loading} error={error} searchFilter={searchFilter} setSearchFilter={setSearchFilter} />}
        {activeTab === 'breeds' && <BreedsReport data={data} loading={loading} error={error} />}
        {activeTab === 'customers' && <CustomersReport data={data} loading={loading} error={error} searchFilter={searchFilter} setSearchFilter={setSearchFilter} />}
        {activeTab === 'attendance' && <AttendanceReport data={data} loading={loading} error={error} fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} onApply={handleApplyFilters} searchFilter={searchFilter} setSearchFilter={setSearchFilter} />}
        {activeTab === 'service-usage' && <ServiceUsageReport data={data} loading={loading} error={error} fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} onApply={handleApplyFilters} searchFilter={searchFilter} setSearchFilter={setSearchFilter} />}
        {activeTab === 'revenue' && <RevenueReport data={data} loading={loading} error={error} fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} onApply={handleApplyFilters} />}
        {activeTab === 'cancellations' && <CancellationsReport data={data} loading={loading} error={error} fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} onApply={handleApplyFilters} searchFilter={searchFilter} setSearchFilter={setSearchFilter} />}
        {activeTab === 'monthly-summary' && <MonthlySummaryReport data={data} loading={loading} error={error} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} onApply={handleApplyFilters} />}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
      <p className="text-red-600">{message}</p>
    </div>
  );
}

function DateFilters({ fromDate, toDate, setFromDate, setToDate, onApply }: any) {
  return (
    <div className="flex items-end gap-3">
      <div>
        <Label className="text-xs">From</Label>
        <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
      </div>
      <div>
        <Label className="text-xs">To</Label>
        <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
      </div>
      <Button size="sm" onClick={onApply}>
        <Filter className="h-4 w-4 mr-1" /> Apply
      </Button>
    </div>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-64">
      <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
      <Input placeholder="Filter..." value={value} onChange={e => onChange(e.target.value)} className="pl-9" />
    </div>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Download className="h-4 w-4 mr-1" /> Export to Excel
    </Button>
  );
}

function ReportTable({ columns, rows }: { columns: ExportColumn[]; rows: any[] }) {
  if (rows.length === 0) {
    return <p className="text-center py-8 text-slate-400">No data to display</p>;
  }
  return (
    <div className="overflow-auto border rounded-lg">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b">
            {columns.map(c => (
              <th key={c.key} className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
              {columns.map(c => (
                <td key={c.key} className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{formatCell(row[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}

const PET_COLUMNS: ExportColumn[] = [
  { key: 'name', header: 'Name', width: 20 },
  { key: 'breed', header: 'Breed', width: 22 },
  { key: 'species', header: 'Species', width: 12 },
  { key: 'sex', header: 'Sex', width: 10 },
  { key: 'weight', header: 'Weight', width: 10 },
  { key: 'dateOfBirth', header: 'Date of Birth', width: 14 },
  { key: 'neutered', header: 'Neutered', width: 10 },
  { key: 'householdName', header: 'Household', width: 24 },
  { key: 'status', header: 'Status', width: 12 },
];

function PetsReport({ data, loading, error, searchFilter, setSearchFilter }: any) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const pets = (data?.pets || []).filter((p: any) =>
    !searchFilter || p.name?.toLowerCase().includes(searchFilter.toLowerCase()) || p.breed?.toLowerCase().includes(searchFilter.toLowerCase()) || p.householdName?.toLowerCase().includes(searchFilter.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SearchBar value={searchFilter} onChange={setSearchFilter} />
          <Badge variant="secondary">{pets.length} pets</Badge>
        </div>
        <ExportButton onClick={() => exportToXlsx(pets, PET_COLUMNS, 'pets-report', 'Pets')} />
      </div>
      <ReportTable columns={PET_COLUMNS} rows={pets} />
    </div>
  );
}

const BREED_COLUMNS: ExportColumn[] = [
  { key: 'breed', header: 'Breed', width: 28 },
  { key: 'count', header: 'Count', width: 10 },
  { key: 'petNames', header: 'Pets', width: 50 },
];

function BreedsReport({ data, loading, error }: any) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const breeds = data?.breeds || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{breeds.length} breeds</Badge>
        <ExportButton onClick={() => exportToXlsx(breeds, BREED_COLUMNS, 'breeds-report', 'Breeds')} />
      </div>
      <ReportTable columns={BREED_COLUMNS} rows={breeds} />
    </div>
  );
}

const CUSTOMER_COLUMNS: ExportColumn[] = [
  { key: 'householdName', header: 'Household', width: 24 },
  { key: 'primaryContact', header: 'Primary Contact', width: 22 },
  { key: 'email', header: 'Email', width: 28 },
  { key: 'phone', header: 'Phone', width: 18 },
  { key: 'petCount', header: 'Pets', width: 8 },
  { key: 'petNames', header: 'Pet Names', width: 30 },
  { key: 'status', header: 'Status', width: 12 },
  { key: 'createdAt', header: 'Created', width: 14 },
];

function CustomersReport({ data, loading, error, searchFilter, setSearchFilter }: any) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const customers = (data?.customers || []).filter((c: any) =>
    !searchFilter || c.householdName?.toLowerCase().includes(searchFilter.toLowerCase()) || c.primaryContact?.toLowerCase().includes(searchFilter.toLowerCase()) || c.email?.toLowerCase().includes(searchFilter.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SearchBar value={searchFilter} onChange={setSearchFilter} />
          <Badge variant="secondary">{customers.length} customers</Badge>
        </div>
        <ExportButton onClick={() => exportToXlsx(customers, CUSTOMER_COLUMNS, 'customers-report', 'Customers')} />
      </div>
      <ReportTable columns={CUSTOMER_COLUMNS} rows={customers} />
    </div>
  );
}

const ATTENDANCE_COLUMNS: ExportColumn[] = [
  { key: 'bookingDate', header: 'Date', width: 14 },
  { key: 'petName', header: 'Pet', width: 20 },
  { key: 'householdName', header: 'Household', width: 22 },
  { key: 'serviceType', header: 'Service', width: 14 },
  { key: 'status', header: 'Status', width: 14 },
  { key: 'checkedInAt', header: 'Checked In', width: 18 },
  { key: 'checkedOutAt', header: 'Checked Out', width: 18 },
  { key: 'locationName', header: 'Location', width: 20 },
];

function AttendanceReport({ data, loading, error, fromDate, toDate, setFromDate, setToDate, onApply, searchFilter, setSearchFilter }: any) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const attendance = (data?.attendance || []).filter((a: any) =>
    !searchFilter || a.petName?.toLowerCase().includes(searchFilter.toLowerCase()) || a.householdName?.toLowerCase().includes(searchFilter.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <DateFilters fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} onApply={onApply} />
          <SearchBar value={searchFilter} onChange={setSearchFilter} />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{attendance.length} records</Badge>
          <ExportButton onClick={() => exportToXlsx(attendance, ATTENDANCE_COLUMNS, 'attendance-report', 'Attendance')} />
        </div>
      </div>
      <ReportTable columns={ATTENDANCE_COLUMNS} rows={attendance} />
    </div>
  );
}

const USAGE_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date', width: 14 },
  { key: 'module', header: 'Module', width: 14 },
  { key: 'serviceType', header: 'Service Type', width: 18 },
  { key: 'petName', header: 'Pet', width: 20 },
  { key: 'householdName', header: 'Household', width: 22 },
  { key: 'status', header: 'Status', width: 14 },
];

function ServiceUsageReport({ data, loading, error, fromDate, toDate, setFromDate, setToDate, onApply, searchFilter, setSearchFilter }: any) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const usage = (data?.usage || []).filter((u: any) =>
    !searchFilter || u.petName?.toLowerCase().includes(searchFilter.toLowerCase()) || u.householdName?.toLowerCase().includes(searchFilter.toLowerCase()) || u.module?.toLowerCase().includes(searchFilter.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <DateFilters fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} onApply={onApply} />
          <SearchBar value={searchFilter} onChange={setSearchFilter} />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{usage.length} records</Badge>
          <ExportButton onClick={() => exportToXlsx(usage, USAGE_COLUMNS, 'service-usage-report', 'Service Usage')} />
        </div>
      </div>
      <ReportTable columns={USAGE_COLUMNS} rows={usage} />
    </div>
  );
}

const REVENUE_COLUMNS: ExportColumn[] = [
  { key: 'invoiceNumber', header: 'Invoice #', width: 16 },
  { key: 'householdName', header: 'Customer', width: 24 },
  { key: 'issueDate', header: 'Issue Date', width: 14 },
  { key: 'dueDate', header: 'Due Date', width: 14 },
  { key: 'status', header: 'Status', width: 12 },
  { key: 'subtotal', header: 'Subtotal', width: 12 },
  { key: 'tax', header: 'Tax', width: 10 },
  { key: 'total', header: 'Total', width: 12 },
  { key: 'amountPaid', header: 'Paid', width: 12 },
  { key: 'balance', header: 'Balance', width: 12 },
];

function RevenueReport({ data, loading, error, fromDate, toDate, setFromDate, setToDate, onApply }: any) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const summary = data?.summary || {};
  const invoices = data?.invoices || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard label="Total Invoiced" value={formatCurrency(summary.totalInvoiced)} />
        <SummaryCard label="Total Paid" value={formatCurrency(summary.totalPaid)} color="green" />
        <SummaryCard label="Outstanding" value={formatCurrency(summary.totalOutstanding)} color="amber" />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateFilters fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} onApply={onApply} />
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{invoices.length} invoices</Badge>
          <ExportButton onClick={() => exportToXlsx(invoices, REVENUE_COLUMNS, 'revenue-report', 'Revenue')} />
        </div>
      </div>
      <ReportTable columns={REVENUE_COLUMNS} rows={invoices} />
    </div>
  );
}

const CANCELLATION_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date', width: 14 },
  { key: 'module', header: 'Module', width: 14 },
  { key: 'petName', header: 'Pet', width: 20 },
  { key: 'householdName', header: 'Household', width: 22 },
  { key: 'status', header: 'Status', width: 14 },
  { key: 'reason', header: 'Reason', width: 30 },
  { key: 'cancelledAt', header: 'Cancelled At', width: 18 },
];

function CancellationsReport({ data, loading, error, fromDate, toDate, setFromDate, setToDate, onApply, searchFilter, setSearchFilter }: any) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const cancellations = (data?.cancellations || []).filter((c: any) =>
    !searchFilter || c.petName?.toLowerCase().includes(searchFilter.toLowerCase()) || c.householdName?.toLowerCase().includes(searchFilter.toLowerCase())
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <DateFilters fromDate={fromDate} toDate={toDate} setFromDate={setFromDate} setToDate={setToDate} onApply={onApply} />
          <SearchBar value={searchFilter} onChange={setSearchFilter} />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{cancellations.length} records</Badge>
          <ExportButton onClick={() => exportToXlsx(cancellations, CANCELLATION_COLUMNS, 'cancellations-report', 'Cancellations')} />
        </div>
      </div>
      <ReportTable columns={CANCELLATION_COLUMNS} rows={cancellations} />
    </div>
  );
}

const MONTHLY_COLUMNS: ExportColumn[] = [
  { key: 'petName', header: 'Pet', width: 20 },
  { key: 'breed', header: 'Breed', width: 22 },
  { key: 'householdName', header: 'Household', width: 24 },
  { key: 'daycareDays', header: 'Daycare Days', width: 14 },
  { key: 'groomingCount', header: 'Grooming', width: 12 },
  { key: 'transportCount', header: 'Transport', width: 12 },
  { key: 'overnightNights', header: 'Overnight Nights', width: 16 },
  { key: 'totalEstimated', header: 'Est. Total', width: 14 },
];

function MonthlySummaryReport({ data, loading, error, selectedMonth, setSelectedMonth, onApply }: any) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  const summaries = data?.summaries || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs">Month</Label>
            <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-48" />
          </div>
          <Button size="sm" onClick={onApply}>
            <Filter className="h-4 w-4 mr-1" /> Apply
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{summaries.length} pets with activity</Badge>
          <ExportButton onClick={() => exportToXlsx(summaries, MONTHLY_COLUMNS, `monthly-summary-${selectedMonth}`, 'Monthly Summary')} />
        </div>
      </div>
      <ReportTable columns={MONTHLY_COLUMNS} rows={summaries} />
    </div>
  );
}

function SummaryCard({ label, value, color = 'slate' }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-900',
    green: 'bg-green-50 text-green-900',
    amber: 'bg-amber-50 text-amber-900',
  };
  return (
    <div className={`rounded-lg border p-4 ${colorMap[color] || colorMap.slate}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function formatCurrency(val: number | undefined): string {
  if (val === undefined || val === null) return 'CHF 0.00';
  return `CHF ${val.toFixed(2)}`;
}
