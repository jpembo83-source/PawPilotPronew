import { create } from 'zustand';
import { projectId } from '../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../utils/supabase/authHeaders';
import type { ReportId, ReportFilters, ReportResult, ReportColumn } from './types';

const CUSTOMERS_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers`;
const DAYCARE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/daycare`;
const GROOMING_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/grooming`;
const TRANSPORT_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/transport`;

const apiFetch = async (url: string) => {
  const headers = await getAuthHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
};

interface ReportingState {
  activeReport: ReportId | null;
  filters: ReportFilters;
  result: ReportResult | null;
  isLoading: boolean;
  error: string | null;

  setActiveReport: (id: ReportId | null) => void;
  setFilters: (filters: Partial<ReportFilters>) => void;
  runReport: (id: ReportId) => Promise<void>;
  clearResult: () => void;
}

const defaultFilters = (): ReportFilters => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    locationId: 'ALL',
    dateFrom: firstOfMonth.toISOString().split('T')[0],
    dateTo: today.toISOString().split('T')[0],
    includeInactive: false,
  };
};

export const useReportingStore = create<ReportingState>((set, get) => ({
  activeReport: null,
  filters: defaultFilters(),
  result: null,
  isLoading: false,
  error: null,

  setActiveReport: (id) => set({ activeReport: id, result: null, error: null }),

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial }, result: null })),

  clearResult: () => set({ result: null, error: null }),

  runReport: async (id: ReportId) => {
    const { filters } = get();
    set({ isLoading: true, error: null, result: null });
    try {
      let result: ReportResult;
      switch (id) {
        case 'pets-by-breed':
          result = await runPetsByBreed(filters);
          break;
        case 'new-pets-added':
          result = await runNewPetsAdded(filters);
          break;
        case 'customer-list':
          result = await runCustomerList(filters);
          break;
        case 'customer-activity':
          result = await runCustomerActivity(filters);
          break;
        case 'daycare-attendance':
          result = await runDaycareAttendance(filters);
          break;
        case 'service-utilisation':
          result = await runServiceUtilisation(filters);
          break;
        default:
          throw new Error('Unknown report type');
      }
      set({ result, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Report failed', isLoading: false });
    }
  },
}));

// ─── Report Runners ──────────────────────────────────────────────────────────

async function getAllPets(filters: ReportFilters) {
  const households: any[] = await apiFetch(`${CUSTOMERS_URL}/households`);
  const allPets: any[] = [];
  await Promise.all(
    households.map(async (hh: any) => {
      try {
        const pets: any[] = await apiFetch(`${CUSTOMERS_URL}/households/${hh.id}/pets`);
        pets.forEach((p: any) => allPets.push({ ...p, household_name: hh.household_name || hh.name }));
      } catch {
        // skip failed households
      }
    })
  );
  return allPets;
}

async function runPetsByBreed(filters: ReportFilters): Promise<ReportResult> {
  const pets = await getAllPets(filters);
  const activePets = filters.includeInactive ? pets : pets.filter((p) => p.is_active !== false && !p.deleted_at);

  const breedMap: Record<string, { count: number; species: string }> = {};
  for (const pet of activePets) {
    const breed = pet.breed?.trim() || 'Unknown';
    const species = pet.species || 'Dog';
    if (!breedMap[breed]) breedMap[breed] = { count: 0, species };
    breedMap[breed].count++;
  }

  const total = activePets.length;
  const rows = Object.entries(breedMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([breed, { count, species }], i) => ({
      'Rank': i + 1,
      'Breed': breed,
      'Species': species,
      'Count': count,
      'Distribution (%)': total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0,
    }));

  const columns: ReportColumn[] = [
    { key: 'Rank', label: 'Rank', type: 'number' },
    { key: 'Breed', label: 'Breed', type: 'text' },
    { key: 'Species', label: 'Species', type: 'text' },
    { key: 'Count', label: 'Count', type: 'number' },
    { key: 'Distribution (%)', label: 'Distribution (%)', type: 'percentage' },
  ];

  const topBreed = rows[0];
  return {
    rows,
    columns,
    kpis: [
      { label: 'Total Pets', value: total },
      { label: 'Distinct Breeds', value: Object.keys(breedMap).length },
      { label: 'Top Breed', value: topBreed?.Breed || '—' },
      { label: 'Top Breed Count', value: topBreed?.Count || 0 },
    ],
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
  };
}

