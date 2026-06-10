import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import { Calendar, CheckCircle2, XCircle, Loader2, AlertTriangle, Sparkles, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

const FN_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin`;

const SERVICE_LABEL: Record<string, string> = {
  daycare: 'Daycare',
  grooming: 'Grooming',
  overnights: 'Overnights',
  transport: 'Transport',
};

interface ChildRequest {
  id: string;
  service: string;
  startAt: string;
  endAt: string;
}

/** Per (date, service) snapshot returned by /portal-admin/capacity-snapshot. */
interface CapacitySnapshot {
  date: string;
  service: string;
  booked: number;
  capacity: number;
  available: number;
  utilizationPercent: number;
  status: 'available' | 'limited' | 'full' | 'overbooked';
}

type SnapshotMap = Record<string, CapacitySnapshot>;
const snapshotKey = (date: string, service: string) => `${date}|${service}`;

interface PendingRequest {
  id: string;
  service: string;
  householdId: string;
  householdName: string | null;
  petIds: string[];
  petNames?: string[];
  startAt: string;
  endAt: string;
  notes: string | null;
  createdAt: string;
  // Bundle-aware fields. When `kind` is "bundle_parent", `childRequests` is
  // the rendered line items inside this card; approving the parent
  // cascades server-side, so we still have one Approve/Decline button.
  kind?: 'bundle_parent' | 'bundle_child';
  services?: string[];
  childRequests?: ChildRequest[];
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${publicAnonKey}`,
    'X-User-Token': `Bearer ${session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

export function PendingRequestsPage() {
  const [items, setItems] = useState<PendingRequest[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotMap>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${FN_BASE}/pending-requests`, { headers });
      if (res.ok) {
        const body = await res.json();
        setItems(body.requests ?? []);
      } else toast.error('Could not load pending requests');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Whenever the queue changes, fetch a fresh capacity snapshot for every
  // (date, service) line the inbox shows. Server dedupes; we just hand it
  // a flat list of pairs from both single requests and bundle children.
  useEffect(() => {
    if (items.length === 0) { setSnapshots({}); return; }

    const pairs: Array<{ date: string; service: string }> = [];
    for (const r of items) {
      if (r.kind === 'bundle_parent' && Array.isArray(r.childRequests)) {
        for (const line of r.childRequests) {
          pairs.push({ date: line.startAt.slice(0, 10), service: line.service });
        }
      } else {
        pairs.push({ date: r.startAt.slice(0, 10), service: r.service });
      }
    }

    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${FN_BASE}/capacity-snapshot`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ pairs }),
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setSnapshots(body.snapshots ?? {});
      } catch {
        // Non-fatal — the page works without the capacity context, it's
        // just less informative.
      }
    })();
    return () => { cancelled = true; };
  }, [items]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Pending Requests</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${items.length} booking requests from the owner portal`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </header>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="font-medium">Inbox empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Owner-submitted bookings will appear here for your approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => <li key={r.id}><RequestRow r={r} snapshots={snapshots} onResolved={load} /></li>)}
        </ul>
      )}
    </div>
  );
}

