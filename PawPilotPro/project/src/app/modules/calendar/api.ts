import { getAuthHeaders } from '../../../utils/supabase/authHeaders';

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/calendar`;

export interface FetchCalendarParams {
  start_date: string;
  end_date: string;
  location_id?: string;
  feature?: string;
  status?: string;
  staff_id?: string;
  pet?: string;
  household?: string;
}

export async function fetchCalendarEvents(params: FetchCalendarParams) {
  const headers = await getAuthHeaders();

  const searchParams = new URLSearchParams();
  searchParams.set('start_date', params.start_date);
  searchParams.set('end_date', params.end_date);
  if (params.location_id) searchParams.set('location_id', params.location_id);
  if (params.feature) searchParams.set('feature', params.feature);
  if (params.status) searchParams.set('status', params.status);
  if (params.staff_id) searchParams.set('staff_id', params.staff_id);
  if (params.pet) searchParams.set('pet', params.pet);
  if (params.household) searchParams.set('household', params.household);

  const res = await fetch(`${BASE_URL}/events?${searchParams.toString()}`, { headers });
  if (!res.ok) {
    throw new Error(`Server error: ${res.status}`);
  }
  return res.json();
}