async function runNewPetsAdded(filters: ReportFilters): Promise<ReportResult> {
  const pets = await getAllPets(filters);
  const from = new Date(filters.dateFrom);
  const to = new Date(filters.dateTo);
  to.setHours(23, 59, 59, 999);

  const newPets = pets.filter((p) => {
    if (!p.created_at) return false;
    const d = new Date(p.created_at);
    return d >= from && d <= to && !p.deleted_at;
  });

  const rows = newPets
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((p) => ({
      'Date Added': p.created_at ? p.created_at.split('T')[0] : '',
      'Pet Name': p.name || '',
      'Species': p.species || '',
      'Breed': p.breed || '',
      'Household': p.household_name || '',
      'Active': p.is_active !== false ? 'Yes' : 'No',
    }));

  const columns: ReportColumn[] = [
    { key: 'Date Added', label: 'Date Added', type: 'date' },
    { key: 'Pet Name', label: 'Pet Name', type: 'text' },
    { key: 'Species', label: 'Species', type: 'text' },
    { key: 'Breed', label: 'Breed', type: 'text' },
    { key: 'Household', label: 'Household', type: 'text' },
    { key: 'Active', label: 'Active', type: 'badge' },
  ];

  return {
    rows,
    columns,
    kpis: [
      { label: 'New Pets', value: newPets.length },
      { label: 'Date Range', value: `${filters.dateFrom} — ${filters.dateTo}` },
    ],
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
  };
}

async function runCustomerList(filters: ReportFilters): Promise<ReportResult> {
  const households: any[] = await apiFetch(`${CUSTOMERS_URL}/households`);
  const filtered = filters.includeInactive
    ? households
    : households.filter((h) => h.status === 'active');

  const rows = await Promise.all(
    filtered.map(async (hh: any) => {
      let petCount = 0;
      try {
        const pets = await apiFetch(`${CUSTOMERS_URL}/households/${hh.id}/pets`);
        petCount = pets.filter((p: any) => !p.deleted_at && p.is_active !== false).length;
      } catch { /* skip */ }
      return {
        'Household Name': hh.household_name || hh.name || '',
        'Status': hh.status || 'active',
        'VIP': hh.is_vip ? 'Yes' : 'No',
        'Payment Hold': hh.payment_hold ? 'Yes' : 'No',
        'Active Pets': petCount,
        'Primary Contact': hh.primary_contact_name || '',
        'Primary Email': hh.primary_contact_email || '',
        'Primary Phone': hh.primary_contact_phone || '',
        'Location': hh.location || '',
        'Created': hh.created_at ? hh.created_at.split('T')[0] : '',
      };
    })
  );

  const columns: ReportColumn[] = [
    { key: 'Household Name', label: 'Household Name', type: 'text' },
    { key: 'Status', label: 'Status', type: 'badge' },
    { key: 'VIP', label: 'VIP', type: 'badge' },
    { key: 'Payment Hold', label: 'Payment Hold', type: 'badge' },
    { key: 'Active Pets', label: 'Active Pets', type: 'number' },
    { key: 'Primary Contact', label: 'Primary Contact', type: 'text' },
    { key: 'Primary Email', label: 'Email', type: 'text' },
    { key: 'Primary Phone', label: 'Phone', type: 'text' },
    { key: 'Location', label: 'Location', type: 'text' },
    { key: 'Created', label: 'Created', type: 'date' },
  ];

  const vipCount = rows.filter((r) => r['VIP'] === 'Yes').length;
  const holdCount = rows.filter((r) => r['Payment Hold'] === 'Yes').length;

  return {
    rows,
    columns,
    kpis: [
      { label: 'Total Households', value: rows.length },
      { label: 'Active', value: rows.filter((r) => r['Status'] === 'active').length },
      { label: 'VIP', value: vipCount },
      { label: 'Payment Hold', value: holdCount },
    ],
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
  };
}

