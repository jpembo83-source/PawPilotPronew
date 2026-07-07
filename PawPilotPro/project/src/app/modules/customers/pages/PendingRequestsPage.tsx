import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Textarea } from '../../../components/ui/textarea';
import { Label } from '../../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Calendar, CheckCircle2, XCircle, Loader2, AlertTriangle, Sparkles, Gauge, PawPrint, Syringe } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import { projectId } from '../../../../../utils/supabase/info';
import { broadcastMutation } from '../../../lib/realtimeBroadcast';
import { useModuleRealtimeSync } from '../../../hooks/useModuleRealtimeSync';
import { ReviewCard, type QueueItem } from './VaxReviewPage';

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

/** Row shape returned by GET /portal-admin/pet-verifications. */
interface PetVerification {
  id: string;
  petId: string;
  petName: string | null;
  householdId: string;
  householdName: string | null;
  submittedAt: string;
  photoUrl: string | null;
  breed: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  microchip: string | null;
  weightKg: number | null;
  colour: string | null;
  neuteredStatus: string | null;
  petMissing?: boolean;
}

/** Tab ids double as the ?tab= query value so the vax tab is deep-linkable. */
const INBOX_TABS = ['bookings', 'pets', 'vaccinations'] as const;
type InboxTab = (typeof INBOX_TABS)[number];

