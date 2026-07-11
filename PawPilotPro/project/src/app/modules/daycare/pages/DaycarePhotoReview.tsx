// Photo review queue — the manager curation gate for "Share a moment".
// Operators' photos land here as `pending`, pre-tagged to a dog; nothing
// reaches the owner until it is approved from this screen. Mobile-first:
// this is a couch-on-the-phone task.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../context/AuthContext';
import {
  ArrowLeft,
  Camera,
  Check,
  Checks,
  CircleNotch,
  X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/pet-updates`;

interface PendingMoment {
  id: string;
  pet_id: string;
  pet_name: string;
  text?: string;
  photo_url?: string;
  created_at: string;
  created_by_name: string;
}

const CAN_REVIEW_ROLES = ['admin', 'manager'];

export function DaycarePhotoReview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReview = CAN_REVIEW_ROLES.includes(user?.role ?? '');

  const [pending, setPending] = useState<PendingMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [confirmingReject, setConfirmingReject] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/review-queue`, { headers: await getAuthHeaders() });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to load the review queue');
      }
      const body = (await res.json()) as { updates: PendingMoment[] };
      setPending(body.updates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load the review queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canReview) void loadQueue();
  }, [canReview, loadQueue]);

  // Capture-time tagging means the queue arrives pre-sorted: group by dog so
  // the manager confirms a batch per pet instead of matching loose photos.
  const groups = useMemo(() => {
    const byPet = new Map<string, { petName: string; items: PendingMoment[] }>();
    for (const item of pending) {
      const group = byPet.get(item.pet_id);
      if (group) group.items.push(item);
      else byPet.set(item.pet_id, { petName: item.pet_name, items: [item] });
    }
    return [...byPet.entries()].map(([petId, group]) => ({ petId, ...group }));
  }, [pending]);

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

  const review = async (item: PendingMoment, action: 'approve' | 'reject') => {
    markBusy([item.id], true);
    try {
      const caption = captions[item.id]?.trim();
      const res = await fetch(`${BASE_URL}/moment/${item.id}/${action}`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(action === 'approve' && caption ? { caption } : {}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed to ${action}`);
      }
      setPending(prev => prev.filter(p => p.id !== item.id));
      toast.success(
        action === 'approve'
          ? `Approved — ${item.pet_name}'s owner will be notified`
          : 'Rejected — it will never reach the owner',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      markBusy([item.id], false);
      setConfirmingReject(prev => (prev === item.id ? null : prev));
    }
  };

  const approveAll = async (petId: string, petName: string, items: PendingMoment[]) => {
    const ids = items.map(i => i.id);
    markBusy(ids, true);
    try {
      const res = await fetch(`${BASE_URL}/moments/approve`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to approve');
      }
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
                : `${pending.length} photo${pending.length !== 1 ? 's' : ''} waiting · owners are only notified once you approve`}
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
          <p className="text-sm text-[#6B6762]">New photos from the yard will appear here for approval.</p>
        </div>
      ) : (
        groups.map(group => (
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
                  onClick={() => void approveAll(group.petId, group.petName, group.items)}
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
                      alt={`Pending photo of ${item.pet_name}`}
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
                      {new Date(item.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}by {item.created_by_name}
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
        ))
      )}
    </div>
  );
}