async function runCustomerActivity(filters: ReportFilters): Promise<ReportResult> {
  const params = new URLSearchParams({ start_date: filters.dateFrom, end_date: filters.dateTo });
  if (filters.locationId !== 'ALL') params.set('location_id', filters.locationId);

  const [households, bookings] = await Promise.all([
    apiFetch(`${CUSTOMERS_URL}/households`),
    apiFetch(`${DAYCARE_URL}/bookings?${params}`).catch(() => []),
  ]);

  const visitMap: Record<string, { visits: number; lastVisit: string; householdName: string }> = {};

  for (const hh of households) {
    visitMap[hh.id] = {
      visits: 0,
      lastVisit: '',
      householdName: hh.household_name || hh.name || '',
    };
  }

  for (const booking of bookings) {
    const hhId = booking.household_id;
    if (!hhId || !visitMap[hhId]) continue;
    if (booking.booking_status === 'cancelled') continue;
    visitMap[hhId].visits++;
    if (!visitMap[hhId].lastVisit || booking.booking_date > visitMap[hhId].lastVisit) {
      visitMap[hhId].lastVisit = booking.booking_date;
    }
  }

  const rows = Object.entries(visitMap)
    .sort((a, b) => b[1].visits - a[1].visits)
    .map(([, v], i) => ({
      'Rank': i + 1,
      'Household': v.householdName,
      'Visits (Period)': v.visits,
      'Last Visit': v.lastVisit || '—',
    }));

  const withVisits = rows.filter((r) => r['Visits (Period)'] > 0);

  const columns: ReportColumn[] = [
    { key: 'Rank', label: 'Rank', type: 'number' },
    { key: 'Household', label: 'Household', type: 'text' },
    { key: 'Visits (Period)', label: 'Visits (Period)', type: 'number' },
    { key: 'Last Visit', label: 'Last Visit', type: 'date' },
  ];

  return {
    rows,
    columns,
    kpis: [
      { label: 'Active Households', value: withVisits.length },
      { label: 'Total Visits', value: rows.reduce((s, r) => s + r['Visits (Period)'], 0) },
      { label: 'No Pulse', value: rows.length - withVisits.length },
    ],
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
  };
}

async function runDaycareAttendance(filters: ReportFilters): Promise<ReportResult> {
  const params = new URLSearchParams({ start_date: filters.dateFrom, end_date: filters.dateTo });
  if (filters.locationId !== 'ALL') params.set('location_id', filters.locationId);

  const bookings: any[] = await apiFetch(`${DAYCARE_URL}/bookings?${params}`);

  const dayMap: Record<string, { scheduled: number; checkedIn: number; checkedOut: number; cancelled: number; noShow: number }> = {};

  for (const b of bookings) {
    const date = b.booking_date;
    if (!date) continue;
    if (!dayMap[date]) dayMap[date] = { scheduled: 0, checkedIn: 0, checkedOut: 0, cancelled: 0, noShow: 0 };

    const status = b.booking_status || '';
    const checkIn = b.check_in_status || '';

    if (status === 'cancelled') { dayMap[date].cancelled++; continue; }
    if (status === 'no_show') { dayMap[date].noShow++; continue; }
    dayMap[date].scheduled++;
    if (checkIn === 'checked_in') dayMap[date].checkedIn++;
    if (checkIn === 'checked_out') { dayMap[date].checkedIn++; dayMap[date].checkedOut++; }
  }

  const rows = Object.entries(dayMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({
      'Date': date,
      'Scheduled': d.scheduled,
      'Checked In': d.checkedIn,
      'Checked Out': d.checkedOut,
      'Cancelled': d.cancelled,
      'No Shows': d.noShow,
      'Check-in Rate (%)': d.scheduled > 0 ? parseFloat(((d.checkedIn / d.scheduled) * 100).toFixed(1)) : 0,
    }));

  const totalScheduled = rows.reduce((s, r) => s + r['Scheduled'], 0);
  const totalCheckedIn = rows.reduce((s, r) => s + r['Checked In'], 0);
  const totalCancelled = rows.reduce((s, r) => s + r['Cancelled'], 0);

  const columns: ReportColumn[] = [
    { key: 'Date', label: 'Date', type: 'date' },
    { key: 'Scheduled', label: 'Scheduled', type: 'number' },
    { key: 'Checked In', label: 'Checked In', type: 'number' },
    { key: 'Checked Out', label: 'Checked Out', type: 'number' },
    { key: 'Cancelled', label: 'Cancelled', type: 'number' },
    { key: 'No Shows', label: 'No Shows', type: 'number' },
    { key: 'Check-in Rate (%)', label: 'Check-in Rate (%)', type: 'percentage' },
  ];

  return {
    rows,
    columns,
    kpis: [
      { label: 'Total Bookings', value: totalScheduled },
      { label: 'Total Check-ins', value: totalCheckedIn },
      { label: 'Cancellations', value: totalCancelled },
      { label: 'Avg Check-in Rate', value: totalScheduled > 0 ? `${((totalCheckedIn / totalScheduled) * 100).toFixed(1)}%` : '—' },
    ],
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
  };
}

