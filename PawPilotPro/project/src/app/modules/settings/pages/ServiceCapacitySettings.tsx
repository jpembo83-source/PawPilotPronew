import React, { useState, useEffect, useCallback } from 'react';
import { Save, Gauge, Sun, Moon, Scissors, Car, RotateCcw, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

/**
 * Tenant-level daily caps for each service. These are the defaults the
 * Portal Inbox capacity-snapshot endpoint compares against when staff is
 * reviewing pending bookings — "would approving this push the day over
 * capacity?"
 *
 * Per-location daycare overrides live on the Location settings page
 * (`capacity.maxDogs`). This page is the only place the four-service
 * tenant-wide defaults can be edited.
 *
 * Backend keys + endpoints:
 *   - KV record: settings:capacity:{tenantId}
 *   - GET  /portal-admin/settings/capacity   → current + defaults per service
 *   - PUT  /portal-admin/settings/capacity   → upsert
 */

const FN_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin`;

const SERVICES: ReadonlyArray<{
  key: 'daycare' | 'overnights' | 'grooming' | 'transport';
  label: string;
  unit: string;
  icon: typeof Sun;
  tone: string;
  help: string;
}> = [
  { key: 'daycare',    label: 'Daycare',    unit: 'dogs per day',     icon: Sun,      tone: 'bg-amber-50 border-amber-200',  help: 'How many dogs you can take in a single day across all locations.' },
  { key: 'overnights', label: 'Overnights', unit: 'reservations',     icon: Moon,     tone: 'bg-indigo-50 border-indigo-200', help: 'Concurrent overnight reservations on any given night.' },
  { key: 'grooming',   label: 'Grooming',   unit: 'appointments',     icon: Scissors, tone: 'bg-pink-50 border-pink-200',     help: 'Salon appointments you can fit in one day.' },
  { key: 'transport',  label: 'Transport',  unit: 'jobs',             icon: Car,      tone: 'bg-emerald-50 border-emerald-200', help: 'Pickup + drop-off jobs the van fleet can run.' },
];

interface ServiceState { daily: string; isDefault: boolean; default: number }

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${publicAnonKey}`,
    'X-User-Token': `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

export function ServiceCapacitySettings() {
  const [state, setState] = useState<Record<string, ServiceState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${FN_BASE}/settings/capacity`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const incoming: Record<string, ServiceState> = {};
      for (const svc of SERVICES) {
        const c = body.capacity?.[svc.key] ?? { daily: 0, isDefault: true, default: 0 };
        incoming[svc.key] = {
          daily: String(c.daily ?? c.default ?? 0),
          isDefault: !!c.isDefault,
          default: Number(c.default ?? 0),
        };
      }
      setState(incoming);
      setDirty(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to load capacity');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function updateField(key: string, value: string) {
    // Allow empty during typing — server treats unset as default.
    setState((s) => ({ ...s, [key]: { ...s[key]!, daily: value, isDefault: value === '' } }));
    setDirty(true);
  }

  function resetField(key: string) {
    setState((s) => ({
      ...s,
      [key]: { ...s[key]!, daily: String(s[key]!.default), isDefault: true },
    }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, { daily: number } | undefined> = {};
      for (const svc of SERVICES) {
        const v = state[svc.key]?.daily ?? '';
        if (v === '' || v === null) { payload[svc.key] = undefined; continue; }
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          toast.error(`${svc.label}: enter a positive number or leave blank`);
          setSaving(false);
          return;
        }
        payload[svc.key] = { daily: n };
      }
      const headers = await authHeaders();
      const res = await fetch(`${FN_BASE}/settings/capacity`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ capacity: payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast.success('Capacity caps saved');
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-md bg-primary/10">
            <Gauge className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">Service Capacity</h2>
        </div>
        <p className="text-sm text-slate-500">
          Daily caps used by the Portal Inbox to flag overbooking before you approve a request.
          Per-location daycare overrides live on the <strong>Locations</strong> page; the values
          here are the tenant-wide defaults the rest of the platform falls back to.
        </p>
      </header>

      <div className="flex items-start gap-2.5 rounded-md bg-blue-50 border border-blue-200 text-blue-900 text-sm px-4 py-3 mb-6">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          Leaving a field blank reverts to the platform default
          {' ('}
          {SERVICES
            .map((s) => `${s.label.toLowerCase()} ${state[s.key]?.default ?? '—'}`)
            .join(' · ')}
          {'). '}
          The Portal Inbox capacity widget picks up changes on its next refresh.
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm mb-6">
        <ul className="divide-y divide-slate-100">
          {SERVICES.map((svc) => {
            const s = state[svc.key];
            const Icon = svc.icon;
            return (
              <li key={svc.key} className="flex items-center gap-4 px-6 py-5">
                <div className={`h-11 w-11 rounded-xl border grid place-items-center shrink-0 ${svc.tone}`}>
                  <Icon className="h-5 w-5 text-slate-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{svc.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{svc.help}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={500}
                    disabled={loading || saving}
                    value={s?.daily ?? ''}
                    placeholder={String(s?.default ?? '')}
                    onChange={(e) => updateField(svc.key, e.target.value)}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm tabular-nums text-right"
                  />
                  <span className="text-xs text-slate-500 w-32">{svc.unit}</span>
                  {!s?.isDefault && (
                    <button
                      type="button"
                      onClick={() => resetField(svc.key)}
                      disabled={loading || saving}
                      className="press p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      title="Reset to default"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-center justify-end gap-3">
        {dirty && !saving && (
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            Discard changes
          </button>
        )}
        <button
          type="button"
          onClick={save}
          disabled={loading || saving || !dirty}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold shadow-sm disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save capacity'}
        </button>
      </div>
    </div>
  );
}