function RequestRow({ r, snapshots, onResolved }: { r: PendingRequest; snapshots: SnapshotMap; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  const ageHours = (Date.now() - new Date(r.createdAt).getTime()) / 3_600_000;
  const stale = ageHours > 4;

  async function approve() {
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${FN_BASE}/bookings/${r.id}/approve`, { method: 'POST', headers });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast.success('Approved');
      onResolved();
    } catch (e: any) { toast.error(e?.message ?? 'Approve failed'); } finally { setBusy(false); }
  }

  async function decline() {
    if (reason.trim().length < 3) { toast.error('Reason must be at least 3 characters'); return; }
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${FN_BASE}/bookings/${r.id}/decline`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast.success('Declined');
      onResolved();
    } catch (e: any) { toast.error(e?.message ?? 'Decline failed'); } finally { setBusy(false); }
  }

  const isBundle = r.kind === 'bundle_parent' && Array.isArray(r.childRequests) && r.childRequests.length > 0;
  const titleLabel = isBundle
    ? `Bundle · ${r.childRequests!.length} services`
    : SERVICE_LABEL[r.service] ?? r.service;

  return (
    <Card className={stale ? 'border-amber-300' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {isBundle && <Sparkles className="h-4 w-4 text-primary" />}
              {titleLabel}
              {isBundle && (
                <Badge variant="outline" className="border-primary/30 text-primary text-xs gap-1">
                  Atomic
                </Badge>
              )}
              {stale && <Badge variant="outline" className="border-amber-400 text-amber-700 text-xs gap-1">
                <AlertTriangle className="h-3 w-3" /> Stale
              </Badge>}
            </CardTitle>
            <CardDescription>
              {r.householdName ? (
                <Link to={`/customers/${r.householdId}`} className="underline">{r.householdName}</Link>
              ) : 'Unknown household'}
              {' · '}
              submitted {Math.round(ageHours * 10) / 10}h ago
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isBundle ? (
          <div className="space-y-3">
            <ul className="divide-y rounded-md border bg-muted/30">
              {r.childRequests!.map((line) => {
                const snap = snapshots[snapshotKey(line.startAt.slice(0, 10), line.service)];
                return (
                  <li key={line.id} className="px-3 py-2.5 text-sm space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{SERVICE_LABEL[line.service] ?? line.service}</div>
                      <div className="text-muted-foreground tabular-nums text-xs">
                        {new Date(line.startAt).toLocaleString(undefined, {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                        {' – '}
                        {new Date(line.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <CapacityLine snap={snap} />
                  </li>
                );
              })}
            </ul>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Pets</dt>
                <dd className="font-medium">{r.petNames?.length ? r.petNames.join(', ') : `${r.petIds.length} pet(s)`}</dd>
              </div>
              {r.notes && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Owner note</dt>
                  <dd className="italic">"{r.notes}"</dd>
                </div>
              )}
            </dl>
            <p className="text-xs text-muted-foreground">
              Approve / decline applies to the whole bundle — there's no per-line decision.
            </p>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Start</dt>
                <dd className="font-medium">{new Date(r.startAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">End</dt>
                <dd className="font-medium">{new Date(r.endAt).toLocaleString()}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Pets</dt>
                <dd className="font-medium">{r.petNames?.length ? r.petNames.join(', ') : `${r.petIds.length} pet(s)`}</dd>
              </div>
              {r.notes && (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Owner note</dt>
                  <dd className="italic">"{r.notes}"</dd>
                </div>
              )}
            </dl>
            {/* Decision support: how booked is the date already? */}
            <CapacityLine snap={snapshots[snapshotKey(r.startAt.slice(0, 10), r.service)]} />
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={approve} disabled={busy} className="flex-1">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {isBundle ? 'Approve bundle' : 'Approve'}
          </Button>
          <Button variant="outline" onClick={() => setDeclining((v) => !v)}
                  className="border-destructive/30 text-destructive hover:bg-destructive/5">
            <XCircle className="h-4 w-4 mr-2" />
            {isBundle ? 'Decline bundle' : 'Decline'}
          </Button>
        </div>
        {declining && (
          <div className="space-y-2 pt-2 border-t">
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason (visible to the owner)" />
            <Button onClick={decline} disabled={busy} variant="destructive" size="sm">Confirm decline</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Inline capacity context for a single (date, service) line.
 *
 *   Daycare · 22/30 booked · 8 left  → 23/30 if approved   (limited)
 *
 * Shows nothing while the snapshot is loading or absent — better a quiet
 * card than a flickering placeholder. The "would become" arrow is the
 * single-line approver's-eye-view of the decision.
 */
function CapacityLine({ snap }: { snap: CapacitySnapshot | undefined }) {
  if (!snap) return null;

  const tone =
    snap.status === 'overbooked' ? 'border-destructive/40 bg-destructive/5 text-destructive'
    : snap.status === 'full'     ? 'border-amber-300 bg-amber-50 text-amber-800'
    : snap.status === 'limited'  ? 'border-amber-200 bg-amber-50/60 text-amber-900'
    :                              'border-muted bg-muted/40 text-muted-foreground';

  const projected = snap.booked + 1;
  const projectedHits = projected > snap.capacity || (projected / snap.capacity) > 0.95;

  return (
    <div className={`mt-1 flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs tabular-nums ${tone}`}>
      <Gauge className="h-3.5 w-3.5 shrink-0" />
      <span>
        <span className="font-semibold">{snap.booked}/{snap.capacity}</span> booked
        {snap.available > 0 ? ` · ${snap.available} left` : ''}
        {' → '}
        <span className={projectedHits ? 'font-semibold' : ''}>{projected}/{snap.capacity}</span>{' '}
        if approved
      </span>
      <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold">
        {snap.status === 'overbooked' ? 'Overbooked'
         : snap.status === 'full' ? 'Full'
         : snap.status === 'limited' ? 'Limited'
         : `${snap.utilizationPercent}% util`}
      </span>
    </div>
  );
}
