import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Syringe, CheckCircle2, XCircle, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import { projectId } from '../../../../../utils/supabase/info';

const FN_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal-admin`;

const VAX_TYPES = [
  { value: 'rabies', label: 'Rabies' },
  { value: 'dhpp', label: 'DHPP' },
  { value: 'bordetella', label: 'Bordetella' },
  { value: 'leptospirosis', label: 'Leptospirosis' },
  { value: 'influenza', label: 'Canine influenza' },
  { value: 'other', label: 'Other' },
];

export interface QueueItem {
  id: string;
  petId: string;
  petName: string | null;
  householdId: string;
  householdName: string | null;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  proposedVaxType: string | null;
  proposedIssuedAt: string | null;
  proposedExpiresAt: string | null;
  proposedNotes: string | null;
  submittedAt: string;
  viewUrl: string | null;
}

export function VaxReviewPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FN_BASE}/vax-queue`, { headers });
      if (res.ok) {
        const body = await res.json();
        setItems(body.items ?? []);
      } else {
        toast.error('Could not load queue');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Syringe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Vaccination Review</h1>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Loading…' : `${items.length} pending from the owner portal`}
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
            <p className="font-medium">Queue empty</p>
            <p className="text-sm text-muted-foreground mt-1">
              Owners' uploads will appear here for your review.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <ReviewCard item={item} onResolved={load} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Exported for the Portal Inbox's Vaccinations tab (PendingRequestsPage),
// which renders the same review cards — the review logic lives here only.
export function ReviewCard({ item, onResolved }: { item: QueueItem; onResolved: () => void }) {
  const [vaccinationType, setVaccinationType] = useState(item.proposedVaxType ?? 'rabies');
  const [dateAdministered, setDateAdministered] = useState(item.proposedIssuedAt?.slice(0, 10) ?? '');
  const [nextDueDate, setNextDueDate] = useState(item.proposedExpiresAt?.slice(0, 10) ?? '');
  const [vaccinationName, setVaccinationName] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [vetClinicName, setVetClinicName] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function approve() {
    if (!dateAdministered) { toast.error('Date administered required'); return; }
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FN_BASE}/vax-queue/${item.id}/approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          vaccinationType,
          dateAdministered: new Date(dateAdministered).toISOString(),
          nextDueDate: nextDueDate ? new Date(nextDueDate).toISOString() : null,
          vaccinationName: vaccinationName || null,
          batchNumber: batchNumber || null,
          vetClinicName: vetClinicName || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast.success('Approved — vaccination added to pet record');
      onResolved();
    } catch (e: any) {
      toast.error(e?.message ?? 'Approve failed');
    } finally { setBusy(false); }
  }

  async function reject() {
    if (reason.trim().length < 3) { toast.error('Reason must be at least 3 characters'); return; }
    setBusy(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${FN_BASE}/vax-queue/${item.id}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast.success('Rejected');
      onResolved();
    } catch (e: any) {
      toast.error(e?.message ?? 'Reject failed');
    } finally { setBusy(false); }
  }

  const ageHours = (Date.now() - new Date(item.submittedAt).getTime()) / 3_600_000;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{item.petName ?? 'Unknown pet'}</CardTitle>
            <CardDescription>
              {item.householdName ?? 'Unknown household'} · submitted {Math.round(ageHours * 10) / 10}h ago
            </CardDescription>
          </div>
          <Badge variant={item.proposedVaxType ? 'secondary' : 'outline'}>
            {item.proposedVaxType ?? 'Type not suggested'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          {item.viewUrl ? (
            item.mimeType.startsWith('image/') ? (
              <img src={item.viewUrl} alt="Certificate" className="w-full rounded-md border" />
            ) : (
              <iframe src={item.viewUrl} className="w-full h-96 rounded-md border" title="Certificate" />
            )
          ) : (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No preview available
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {item.mimeType} · {(item.fileSize / 1024).toFixed(0)} KB
            {item.viewUrl && (
              <a href={item.viewUrl} target="_blank" rel="noreferrer" className="ml-2 underline">Open in new tab</a>
            )}
          </p>
          {item.proposedNotes && (
            <div className="mt-3 p-3 rounded-md bg-muted text-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Owner note</p>
              {item.proposedNotes}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor={`type-${item.id}`}>Vaccination type</Label>
              <Select value={vaccinationType} onValueChange={setVaccinationType}>
                <SelectTrigger id={`type-${item.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VAX_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`admin-${item.id}`}>Date administered</Label>
              <Input id={`admin-${item.id}`} type="date" value={dateAdministered} onChange={e => setDateAdministered(e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`due-${item.id}`}>Next due</Label>
              <Input id={`due-${item.id}`} type="date" value={nextDueDate} onChange={e => setNextDueDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`name-${item.id}`}>Product name <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id={`name-${item.id}`} value={vaccinationName} onChange={e => setVaccinationName(e.target.value)} placeholder="e.g. Nobivac DHP" />
            </div>
            <div>
              <Label htmlFor={`batch-${item.id}`}>Batch # <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id={`batch-${item.id}`} value={batchNumber} onChange={e => setBatchNumber(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label htmlFor={`clinic-${item.id}`}>Vet clinic <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input id={`clinic-${item.id}`} value={vetClinicName} onChange={e => setVetClinicName(e.target.value)} placeholder="Clinic name" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={approve} disabled={busy} className="flex-1">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
            </Button>
            <Button variant="outline" onClick={() => setRejecting(v => !v)} className="border-destructive/30 text-destructive hover:bg-destructive/5">
              <XCircle className="h-4 w-4 mr-2" /> Reject
            </Button>
          </div>

          {rejecting && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor={`reason-${item.id}`}>Reason (visible to owner)</Label>
              <Textarea id={`reason-${item.id}`} rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Certificate is not legible — please re-upload a clearer photo." />
              <Button onClick={reject} disabled={busy} variant="destructive" size="sm">
                Confirm reject
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
