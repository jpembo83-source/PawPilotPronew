// Add photos — zero-decision bulk capture for operators. Snap or pick many
// photos, pick nothing else: no dog, no note. Every photo lands in the
// manager review queue as pending + UNASSIGNED; the manager assigns the dog
// at approval (DaycarePhotoReview). The per-dog "share one now" path
// (ShareMomentModal) is untouched.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../../context/AuthContext';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import {
  ArrowLeft,
  Camera,
  Check,
  CircleNotch,
  Images,
  UploadSimple,
  Warning,
  X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';

const UPLOAD_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/pet-updates/upload`;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 20;

type FileStatus = 'queued' | 'uploading' | 'done' | 'failed';

interface QueuedFile {
  key: string;
  file: File;
  preview: string;
  status: FileStatus;
  error?: string;
}

export function DaycarePhotoUpload() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { locations, fetchLocations } = useSettingsStore();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  // One dump = one batch: the server issues the id on the first file and the
  // rest of the run reuses it so the review queue groups them together.
  const batchIdRef = useRef<string | null>(null);

  const activeLocations = useMemo(
    () => locations.filter(l => l && l.isActive !== false),
    [locations],
  );
  const [locationId, setLocationId] = useState<string>(
    selectedLocationId !== 'ALL' ? selectedLocationId : '',
  );

  useEffect(() => {
    if (locations.length === 0) void fetchLocations();
  }, [locations.length, fetchLocations]);

  // Single-location tenants never see the prompt.
  useEffect(() => {
    if (!locationId && activeLocations.length === 1) {
      setLocationId(activeLocations[0].id);
    }
  }, [locationId, activeLocations]);

  useEffect(() => () => {
    // Revoke previews on unmount.
    setFiles(prev => {
      prev.forEach(f => URL.revokeObjectURL(f.preview));
      return prev;
    });
  }, []);

  const canPost = ['admin', 'manager', 'assistant_manager', 'staff'].includes(user?.role ?? '');
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next: QueuedFile[] = [];
    for (const file of Array.from(picked)) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name}: photos only`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: must be under 5MB`);
        continue;
      }
      next.push({
        key: `${file.name}-${file.size}-${crypto.randomUUID().slice(0, 6)}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'queued',
      });
    }
    setFiles(prev => {
      const merged = [...prev, ...next];
      if (merged.length > MAX_FILES) {
        toast.error(`Max ${MAX_FILES} photos per dump — extra ones were dropped`);
      }
      return merged.slice(0, MAX_FILES);
    });
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (libraryInputRef.current) libraryInputRef.current.value = '';
  };

  const removeFile = (key: string) => {
    setFiles(prev => {
      const target = prev.find(f => f.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter(f => f.key !== key);
    });
  };

  const setStatus = (key: string, status: FileStatus, error?: string) => {
    setFiles(prev => prev.map(f => (f.key === key ? { ...f, status, error } : f)));
  };

  // Sequential per-file uploads: real per-file progress, and one failure
  // never voids the rest of the dump.
  const uploadAll = async () => {
    if (uploading || !locationId) return;
    const queue = files.filter(f => f.status === 'queued' || f.status === 'failed');
    if (queue.length === 0) return;
    setUploading(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const item of queue) {
        setStatus(item.key, 'uploading');
        try {
          const formData = new FormData();
          formData.append('location_id', locationId);
          if (batchIdRef.current) formData.append('upload_batch_id', batchIdRef.current);
          formData.append('files', item.file);

          // Multipart: strip the JSON Content-Type the shared util adds.
          const auth: Record<string, string> = { ...(await getAuthHeaders()) };
          delete auth['Content-Type'];
          const res = await fetch(UPLOAD_URL, { method: 'POST', headers: auth, body: formData });
          const body = (await res.json().catch(() => ({}))) as {
            upload_batch_id?: string;
            uploaded?: number;
            failed?: Array<{ name: string; error: string }>;
            error?: string;
          };
          if (!res.ok) throw new Error(body.error || 'Upload failed');
          if (body.upload_batch_id) batchIdRef.current = body.upload_batch_id;
          if ((body.uploaded ?? 0) < 1) {
            throw new Error(body.failed?.[0]?.error || 'Upload failed');
          }
          setStatus(item.key, 'done');
          ok += 1;
        } catch (err) {
          setStatus(item.key, 'failed', err instanceof Error ? err.message : 'Upload failed');
          failed += 1;
        }
      }
    } finally {
      setUploading(false);
    }
    if (ok > 0) {
      toast.success(
        `${ok} photo${ok !== 1 ? 's' : ''} sent for review — a manager will match the dogs`,
      );
    }
    if (failed > 0) toast.error(`${failed} photo${failed !== 1 ? 's' : ''} failed — tap Upload to retry`);
  };

  if (!canPost) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-[#E2DED8] p-6 text-center text-sm text-[#6B6762]">
          Photo upload is for the daycare team.
        </div>
      </div>
    );
  }

  const pendingCount = files.filter(f => f.status === 'queued' || f.status === 'failed').length;
  const doneCount = files.filter(f => f.status === 'done').length;

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
          <h1 className="text-2xl font-bold text-[#1C1916]">Add photos</h1>
          <p className="text-sm text-[#6B6762] mt-0.5">
            Snap away — no need to pick dogs. A manager matches and approves before owners see anything.
          </p>
        </div>
      </div>

      {/* Location — prompted once per dump when several are possible */}
      {activeLocations.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[#6B6762]">Where were these taken?</span>
          <div className="flex flex-wrap gap-2">
            {activeLocations.map(loc => (
              <button
                key={loc.id}
                onClick={() => setLocationId(loc.id)}
                disabled={uploading}
                className={`h-11 rounded-xl px-4 text-sm font-semibold border transition-colors disabled:opacity-40 ${
                  locationId === loc.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-[#1C1916] border-[#E2DED8] hover:border-primary'
                }`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Picker — two paths on purpose: `capture` forces the camera on
          phones (great for snapping in the yard, but it BYPASSES the photo
          library), so a second capture-less input is required to let
          operators upload photos already on the phone. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading || files.length >= MAX_FILES}
          className="h-28 rounded-2xl border-2 border-dashed border-[#D4CFC9] hover:border-primary hover:bg-primary-tint transition-colors flex flex-col items-center justify-center gap-1.5 text-[#6B6762] disabled:opacity-40"
        >
          <Camera size={26} weight="duotone" />
          <span className="text-sm font-medium">Take photos</span>
        </button>
        <button
          onClick={() => libraryInputRef.current?.click()}
          disabled={uploading || files.length >= MAX_FILES}
          className="h-28 rounded-2xl border-2 border-dashed border-[#D4CFC9] hover:border-primary hover:bg-primary-tint transition-colors flex flex-col items-center justify-center gap-1.5 text-[#6B6762] disabled:opacity-40"
        >
          <Images size={26} weight="duotone" />
          <span className="text-sm font-medium">
            {files.length === 0 ? 'Upload from phone' : 'Add more'}
          </span>
        </button>
      </div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={e => addFiles(e.target.files)}
        className="hidden"
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={e => addFiles(e.target.files)}
        className="hidden"
      />

      {/* Queue */}
      {files.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {files.map(item => (
              <div key={item.key} className="relative aspect-square rounded-xl overflow-hidden bg-white border border-[#E2DED8]">
                <img src={item.preview} alt={item.file.name} className="absolute inset-0 w-full h-full object-cover" />
                {item.status === 'queued' && !uploading && (
                  <button
                    onClick={() => removeFile(item.key)}
                    aria-label={`Remove ${item.file.name}`}
                    className="absolute top-1.5 right-1.5 h-8 w-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70"
                  >
                    <X size={13} />
                  </button>
                )}
                {item.status !== 'queued' && (
                  <div className={`absolute inset-x-0 bottom-0 py-1 flex items-center justify-center gap-1 text-white text-sm font-medium ${
                    item.status === 'done' ? 'bg-primary/85'
                      : item.status === 'failed' ? 'bg-[#B3261E]/90'
                      : 'bg-black/55'
                  }`}>
                    {item.status === 'uploading' && <><CircleNotch size={13} className="animate-spin" /> Uploading</>}
                    {item.status === 'done' && <><Check size={13} weight="bold" /> Sent</>}
                    {item.status === 'failed' && <><Warning size={13} weight="bold" /> Failed</>}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => void uploadAll()}
            disabled={uploading || pendingCount === 0 || !locationId}
            className="w-full h-12 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ background: 'var(--primary)' }}
          >
            {uploading
              ? <><CircleNotch size={16} className="animate-spin" /> Uploading…</>
              : <><UploadSimple size={16} weight="bold" /> Upload {pendingCount > 0 ? pendingCount : ''} photo{pendingCount !== 1 ? 's' : ''}</>}
          </button>
          {!locationId && activeLocations.length > 1 && (
            <p className="text-sm text-[#6B6762] text-center">Pick a location first.</p>
          )}
          {doneCount > 0 && !uploading && isManager && (
            <button
              onClick={() => { void navigate('/daycare/photo-review'); }}
              className="w-full h-11 rounded-xl border border-[#E2DED8] bg-white text-sm font-semibold text-[#1C1916] hover:border-primary transition-colors"
            >
              Go match the dogs → Photo review
            </button>
          )}
        </>
      )}
    </div>
  );
}
