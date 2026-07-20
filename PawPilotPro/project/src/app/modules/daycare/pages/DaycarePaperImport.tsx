// Import from paper — photograph the owner's handwritten daycare page, let
// the server parse it into draft bookings, and confirm/correct/discard each
// row. Human-in-the-loop: NOTHING books until someone taps Confirm (or
// Confirm all, which only takes rows already vetted as ready).

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Camera,
  CaretDown,
  CaretUp,
  Check,
  Checks,
  CircleNotch,
  Images,
  MagnifyingGlass,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { useNotepadStore, type NotepadDraft, type NotepadPage, type RosterCandidate } from '../notepadStore';
import { ALL_SESSIONS, SESSION_DETAILS, type DaycareSession } from '../lib/multiDayBooking';

const STATUS_LABELS: Record<NotepadDraft['status'], { label: string; className: string }> = {
  ready: { label: 'Ready', className: 'bg-emerald-100 text-emerald-700' },
  needs_review: { label: 'Needs review', className: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Booked', className: 'bg-primary-tint text-primary' },
  discarded: { label: 'Discarded', className: 'bg-slate-100 text-slate-500' },
};

/** Rough visual snippet: the page photo cropped to sit around the row's
 *  vertical band (best-effort — the full page is one tap away). */
function RowSnippet({ photoUrl, yTop, yBottom }: { photoUrl?: string; yTop?: number; yBottom?: number }) {
  if (!photoUrl) return null;
  const center = yTop !== undefined && yBottom !== undefined ? (yTop + yBottom) / 2 : 0.5;
  return (
    <a href={photoUrl} target="_blank" rel="noreferrer" className="block shrink-0" title="Open the full page photo">
      <img
        src={photoUrl}
        alt="Handwritten row on the page"
        className="h-12 w-36 rounded-lg border border-[#E2DED8] object-cover"
        style={{ objectPosition: `center ${center * 100}%` }}
      />
    </a>
  );
}

/** Inline dog picker: match candidates as one-tap chips + roster search. */
function DogPicker({
  draft,
  onPick,
}: {
  draft: NotepadDraft;
  onPick: (petId: string) => void;
}) {
  const { searchCandidates } = useNotepadStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RosterCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      searchCandidates(query)
        .then(setResults)
        .catch(() => {
          /* silent — the chips still work */
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="space-y-1.5">
      {draft.candidates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {draft.candidates.map((candidate) => (
            <button
              key={candidate.pet_id}
              type="button"
              onClick={() => onPick(candidate.pet_id)}
              className="h-9 px-3 rounded-full border border-slate-200 text-sm font-medium text-slate-700 hover:border-primary hover:bg-primary-tint transition-colors"
            >
              {candidate.pet_name}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the roster…"
          className="pl-8 h-9 text-sm"
        />
        {searching && (
          <CircleNotch size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" aria-hidden="true" />
        )}
      </div>
      {results.length > 0 && (
        <div className="rounded-lg border divide-y max-h-44 overflow-y-auto bg-white">
          {results.map((candidate) => (
            <button
              key={candidate.pet_id}
              type="button"
              onClick={() => {
                onPick(candidate.pet_id);
                setQuery('');
                setResults([]);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 min-h-[44px] text-left hover:bg-slate-50"
            >
              {candidate.photo_url ? (
                <img src={candidate.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="h-7 w-7 rounded-full bg-primary-tint text-primary text-sm font-semibold flex items-center justify-center">
                  {candidate.pet_name.charAt(0)}
                </span>
              )}
              <span className="text-sm font-medium text-slate-800">{candidate.pet_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DraftRow({ page, draft }: { page: NotepadPage; draft: NotepadDraft }) {
  const { updateDraft, confirmDraft } = useNotepadStore();
  const [busy, setBusy] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const status = STATUS_LABELS[draft.status];
  const actionable = draft.status === 'ready' || draft.status === 'needs_review';

  const patch = async (
    body: { pet_id?: string | null; session?: DaycareSession; date?: string; status?: 'discarded' },
    successMessage?: string,
  ) => {
    setBusy(true);
    try {
      await updateDraft(page.id, draft.id, body);
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the row');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await confirmDraft(page.id, draft.id);
      toast.success(`${draft.matched_pet_name ?? 'Dog'} booked for ${draft.date}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not book this row');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-xl border p-3 space-y-2 ${
        draft.status === 'needs_review' ? 'border-amber-300 bg-amber-50/50' : 'border-[#E2DED8] bg-white'
      } ${draft.status === 'discarded' ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <RowSnippet photoUrl={page.photo_url} yTop={draft.y_top} yBottom={draft.y_bottom} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              Written: <span className="font-semibold text-slate-900">“{draft.dog_name_as_written}”</span>
            </span>
            <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${status.className}`}>
              {draft.status === 'needs_review' && <Warning size={12} className="inline mr-1 align-[-1px]" aria-hidden="true" />}
              {status.label}
            </span>
          </div>
          <p className="text-sm text-slate-700 mt-0.5">
            {draft.matched_pet_id ? (
              <>
                Dog: <span className="font-semibold">{draft.matched_pet_name}</span>
                {actionable && (
                  <button
                    type="button"
                    onClick={() => setShowPicker((v) => !v)}
                    className="ml-2 text-primary hover:underline text-sm font-medium"
                  >
                    change
                  </button>
                )}
              </>
            ) : (
              <span className="text-amber-800 font-medium">No confident match — pick the dog below</span>
            )}
            {draft.status === 'confirmed' && ' · booked'}
          </p>
          {draft.review_reasons.includes('low_read_confidence') && draft.status !== 'confirmed' && (
            <p className="text-sm text-amber-800 mt-0.5">
              Hard to read ({Math.round(draft.parse_confidence * 100)}%) — check the snippet before confirming.
            </p>
          )}
        </div>
      </div>

      {actionable && (showPicker || !draft.matched_pet_id) && (
        <DogPicker draft={draft} onPick={(petId) => { void patch({ pet_id: petId }); setShowPicker(false); }} />
      )}

      {actionable && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {ALL_SESSIONS.map((session) => (
              <button
                key={session}
                type="button"
                disabled={busy}
                onClick={() => void patch({ session })}
                aria-pressed={draft.session === session}
                className={`h-11 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  draft.session === session
                    ? 'border-primary bg-primary-tint text-primary'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {SESSION_DETAILS[session].shortLabel}
              </button>
            ))}
          </div>
          <Input
            type="date"
            value={draft.date ?? ''}
            disabled={busy}
            onChange={(e) => {
              if (e.target.value) void patch({ date: e.target.value });
            }}
            className="h-11 w-40 text-sm"
            aria-label="Booking date"
          />
          <div className="flex-1" />
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void patch({ status: 'discarded' }, 'Row discarded')}
            className="h-11"
          >
            <Trash size={15} className="mr-1.5" aria-hidden="true" /> Discard
          </Button>
          <Button
            disabled={busy || !draft.matched_pet_id || !draft.date}
            onClick={() => void handleConfirm()}
            style={{ backgroundColor: 'var(--primary)' }}
            className="h-11 text-white hover:opacity-90 disabled:opacity-50"
          >
            <Check size={15} className="mr-1.5" aria-hidden="true" /> Confirm
          </Button>
        </div>
      )}
    </div>
  );
}

function PageCard({ page }: { page: NotepadPage }) {
  const { drafts, fetchPage, parsePage, confirmAll, discardPage } = useNotepadStore();
  const [expanded, setExpanded] = useState(page.status === 'parsed');
  const [working, setWorking] = useState(false);
  const pageDrafts = drafts[page.id] ?? [];
  const readyCount = pageDrafts.filter((d) => d.status === 'ready').length;
  const reviewCount = pageDrafts.filter((d) => d.status === 'needs_review').length;

  useEffect(() => {
    if (expanded && page.status === 'parsed' && pageDrafts.length === 0) {
      void fetchPage(page.id);
    }
  }, [expanded, page.status]);

  const handleParse = async () => {
    setWorking(true);
    try {
      const rows = await parsePage(page.id);
      setExpanded(true);
      toast.success(`Read ${rows.length} row${rows.length === 1 ? '' : 's'} from the page`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read the page');
    } finally {
      setWorking(false);
    }
  };

  const handleConfirmAll = async () => {
    setWorking(true);
    try {
      const result = await confirmAll(page.id);
      if (result.failures.length > 0) {
        toast.warning(
          `Booked ${result.confirmed}; ${result.failures.length} failed (first: ${result.failures[0].dog_name_as_written} — ${result.failures[0].error})`,
        );
      } else {
        toast.success(`Booked ${result.confirmed} row${result.confirmed === 1 ? '' : 's'}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk confirm failed');
    } finally {
      setWorking(false);
    }
  };

  const uploadedLabel = new Date(page.uploaded_at).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {page.photo_url && (
          <a href={page.photo_url} target="_blank" rel="noreferrer" title="Open the full page photo">
            <img src={page.photo_url} alt="Notepad page" className="h-14 w-14 rounded-lg object-cover border border-[#E2DED8]" />
          </a>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            Week of {page.week_start}
            {page.status === 'parse_failed' && <span className="text-red-700 font-medium"> · read failed</span>}
            {page.status === 'parsing' && <span className="text-muted-foreground font-medium"> · reading…</span>}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {page.uploaded_by_name} · {uploadedLabel}
            {page.status === 'parsed' && pageDrafts.length > 0 &&
              ` · ${readyCount} ready${reviewCount ? `, ${reviewCount} to review` : ''}`}
          </p>
        </div>
        {page.status === 'uploaded' || page.status === 'parse_failed' ? (
          <Button onClick={() => void handleParse()} disabled={working} className="h-11">
            {working ? <CircleNotch size={16} className="animate-spin" aria-hidden="true" /> : 'Read page'}
          </Button>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="h-11 w-11 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-50"
            aria-label={expanded ? 'Collapse page' : 'Expand page'}
          >
            {expanded ? <CaretUp size={18} aria-hidden="true" /> : <CaretDown size={18} aria-hidden="true" />}
          </button>
        )}
      </div>

      {expanded && page.status === 'parsed' && (
        <div className="border-t px-3 py-3 space-y-2 bg-[#FAFAF8]">
          {pageDrafts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No bookings could be read from this page.</p>
          )}
          {pageDrafts.map((draft) => (
            <DraftRow key={draft.id} page={page} draft={draft} />
          ))}
          <div className="flex flex-wrap justify-between gap-2 pt-1">
            <Button variant="outline" disabled={working} onClick={() => void discardPage(page.id)} className="h-11">
              <Trash size={15} className="mr-1.5" aria-hidden="true" /> Discard page
            </Button>
            {readyCount > 0 && (
              <Button
                disabled={working}
                onClick={() => void handleConfirmAll()}
                style={{ backgroundColor: 'var(--primary)' }}
                className="h-11 text-white hover:opacity-90"
              >
                <Checks size={16} className="mr-1.5" aria-hidden="true" />
                Confirm all ready ({readyCount})
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DaycarePaperImport() {
  const navigate = useNavigate();
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { pages, isLoading, fetchPages, uploadPages, parsePage } = useNotepadStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [localLocationId, setLocalLocationId] = useState(selectedLocationId === 'ALL' ? '' : selectedLocationId);
  const [weekDate, setWeekDate] = useState(new Date().toISOString().split('T')[0]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void fetchPages();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!localLocationId) {
      toast.error('Pick a location first');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadPages(Array.from(files), localLocationId, weekDate);
      if (result.failed.length > 0) {
        toast.warning(`${result.failed.length} photo(s) rejected (${result.failed[0].error})`);
      }
      // Kick off reading each uploaded page straight away — drafts only,
      // nothing books until a human confirms.
      for (const uploadedPage of result.pages) {
        try {
          await parsePage(uploadedPage.id);
        } catch {
          /* per-page toast comes from the card's Read button on retry */
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="p-5 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { void navigate('/daycare'); }}
          className="h-11 w-11 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
          aria-label="Back to daycare"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Import from paper</h1>
          <p className="text-sm text-muted-foreground">
            Photograph the handwritten page — every row becomes a draft you confirm before it books.
          </p>
        </div>
      </div>

      {/* Capture */}
      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectedLocationId === 'ALL' && (
            <div>
              <label htmlFor="paper-location" className="block text-sm font-medium text-slate-700 mb-1">
                Location
              </label>
              <select
                id="paper-location"
                value={localLocationId}
                onChange={(e) => setLocalLocationId(e.target.value)}
                className="w-full h-11 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a location…</option>
                {locations.filter((l) => l?.isActive).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="paper-week" className="block text-sm font-medium text-slate-700 mb-1">
              Week the page describes
            </label>
            <Input
              id="paper-week"
              type="date"
              value={weekDate}
              onChange={(e) => setWeekDate(e.target.value)}
              className="h-11"
            />
            <p className="text-sm text-muted-foreground mt-1">Any day in that week works — we use its Monday.</p>
          </div>
        </div>
        {/* Two inputs: `capture` forces the camera on phones, so the gallery
            path needs its own capture-less input. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ backgroundColor: 'var(--primary)' }}
            className="h-12 text-white hover:opacity-90"
          >
            {uploading ? (
              <CircleNotch size={18} className="animate-spin mr-2" aria-hidden="true" />
            ) : (
              <Camera size={18} className="mr-2" aria-hidden="true" />
            )}
            {uploading ? 'Uploading & reading…' : 'Photograph the page'}
          </Button>
          <Button
            variant="outline"
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading}
            className="h-12"
          >
            <Images size={18} className="mr-2" aria-hidden="true" />
            Upload from gallery
          </Button>
        </div>
      </div>

      {/* Pages */}
      {isLoading && pages.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
      ) : pages.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No pages yet — photograph the owner's pad to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <PageCard key={page.id} page={page} />
          ))}
        </div>
      )}
    </div>
  );
}
