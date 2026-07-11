// Photo review queue — the manager curation gate, now an ASSIGN-and-approve
// surface. Bulk-captured photos arrive pending + unassigned (no dog); the
// manager matches each photo to a dog from a visual roster of that
// location's checked-in dogs (search-all fallback), then approves. Approval
// requires a pet — the server refuses unassigned approvals — and fires the
// batched owner notification. Photos shared per-dog (ShareMomentModal) still
// arrive pre-assigned and keep the v1 approve/caption/reject flow below.
// Mobile-first: this is a couch-on-the-phone task.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../context/AuthContext';
import { useSettingsStore } from '../../settings/store';
import {
  ArrowLeft,
  Camera,
  Check,
  Checks,
  CircleNotch,
  Dog,
  MagnifyingGlass,
  X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/pet-updates`;

interface PendingMoment {
  id: string;
  pet_id?: string | null;
  pet_name?: string | null;
  text?: string;
  photo_url?: string;
  created_at: string;
  created_by_name: string;
  location_id?: string | null;
  upload_batch_id?: string | null;
}

interface Candidate {
  pet_id: string;
  pet_name: string;
  household_id: string | null;
  photo_url: string | null;
  source: 'checked_in' | 'search';
}

interface Batch {
  key: string;
  locationId: string | null;
  date: string;
  uploaderName: string;
  firstAt: string;
  items: PendingMoment[];
}

const CAN_REVIEW_ROLES = ['admin', 'manager'];

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...(await getAuthHeaders()), ...(init?.headers as Record<string, string> | undefined) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

/** Round-robin avatar or initial for a candidate dog. */
function CandidateAvatar({ candidate }: { candidate: Candidate }) {
  return candidate.photo_url ? (
    <img
      src={candidate.photo_url}
      alt={candidate.pet_name}
      className="h-14 w-14 rounded-full object-cover bg-[#F4F3EF]"
    />
  ) : (
    <div className="h-14 w-14 rounded-full bg-primary-tint text-primary flex items-center justify-center">
      <Dog size={24} weight="duotone" />
    </div>
  );
}

export function DaycarePhotoReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReview = CAN_REVIEW_ROLES.includes(user?.role ?? '');
  const { locations, fetchLocations } = useSettingsStore();

  const [pending, setPending] = useState<PendingMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [confirmingReject, setConfirmingReject] = useState<string | null>(null);

  // ---- assign state (unassigned batches) --------------------------------
  /** Staged manager picks, applied at "Approve" via bulk assign+approve. */
  const [staged, setStaged] = useState<Record<string, Candidate>>({});
  /** Roster cache per location|date. */
  const [rosters, setRosters] = useState<Record<string, Candidate[]>>({});
  /** Which photo(s) the dog picker is open for. */
  const [picking, setPicking] = useState<{ batchKey: string; photoIds: string[] } | null>(null);
  /** Consecutive-default: the last picked dog carries to the next photo. */
  const [carry, setCarry] = useState<Record<string, Candidate>>({});
  /** Multi-select mode per batch. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);

  const locationName = useCallback(
    (id: string | null) => (id && locations.find(l => l && l.id === id)?.name) || 'Unknown location',
    [locations],
  );

  const loadQueue = useCallback(async () => {
    try {
      const body = await api<{ updates: PendingMoment[] }>('/review-queue');
      setPending(body.updates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load the review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canReview) return;
    void loadQueue();
    if (locations.length === 0) void fetchLocations();
  }, [canReview, loadQueue, locations.length, fetchLocations]);

  const unassigned = useMemo(() => pending.filter(p => !p.pet_id), [pending]);
  const assigned = useMemo(() => pending.filter(p => !!p.pet_id), [pending]);

  // One operator dump = one batch (location + upload_batch_id); loose
  // unassigned photos fall into a per-location bucket.
  const batches = useMemo<Batch[]>(() => {
    const map = new Map<string, Batch>();
    for (const item of unassigned) {
      const key = `${item.location_id ?? 'none'}::${item.upload_batch_id ?? 'loose'}`;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        if (item.created_at < existing.firstAt) existing.firstAt = item.created_at;
      } else {
        map.set(key, {
          key,
          locationId: item.location_id ?? null,
          date: item.created_at.split('T')[0],
          uploaderName: item.created_by_name,
          firstAt: item.created_at,
          items: [item],
        });
      }
    }
    return [...map.values()].sort((a, b) => b.firstAt.localeCompare(a.firstAt));
  }, [unassigned]);

  // Per-dog groups for the already-assigned section (v1 flow).
  const assignedGroups = useMemo(() => {
    const byPet = new Map<string, { petName: string; items: PendingMoment[] }>();
    for (const item of assigned) {
      const petId = item.pet_id as string;
      const group = byPet.get(petId);
      if (group) group.items.push(item);
      else byPet.set(petId, { petName: item.pet_name ?? 'Unknown', items: [item] });
    }
    return [...byPet.entries()].map(([petId, group]) => ({ petId, ...group }));
  }, [assigned]);

  const rosterKey = (batch: Batch) => `${batch.locationId ?? 'ALL'}|${batch.date}`;

  const loadRoster = useCallback(async (batch: Batch) => {
    const key = rosterKey(batch);
    if (rosters[key]) return;
    try {
      const params = new URLSearchParams({ date: batch.date });
      if (batch.locationId) params.set('location_id', batch.locationId);
      const body = await api<{ candidates: Candidate[] }>(`/review-queue/candidates?${params}`);
      setRosters(prev => ({ ...prev, [key]: body.candidates }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load the checked-in dogs");
    }
  }, [rosters]);

  const runSearch = async () => {
    const q = search.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      const body = await api<{ candidates: Candidate[] }>(
        `/review-queue/candidates?q=${encodeURIComponent(q)}`,
      );
      setSearchResults(body.candidates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const markBusy = (ids: string[], busy: boolean) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (busy) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const openPicker = (batch: Batch, photoIds: string[]) => {
    setPicking({ batchKey: batch.key, photoIds });
    setSearch('');
    setSearchResults(null);
    void loadRoster(batch);
  };

  const assignCandidate = (candidate: Candidate) => {
    if (!picking) return;
    setStaged(prev => {
      const next = { ...prev };
      for (const id of picking.photoIds) next[id] = candidate;
      return next;
    });
    setCarry(prev => ({ ...prev, [picking.batchKey]: candidate }));
    setSelected(new Set());
    setSelectMode(null);
    setPicking(null);
  };

  const clearStaged = (photoId: string) => {
    setStaged(prev => {
      const next = { ...prev };
      delete next[photoId];
      return next;
    });
  };

  // Assign + approve the batch's staged photos in one call → one batched
  // owner notification per household+pet on the server.
  const approveBatch = async (batch: Batch) => {
    const items = batch.items
      .filter(item => staged[item.id])
      .map(item => ({ id: item.id, pet_id: staged[item.id].pet_id }));
    if (items.length === 0) {
      toast.error('Assign a dog to at least one photo first');
      return;
    }
    const ids = items.map(i => i.id);
    markBusy(ids, true);
    try {
      const body = await api<{ approved: number; unassigned: number; notFound: number }>(
        '/moments/approve',
        { method: 'POST', body: JSON.stringify({ items }) },
      );
      setPending(prev => prev.filter(p => !ids.includes(p.id)));
      setStaged(prev => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
      toast.success(`Approved ${body.approved} photo${body.approved !== 1 ? 's' : ''} — owners notified`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      markBusy(ids, false);
    }
  };

  const review = async (item: PendingMoment, action: 'approve' | 'reject') => {
    markBusy([item.id], true);
    try {
      const caption = captions[item.id]?.trim();
      await api(`/moment/${item.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(action === 'approve' && caption ? { caption } : {}),
      });
      setPending(prev => prev.filter(p => p.id !== item.id));
      toast.success(
        action === 'approve'
          ? `Approved — ${item.pet_name ?? 'the'} owner will be notified`
          : 'Discarded — it will never reach an owner',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      markBusy([item.id], false);
      setConfirmingReject(prev => (prev === item.id ? null : prev));
    }
  };

  const approveAllForPet = async (petName: string, items: PendingMoment[]) => {
    const ids = items.map(i => i.id);
    markBusy(ids, true);
    try {
      await api('/moments/approve', { method: 'POST', body: JSON.stringify({ ids }) });
      setPending(prev => prev.filter(p => !ids.includes(p.id)));
      toast.success(`Approved ${ids.length} photo${ids.length !== 1 ? 's' : ''} of ${petName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      markBusy(ids, false);
    }
  };

  if (!canReview) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-[#E2DED8] p-6 text-center text-sm text-[#6B6762]">
          The photo review queue is for managers.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6 bg-[#F4F3EF] min-h-full max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { void navigate('/daycare'); }}
          aria-label="Back to daycare"
          className="h-11 w-11 rounded-xl border border-[#E2DED8] bg-white flex items-center justify-center hover:border-primary transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-[#1C1916]" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#1C1916]">Photo review</h1>
          <p className="text-sm text-[#6B6762] mt-0.5">
            {loading
              ? 'Loading…'
              : pending.length === 0
                ? 'All clear — nothing waiting'
                : `${unassigned.length} to match · ${assigned.length} to approve · owners are only notified once you approve`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#6B6762]">
          <CircleNotch size={24} className="animate-spin" />
        </div>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E2DED8] p-10 flex flex-col items-center gap-2 text-center">
          <Camera size={32} weight="duotone" className="text-primary" />
          <p className="text-sm font-medium text-[#1C1916]">The queue is empty</p>
          <p className="text-sm text-[#6B6762]">New photos from the yard will appear here for matching and approval.</p>
        </div>
      ) : (
        <>
          {/* ── Unassigned dumps: match the dogs ── */}
          {batches.map(batch => {
            const stagedCount = batch.items.filter(i => staged[i.id]).length;
            const batchBusy = batch.items.some(i => busyIds.has(i.id));
            const inSelectMode = selectMode === batch.key;
            const carried = carry[batch.key];
            const pickerCandidates: Candidate[] | null =
              searchResults ?? rosters[rosterKey(batch)] ?? null;
            return (
              <section key={batch.key} className="bg-white rounded-2xl border border-[#E2DED8] p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[#1C1916]">
                      {batch.items.length} photo{batch.items.length !== 1 ? 's' : ''} to match
                    </h2>
                    <p className="text-sm text-[#6B6762]">
                      {locationName(batch.locationId)} · {timeOf(batch.firstAt)} · by {batch.uploaderName}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectMode(inSelectMode ? null : batch.key);
                      setSelected(new Set());
                    }}
                    className="h-11 rounded-xl px-3 text-sm font-semibold border border-[#E2DED8] bg-white text-[#1C1916] hover:border-primary transition-colors"
                  >
                    {inSelectMode ? 'Done' : 'Select'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {batch.items.map(item => {
                    const pick = staged[item.id];
                    const isSelected = selected.has(item.id);
                    return (
                      <div key={item.id} className="relative rounded-xl overflow-hidden border border-[#E2DED8] bg-[#F4F3EF]">
                        <button
                          className="block w-full"
                          onClick={() => {
                            if (inSelectMode) {
                              setSelected(prev => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id);
                                else next.add(item.id);
                                return next;
                              });
                            } else {
                              openPicker(batch, [item.id]);
                            }
                          }}
                          aria-label={inSelectMode ? 'Select photo' : 'Choose a dog for this photo'}
                        >
                          {item.photo_url ? (
                            <img src={item.photo_url} alt="Pending" className="w-full aspect-square object-cover" />
                          ) : (
                            <div className="w-full aspect-square flex items-center justify-center text-sm text-[#6B6762]">
                              Photo unavailable
                            </div>
                          )}
                        </button>
                        {inSelectMode && (
                          <div className={`absolute top-2 left-2 h-7 w-7 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'bg-primary border-primary text-white' : 'bg-white/80 border-[#D4CFC9]'
                          }`}>
                            {isSelected && <Check size={14} weight="bold" />}
                          </div>
                        )}
                        <div className="p-2 flex flex-col gap-1.5">
                          {pick ? (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-sm font-semibold text-primary truncate">{pick.pet_name}</span>
                              <button
                                onClick={() => clearStaged(item.id)}
                                aria-label={`Clear ${pick.pet_name}`}
                                className="h-8 w-8 rounded-full flex items-center justify-center text-[#6B6762] hover:bg-[#F4F3EF]"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <button
                                onClick={() => openPicker(batch, [item.id])}
                                className="h-9 rounded-lg border border-[#E2DED8] bg-white text-sm font-semibold text-[#1C1916] hover:border-primary transition-colors"
                              >
                                Choose dog
                              </button>
                              {carried && (
                                <button
                                  onClick={() => setStaged(prev => ({ ...prev, [item.id]: carried }))}
                                  className="h-9 rounded-lg bg-primary-tint text-sm font-semibold text-primary hover:opacity-80 transition-opacity"
                                >
                                  Same dog: {carried.pet_name}
                                </button>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => setConfirmingReject(item.id)}
                            disabled={busyIds.has(item.id)}
                            className="h-8 text-sm font-medium text-[#B3261E] hover:underline disabled:opacity-40"
                          >
                            {confirmingReject === item.id ? '' : 'Discard'}
                          </button>
                          {confirmingReject === item.id && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => setConfirmingReject(null)}
                                className="flex-1 h-9 rounded-lg border border-[#E2DED8] bg-white text-sm font-semibold"
                              >
                                Keep
                              </button>
                              <button
                                onClick={() => void review(item, 'reject')}
                                className="flex-1 h-9 rounded-lg bg-[#B3261E] text-white text-sm font-semibold"
                              >
                                Discard
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {inSelectMode && selected.size > 0 && (
                  <button
                    onClick={() => openPicker(batch, [...selected])}
                    className="h-12 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    style={{ background: 'var(--primary)' }}
                  >
                    <Dog size={16} weight="bold" />
                    Assign {selected.size} photo{selected.size !== 1 ? 's' : ''} to one dog
                  </button>
                )}

                {/* Dog picker: visual roster scoped to the location's checked-in dogs */}
                {picking?.batchKey === batch.key && (
                  <div className="rounded-xl border border-[#E2DED8] bg-[#FBFAF8] p-3 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#1C1916]">
                        Who is {picking.photoIds.length > 1 ? `in these ${picking.photoIds.length} photos` : 'this'}?
                      </span>
                      <button
                        onClick={() => setPicking(null)}
                        aria-label="Close dog picker"
                        className="h-9 w-9 rounded-full flex items-center justify-center text-[#6B6762] hover:bg-white"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void runSearch(); }}
                        placeholder="Not checked in? Search all pets…"
                        className="flex-1 px-3 py-2.5 rounded-xl border border-[#E2DED8] bg-white text-base md:text-sm text-[#1C1916] placeholder:text-tertiary-foreground outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => void runSearch()}
                        disabled={searching || !search.trim()}
                        aria-label="Search pets"
                        className="h-11 w-11 rounded-xl border border-[#E2DED8] bg-white flex items-center justify-center hover:border-primary disabled:opacity-40"
                      >
                        {searching ? <CircleNotch size={16} className="animate-spin" /> : <MagnifyingGlass size={16} />}
                      </button>
                    </div>
                    {searchResults !== null && (
                      <button
                        onClick={() => { setSearchResults(null); setSearch(''); }}
                        className="self-start text-sm font-medium text-primary hover:underline"
                      >
                        ← Back to checked-in dogs
                      </button>
                    )}
                    {pickerCandidates === null ? (
                      <div className="flex items-center justify-center py-6 text-[#6B6762]">
                        <CircleNotch size={20} className="animate-spin" />
                      </div>
                    ) : pickerCandidates.length === 0 ? (
                      <p className="text-sm text-[#6B6762] py-4 text-center">
                        {searchResults !== null ? 'No pets match that name.' : 'No dogs checked in here that day — try the search.'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {pickerCandidates.map(candidate => (
                          <button
                            key={candidate.pet_id}
                            onClick={() => assignCandidate(candidate)}
                            className="flex flex-col items-center gap-1.5 rounded-xl border border-[#E2DED8] bg-white p-3 hover:border-primary hover:bg-primary-tint transition-colors active:scale-[0.98]"
                          >
                            <CandidateAvatar candidate={candidate} />
                            <span className="text-sm font-semibold text-[#1C1916] truncate max-w-full">
                              {candidate.pet_name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => void approveBatch(batch)}
                  disabled={batchBusy || stagedCount === 0}
                  className="h-12 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
                  style={{ background: 'var(--primary)' }}
                >
                  {batchBusy
                    ? <><CircleNotch size={16} className="animate-spin" /> Approving…</>
                    : <><Checks size={16} weight="bold" /> Approve {stagedCount > 0 ? stagedCount : ''} matched photo{stagedCount !== 1 ? 's' : ''}</>}
                </button>
              </section>
            );
          })}

          {/* ── Already assigned: the v1 approve/caption/reject flow ── */}
          {assignedGroups.map(group => (
            <section key={group.petId} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#1C1916]">
                  {group.petName}
                  <span className="ml-2 text-sm font-normal text-[#6B6762]">
                    {group.items.length} pending
                  </span>
                </h2>
                {group.items.length > 1 && (
                  <button
                    onClick={() => void approveAllForPet(group.petName, group.items)}
                    disabled={group.items.some(i => busyIds.has(i.id))}
                    className="h-11 rounded-xl px-4 text-sm font-semibold text-white flex items-center gap-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
                    style={{ background: 'var(--primary)' }}
                  >
                    <Checks size={16} weight="bold" />
                    Approve all
                  </button>
                )}
              </div>

              {group.items.map(item => {
                const busy = busyIds.has(item.id);
                const rejecting = confirmingReject === item.id;
                return (
                  <div key={item.id} className="bg-white rounded-2xl border border-[#E2DED8] overflow-hidden">
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={`Pending photo of ${item.pet_name ?? 'a dog'}`}
                        className="w-full max-h-96 object-cover bg-[#F4F3EF]"
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center text-sm text-[#6B6762] bg-[#F4F3EF]">
                        Photo unavailable
                      </div>
                    )}
                    <div className="p-4 flex flex-col gap-3">
                      {item.text && <p className="text-sm text-[#1C1916]">“{item.text}”</p>}
                      <p className="text-sm text-[#6B6762]">
                        {timeOf(item.created_at)} · by {item.created_by_name}
                      </p>
                      <input
                        value={captions[item.id] ?? ''}
                        onChange={e => setCaptions(prev => ({ ...prev, [item.id]: e.target.value }))}
                        maxLength={280}
                        placeholder="Caption for the owner (optional)…"
                        className="w-full px-4 py-3 rounded-xl border border-[#E2DED8] bg-[#F4F3EF] text-base md:text-sm text-[#1C1916] placeholder:text-tertiary-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                      />
                      {rejecting ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmingReject(null)}
                            disabled={busy}
                            className="flex-1 h-11 rounded-xl border border-[#E2DED8] bg-white text-sm font-semibold text-[#1C1916] hover:border-primary transition-colors disabled:opacity-40"
                          >
                            Keep it
                          </button>
                          <button
                            onClick={() => void review(item, 'reject')}
                            disabled={busy}
                            className="flex-1 h-11 rounded-xl bg-[#B3261E] text-white text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-40"
                          >
                            {busy ? <CircleNotch size={16} className="animate-spin" /> : <X size={16} weight="bold" />}
                            Confirm reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmingReject(item.id)}
                            disabled={busy}
                            className="h-11 rounded-xl px-4 border border-[#E2DED8] bg-white text-sm font-semibold text-[#B3261E] hover:border-[#B3261E] transition-colors disabled:opacity-40"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => void review(item, 'approve')}
                            disabled={busy}
                            className="flex-1 h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
                            style={{ background: 'var(--primary)' }}
                          >
                            {busy ? <CircleNotch size={16} className="animate-spin" /> : <Check size={16} weight="bold" />}
                            Approve
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
