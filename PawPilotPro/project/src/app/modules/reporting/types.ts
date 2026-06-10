export type ReportId =
  | 'pets-by-breed'
  | 'new-pets-added'
  | 'customer-list'
  | 'customer-activity'
  | 'daycare-attendance'
  | 'service-utilisation';

export type ReportCategory = 'pets' | 'customers' | 'daycare' | 'services';

export interface ReportDefinition {
  id: ReportId;
  title: string;
  description: string;
  category: ReportCategory;
  requiredRole: ('admin' | 'manager' | 'assistant_manager' | 'staff')[];
  requiresDateRange: boolean;
  requiresFinancialPermission?: boolean;
  requiresPiiPermission?: boolean;
  tags?: string[];
}

export interface ReportFilters {
  locationId: string;
  dateFrom: string;
  dateTo: string;
  includeInactive: boolean;
}

export type ColumnType = 'text' | 'number' | 'percentage' | 'date' | 'badge';

export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
  width?: number;
}

export interface ReportKpi {
  label: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface ReportResult {
  rows: Record<string, any>[];
  columns: ReportColumn[];
  kpis: ReportKpi[];
  generatedAt: string;
  totalRows: number;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: 'pets-by-breed',
    title: 'Pets by Breed',
    description: 'Count of pets grouped by breed, with percentage distribution. Useful for identifying your most popular breeds.',
    category: 'pets',
    requiredRole: ['admin', 'manager', 'assistant_manager'],
    requiresDateRange: false,
    tags: ['Breed Insights'],
  },
  {
    id: 'new-pets-added',
    title: 'New Pets Added',
    description: 'Pets registered within the selected date range. Track acquisition trends over time.',
    category: 'pets',
    requiredRole: ['admin', 'manager', 'assistant_manager'],
    requiresDateRange: true,
    tags: ['Growth'],
  },
  {
    id: 'customer-list',
    title: 'Customer List Export',
    description: 'Full list of households with contact information, pet counts, and account status. Contact details require PII permission.',
    category: 'customers',
    requiredRole: ['admin', 'manager'],
    requiresDateRange: false,
    requiresPiiPermission: true,
    tags: ['Export'],
  },
  {
    id: 'customer-activity',
    title: 'Customer Pulse',
    description: 'Households ranked by visit frequency within the date range. Identify your most active and at-risk customers.',
    category: 'customers',
    requiredRole: ['admin', 'manager', 'assistant_manager'],
    requiresDateRange: true,
    tags: ['Engagement'],
  },
  {
    id: 'daycare-attendance',
    title: 'Daycare Attendance Summary',
    description: 'Daily breakdown of scheduled, checked-in, and checked-out attendance. Includes no-shows and cancellations.',
    category: 'daycare',
    requiredRole: ['admin', 'manager', 'assistant_manager'],
    requiresDateRange: true,
    tags: ['Operational'],
  },
  {
    id: 'service-utilisation',
    title: 'Service Utilisation',
    description: 'Volume of bookings across all services (daycare, grooming, overnights, transport) for the selected period.',
    category: 'services',
    requiredRole: ['admin', 'manager', 'assistant_manager'],
    requiresDateRange: true,
    tags: ['Overview'],
  },
];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  pets: 'Pets & Breeds',
  customers: 'Customers',
  daycare: 'Daycare',
  services: 'Services',
};

export const REPORT_CATEGORY_COLOURS: Record<ReportCategory, string> = {
  pets: 'bg-amber-100 text-amber-800',
  customers: 'bg-blue-100 text-blue-800',
  daycare: 'bg-green-100 text-green-800',
  services: 'bg-purple-100 text-purple-800',
};