export function PendingRequestsPage() {
  const [items, setItems] = useState<PendingRequest[]>([]);
  const [verifications, setVerifications] = useState<PetVerification[]>([]);
  const [vaxItems, setVaxItems] = useState<QueueItem[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotMap>({});
  const [loading, setLoading] = useState(true);

  // Active tab lives in the URL (?tab=vaccinations) so the sidebar badge,
  // the PetProfilePage chip, and the old /customers/vax-review redirect can
  // all land staff directly on the right queue.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: InboxTab = (INBOX_TABS as readonly string[]).includes(rawTab ?? '')
    ? (rawTab as InboxTab)
    : 'bookings';
  const setTab = (next: string) => {
    setSearchParams(next === 'bookings' ? {} : { tab: next }, { replace: true });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [reqRes, vRes, vaxRes] = await Promise.all([
        fetch(`${FN_BASE}/pending-requests`, { headers }),
        fetch(`${FN_BASE}/pet-verifications`, { headers }),
        fetch(`${FN_BASE}/vax-queue`, { headers }),
      ]);
      if (reqRes.ok) {
        const body = (await reqRes.json()) as { requests?: PendingRequest[] };
        setItems(body.requests ?? []);
      } else toast.error('Could not load pending requests');
      if (vRes.ok) {
        const body = (await vRes.json()) as { items?: PetVerification[] };
        setVerifications(body.items ?? []);
      } else toast.error('Could not load pet verifications');
      if (vaxRes.ok) {
        const body = (await vaxRes.json()) as { items?: QueueItem[] };
        setVaxItems(body.items ?? []);
      } else toast.error('Could not load vaccination queue');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Approve/reject in another staff client broadcasts on the customers
  // module (see broadcastMutation calls below) — refresh both queues so
  // every open inbox agrees.
  useModuleRealtimeSync('customers', load);

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
        const headers = await getAuthHeaders();
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
              {loading
                ? 'Loading…'
                : `${items.length} booking request${items.length === 1 ? '' : 's'} · ${verifications.length} pet verification${verifications.length === 1 ? '' : 's'} · ${vaxItems.length} vaccination certificate${vaxItems.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </header>

      {loading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : items.length === 0 && verifications.length === 0 && vaxItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="font-medium">Inbox empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Owner-submitted bookings, newly added pets, and vaccination certificates will appear here for your approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="bookings">
              <Calendar className="h-4 w-4" />
              Bookings
              <QueueCount n={items.length} />
            </TabsTrigger>
            <TabsTrigger value="pets">
              <PawPrint className="h-4 w-4" />
              Pet verifications
              <QueueCount n={verifications.length} />
            </TabsTrigger>
            <TabsTrigger value="vaccinations">
              <Syringe className="h-4 w-4" />
              Vaccinations
              <QueueCount n={vaxItems.length} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bookings">
            {items.length === 0 ? (
              <QueueEmpty text="No pending booking requests." />
            ) : (
              <ul className="space-y-3">
                {items.map((r) => <li key={r.id}><RequestRow r={r} snapshots={snapshots} onResolved={load} /></li>)}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="pets">
            {verifications.length === 0 ? (
              <QueueEmpty text="No pets awaiting verification." />
            ) : (
              <ul className="space-y-3">
                {verifications.map((v) => (
                  <li key={v.id}><PetVerificationRow v={v} onResolved={load} /></li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="vaccinations">
            {vaxItems.length === 0 ? (
              <QueueEmpty text="No vaccination certificates awaiting review." />
            ) : (
              <ul className="space-y-4">
                {vaxItems.map((item) => (
                  <li key={item.id}>
                    {/* Review logic lives in VaxReviewPage's ReviewCard; this
                        wrapper only adds the realtime broadcast so a second
                        staff client's inbox + badge refresh. */}
                    <ReviewCard
                      item={item}
                      onResolved={() => {
                        void broadcastMutation('customers', 'vaccination', 'updated', item.petId, { action: 'vax_reviewed' });
                        void load();
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/** Per-queue pending count rendered inside a tab trigger. */
function QueueCount({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <Badge variant="secondary" className="ml-1 px-1.5 min-w-5 justify-center tabular-nums">
      {n}
    </Badge>
  );
}

function QueueEmpty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <CheckCircle2 className="h-8 w-8 text-primary/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
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
      const headers = await getAuthHeaders();
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
      const headers = await getAuthHeaders();
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

const SEX_LABEL: Record<string, string> = { male: 'Male', female: 'Female', unknown: 'Unknown' };
const NEUTERED_LABEL: Record<string, string> = { neutered: 'Neutered', intact: 'Intact', unknown: 'Unknown' };

/**
 * One owner-added pet awaiting identity verification. Approve flips the pet
 * to verification_status: "verified" server-side (making it bookable on the
 * portal); reject requires a reason that is surfaced to the owner — same
 * review idioms as VaxReviewPage's ReviewCard.
 */
function PetVerificationRow({ v, onResolved }: { v: PetVerification; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const ageHours = (Date.now() - new Date(v.submittedAt).getTime()) / 3_600_000;
  const stale = ageHours > 24; // owners are told "usually within a working day"

  async function resolve(action: 'approve' | 'reject') {
    if (action === 'reject' && reason.trim().length < 3) {
      toast.error('Reason must be at least 3 characters');
      return;
    }
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FN_BASE}/pet-verifications/${v.id}/${action}`, {
        method: 'POST',
        headers,
        ...(action === 'reject' ? { body: JSON.stringify({ reason }) } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 410) {
        // Pet was deleted from the CRM after submission — the server cleared
        // the queue entry; refresh so the row disappears.
        toast.info(body.error ?? 'Pet record no longer exists — request cleared');
        onResolved();
        return;
      }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      toast.success(action === 'approve' ? 'Approved — pet is now bookable' : 'Rejected');
      void broadcastMutation('customers', 'pet', 'updated', v.petId, {
        action: action === 'approve' ? 'verification_approved' : 'verification_rejected',
      });
      onResolved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${action === 'approve' ? 'Approve' : 'Reject'} failed`);
    } finally { setBusy(false); }
  }

  const details: Array<{ label: string; value: string | null }> = [
    { label: 'Breed', value: v.breed },
    { label: 'Sex', value: v.sex ? SEX_LABEL[v.sex] ?? v.sex : null },
    { label: 'Date of birth', value: v.dateOfBirth ? new Date(v.dateOfBirth).toLocaleDateString() : null },
    { label: 'Microchip', value: v.microchip },
    { label: 'Weight', value: v.weightKg != null ? `${v.weightKg} kg` : null },
    { label: 'Colour', value: v.colour },
    { label: 'Neutered', value: v.neuteredStatus ? NEUTERED_LABEL[v.neuteredStatus] ?? v.neuteredStatus : null },
  ];

  return (
    <Card className={stale ? 'border-amber-300' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {v.photoUrl ? (
              <img src={v.photoUrl} alt="" className="h-10 w-10 rounded-full object-cover border" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/10 grid place-items-center">
                <PawPrint className="h-5 w-5 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {v.petName ?? 'Unknown pet'}
                <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                  New pet
                </Badge>
                {stale && <Badge variant="outline" className="border-amber-400 text-amber-700 text-xs gap-1">
                  <AlertTriangle className="h-3 w-3" /> Stale
                </Badge>}
              </CardTitle>
              <CardDescription>
                {v.householdName ? (
                  <Link to={`/customers/${v.householdId}`} className="underline">{v.householdName}</Link>
                ) : 'Unknown household'}
                {' · '}
                submitted {Math.round(ageHours * 10) / 10}h ago
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {details.map((d) => (
            <div key={d.label}>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">{d.label}</dt>
              <dd className="font-medium">{d.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
        {v.petMissing && (
          <p className="text-sm text-destructive">
            The pet record was deleted from the CRM — approving or rejecting clears this request.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={() => void resolve('approve')} disabled={busy} className="flex-1">
            <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
          </Button>
          <Button variant="outline" onClick={() => setRejecting((x) => !x)}
                  className="border-destructive/30 text-destructive hover:bg-destructive/5">
            <XCircle className="h-4 w-4 mr-2" /> Reject
          </Button>
        </div>
        {rejecting && (
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor={`pet-reject-${v.id}`}>Reason (visible to the owner)</Label>
            <Textarea id={`pet-reject-${v.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. We couldn't match the microchip number — please double-check it." />
            <Button onClick={() => void resolve('reject')} disabled={busy} variant="destructive" size="sm">
              Confirm reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