async function runServiceUtilisation(filters: ReportFilters): Promise<ReportResult> {
  const params = new URLSearchParams({ start_date: filters.dateFrom, end_date: filters.dateTo });
  if (filters.locationId !== 'ALL') params.set('location_id', filters.locationId);

  const [daycare, grooming, transport] = await Promise.all([
    apiFetch(`${DAYCARE_URL}/bookings?${params}`).catch(() => []),
    apiFetch(`${GROOMING_URL}/appointments?${params}`).catch(() => []),
    apiFetch(`${TRANSPORT_URL}/jobs?${params}`).catch(() => []),
  ]);

  const daycareCount = (daycare as any[]).filter((b) => b.booking_status !== 'cancelled').length;
  const daycareCanc = (daycare as any[]).filter((b) => b.booking_status === 'cancelled').length;
  const groomingCount = (grooming as any[]).filter((b) => b.status !== 'cancelled').length;
  const groomingCanc = (grooming as any[]).filter((b) => b.status === 'cancelled').length;
  const transportCount = (transport as any[]).filter((b) => b.status !== 'cancelled').length;
  const transportCanc = (transport as any[]).filter((b) => b.status === 'cancelled').length;
  const total = daycareCount + groomingCount + transportCount;

  const rows = [
    { 'Service': 'Daycare', 'Bookings': daycareCount, 'Cancellations': daycareCanc, 'Share (%)': total > 0 ? parseFloat(((daycareCount / total) * 100).toFixed(1)) : 0 },
    { 'Service': 'Grooming', 'Bookings': groomingCount, 'Cancellations': groomingCanc, 'Share (%)': total > 0 ? parseFloat(((groomingCount / total) * 100).toFixed(1)) : 0 },
    { 'Service': 'Transport', 'Bookings': transportCount, 'Cancellations': transportCanc, 'Share (%)': total > 0 ? parseFloat(((transportCount / total) * 100).toFixed(1)) : 0 },
  ].filter((r) => r['Bookings'] > 0 || r['Cancellations'] > 0);

  const columns: ReportColumn[] = [
    { key: 'Service', label: 'Service', type: 'text' },
    { key: 'Bookings', label: 'Bookings', type: 'number' },
    { key: 'Cancellations', label: 'Cancellations', type: 'number' },
    { key: 'Share (%)', label: 'Share (%)', type: 'percentage' },
  ];

  return {
    rows,
    columns,
    kpis: [
      { label: 'Total Bookings', value: total },
      { label: 'Daycare', value: daycareCount },
      { label: 'Grooming', value: groomingCount },
      { label: 'Transport', value: transportCount },
    ],
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
  };
}
