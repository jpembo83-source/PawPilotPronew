import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';
import {
  Syringe,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAuthHeaders } from '../../../../../utils/supabase/authHeaders';
import { projectId } from '../../../../../../utils/supabase/info';
import { useSettingsStore } from '../../../settings/store';
import { broadcastMutation } from '../../../../lib/realtimeBroadcast';
import {
  scheduleForRegion,
  type VaccineScheduleItem,
  type VaccinationType,
} from '../../constants/vaccineSchedules';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

/**
 * Wire shape of vaccination:{tenant}:{petId}:{id} records — the SAME records
 * VaxReviewPage certificate approvals create, the pet-profile stat card
 * counts, and the portal's vaccination status reads. This component is a
 * front-desk entry point into that one store; there is deliberately no
 * separate "checklist" data model (the old pet.vaccinations map is gone).
 */
interface VaccinationRecord {
  id: string;
  vaccination_type: VaccinationType;
  vaccination_name?: string;
  date_administered: string;
  next_due_date?: string;
  /** Present when the record was promoted from an owner-uploaded certificate. */
  document_id?: string;
  created_by?: string;
  created_by_name?: string;
}

interface VaccinationManagerProps {
  petId: string;
  /** Fired after any successful change so the parent can refresh stat cards. */
  onChanged?: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved';

function toDateOnly(d: Date): string {
  return d.toISOString().split('T')[0];
}

function computeOverallStatus(records: VaccinationRecord[]): {
  status: 'up_to_date' | 'expiring_soon' | 'expired' | 'unknown';
  earliestExpiry?: string;
} {
  const withDue = records.filter((r) => r.next_due_date);
  if (withDue.length === 0) return { status: 'unknown' };

  const todayStr = toDateOnly(new Date());
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const thirtyDaysStr = toDateOnly(thirtyDays);

  const earliest = withDue
    .map((r) => r.next_due_date!)
    .sort()[0];

  if (earliest < todayStr) return { status: 'expired', earliestExpiry: earliest };
  if (earliest <= thirtyDaysStr) return { status: 'expiring_soon', earliestExpiry: earliest };
  return { status: 'up_to_date', earliestExpiry: earliest };
}

/** Latest record per vaccine type (by date administered). */
function latestByType(records: VaccinationRecord[]): Map<VaccinationType, VaccinationRecord> {
  const map = new Map<VaccinationType, VaccinationRecord>();
  for (const r of records) {
    const cur = map.get(r.vaccination_type);
    if (!cur || r.date_administered > cur.date_administered) {
      map.set(r.vaccination_type, r);
    }
  }
  return map;
}

export function VaccinationManager({ petId, onChanged }: VaccinationManagerProps) {
  const { organisation } = useSettingsStore();
  const schedule = scheduleForRegion(organisation.vaccinationSchedule);
  const regionLabel = (organisation.vaccinationSchedule ?? 'uk') === 'ch' ? 'Switzerland' : 'the UK';

  const [records, setRecords] = useState<VaccinationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Local expiry drafts so typing isn't clobbered by refetches mid-debounce. */
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/pets/${petId}/vaccinations`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { vaccinations?: VaccinationRecord[] };
      setRecords(body.vaccinations ?? []);
    } catch {
      toast.error('Could not load vaccination records');
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => () => {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const flashSaved = () => {
    setSaveState('saved');
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2500);
  };

  const afterChange = async () => {
    await load();
    setExpiryDrafts({});
    onChanged?.();
    void broadcastMutation('customers', 'pet', 'updated', petId, { action: 'vaccination_updated' });
  };

  const createRecord = async (item: VaccineScheduleItem) => {
    setSaveState('saving');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/pets/${petId}/vaccinations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vaccination_type: item.type,
          date_administered: toDateOnly(new Date()),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await afterChange();
      flashSaved();
    } catch (e) {
      setSaveState('idle');
      toast.error(e instanceof Error ? e.message : 'Could not record vaccination');
    }
  };

  const deleteRecord = async (record: VaccinationRecord) => {
    setSaveState('saving');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/pets/${petId}/vaccinations/${record.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await afterChange();
      flashSaved();
    } catch (e) {
      setSaveState('idle');
      toast.error(e instanceof Error ? e.message : 'Could not remove record');
    }
  };

  const saveExpiry = async (record: VaccinationRecord, nextDueDate: string) => {
    setSaveState('saving');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/pets/${petId}/vaccinations/${record.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ next_due_date: nextDueDate || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await afterChange();
      flashSaved();
    } catch (e) {
      setSaveState('idle');
      toast.error(e instanceof Error ? e.message : 'Could not save expiry date');
    }
  };

  // Debounced (500ms) expiry save — kept from the original component so a
  // typed date doesn't fire a request per keystroke.
  const handleExpiryChange = (record: VaccinationRecord, value: string) => {
    setExpiryDrafts((prev) => ({ ...prev, [record.id]: value }));
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    expiryTimerRef.current = setTimeout(() => {
      void saveExpiry(record, value);
    }, 500);
  };

  const latest = latestByType(records);
  const scheduledTypes = new Set<VaccinationType>(schedule.map((s) => s.type));
  const otherRecords = records.filter((r) => !scheduledTypes.has(r.vaccination_type));

  const overall = computeOverallStatus(records);
  const overallDisplay =
    overall.status === 'up_to_date'
      ? { Icon: ShieldCheck, label: 'Up to Date', className: 'text-green-600' }
      : overall.status === 'expiring_soon'
      ? { Icon: AlertTriangle, label: 'Expiring Soon', className: 'text-orange-600' }
      : overall.status === 'expired'
      ? { Icon: ShieldAlert, label: 'Action Required', className: 'text-red-600' }
      : { Icon: AlertCircle, label: 'No Records', className: 'text-slate-500' };

  const entryStatus = (record: VaccinationRecord) => {
    if (!record.next_due_date) return { label: 'Done', className: 'bg-green-100 text-green-800 border-0' };
    const todayStr = toDateOnly(new Date());
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    if (record.next_due_date < todayStr) return { label: 'Expired', className: 'bg-red-100 text-red-800 border-0' };
    if (record.next_due_date <= toDateOnly(thirtyDays)) return { label: 'Expiring Soon', className: 'bg-orange-100 text-orange-800 border-0' };
    return { label: 'Valid', className: 'bg-green-100 text-green-800 border-0' };
  };

  const provenance = (record: VaccinationRecord) =>
    record.document_id
      ? { Icon: FileCheck2, label: 'Verified from certificate' }
      : { Icon: UserRound, label: record.created_by_name ? `Entered by ${record.created_by_name}` : 'Entered by staff' };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Syringe className="h-5 w-5" />
            <div>
              <CardTitle>Vaccinations</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <overallDisplay.Icon className={`h-4 w-4 ${overallDisplay.className}`} />
                <span className={`text-sm font-medium ${overallDisplay.className}`}>
                  {overallDisplay.label}
                </span>
              </div>
            </div>
          </div>
          {/* Save indicator — staff must be able to trust the silent
              debounced save, so its state is always visible here. */}
          <div className="text-sm text-slate-500 flex items-center gap-1.5" role="status">
            {saveState === 'saving' && (<><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>)}
            {saveState === 'saved' && (<><CheckCircle2 className="h-4 w-4 text-green-600" /> Saved</>)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500 mb-4">
          Standard vaccinations for dogs in {regionLabel}. Tick a vaccination to record it
          (e.g. from a paper certificate at the desk) and set its expiry date.
        </p>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : (
          <div className="space-y-3">
            {schedule.map((vac) => {
              const record = latest.get(vac.type);
              const status = record ? entryStatus(record) : null;
              const certVerified = !!record?.document_id;
              const prov = record ? provenance(record) : null;

              return (
                <div
                  key={vac.type}
                  className={`p-3 rounded-lg border transition-colors ${
                    record
                      ? status?.label === 'Expired'
                        ? 'bg-red-50 border-red-200'
                        : status?.label === 'Expiring Soon'
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-green-50 border-green-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <label className={`flex items-center gap-3 flex-1 min-w-0 ${certVerified ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={!!record}
                        disabled={saveState === 'saving' || certVerified}
                        onChange={(e) => {
                          if (e.target.checked) void createRecord(vac);
                          else if (record) void deleteRecord(record);
                        }}
                        className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed flex-shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-slate-900">{vac.label}</span>
                          {vac.required && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700">
                              Required
                            </Badge>
                          )}
                          {status && (
                            <Badge className={`text-[10px] px-1.5 py-0 ${status.className}`}>
                              {status.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{vac.description}</p>
                        {prov && (
                          <p className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1">
                            <prov.Icon className="h-3.5 w-3.5" />
                            {prov.label}
                            {certVerified && ' — manage via the Portal Inbox'}
                          </p>
                        )}
                      </div>
                    </label>

                    {record && (
                      <div className="flex-shrink-0 w-36">
                        <label htmlFor={`expiry-${vac.type}`} className="text-[10px] text-slate-500 block mb-0.5">Expiry Date</label>
                        <Input
                          id={`expiry-${vac.type}`}
                          type="date"
                          value={expiryDrafts[record.id] ?? record.next_due_date ?? ''}
                          onChange={(e) => handleExpiryChange(record, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {otherRecords.length > 0 && (
              <div className="pt-2">
                <p className="text-sm font-medium text-slate-700 mb-2">Other records</p>
                <ul className="space-y-2">
                  {otherRecords.map((r) => {
                    const prov = provenance(r);
                    return (
                      <li key={r.id} className="p-3 rounded-lg border bg-slate-50 border-slate-200 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-slate-900">
                            {r.vaccination_name || r.vaccination_type}
                          </span>
                          <Badge className={`text-[10px] px-1.5 py-0 ${entryStatus(r).className}`}>
                            {entryStatus(r).label}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1">
                          <prov.Icon className="h-3.5 w-3.5" />
                          {prov.label}
                          {' · administered '}
                          {new Date(r.date_administered).toLocaleDateString('en-GB')}
                          {r.next_due_date ? ` · next due ${new Date(r.next_due_date).toLocaleDateString('en-GB')}` : ''}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
