// Share a moment — staff posts a photo + one-line note to a pet's owner feed.
// Adapted from the old orphaned dashboard PhotoUploadModal, but pared down to
// the ≤3-tap reality of a busy yard: the pet is preselected from the surface
// you're already on (check-out dialog / dashboard On Site row), so it's
// (1) open → (2) pick photo → (3) Share. Note optional.
import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Camera, X, PaperPlaneTilt, CircleNotch } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import {
  prepareImageForUpload,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
} from '../../../utils/imageCompression';

const MOMENT_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/pet-updates/moment`;

export interface ShareMomentPet {
  id: string;
  name: string;
  householdId?: string;
  bookingId?: string;
}

interface ShareMomentModalProps {
  open: boolean;
  onClose: () => void;
  pet: ShareMomentPet | null;
}

export function ShareMomentModal({ open, onClose, pet }: ShareMomentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [note, setNote] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhoto(p => {
        if (p) URL.revokeObjectURL(p.preview);
        return null;
      });
      setNote('');
    }
  }, [open]);

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Photos only'); return; }
    // Downscaled on-device so full-size phone photos just work.
    const prepared = await prepareImageForUpload(file);
    if (prepared.size > MAX_UPLOAD_BYTES) {
      toast.error(`Photo must be under ${MAX_UPLOAD_LABEL}`);
      return;
    }
    setPhoto(prev => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return { file: prepared, preview: URL.createObjectURL(prepared) };
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const share = async () => {
    if (!pet || sharing) return;
    if (!photo && !note.trim()) {
      toast.error('Add a photo or a note first');
      return;
    }
    setSharing(true);
    try {
      const formData = new FormData();
      formData.append('pet_id', pet.id);
      formData.append('pet_name', pet.name);
      if (photo) formData.append('file', photo.file);
      if (note.trim()) formData.append('text', note.trim());
      if (pet.bookingId) formData.append('booking_id', pet.bookingId);
      if (pet.householdId) formData.append('household_id', pet.householdId);

      // Multipart: strip the JSON Content-Type the shared util adds — the
      // browser sets the boundary itself (same pattern as pet photo upload).
      const auth: Record<string, string> = { ...(await getAuthHeaders()) };
      delete auth['Content-Type'];
      const response = await fetch(MOMENT_URL, { method: 'POST', headers: auth, body: formData });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Failed to share');
      }
      // Photos go through the manager review queue before the owner sees
      // them; text-only notes publish straight away.
      toast.success(
        photo
          ? `Sent for review — it reaches ${pet.name}'s owner once approved`
          : `Shared to ${pet.name}'s day`,
      );
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !sharing) onClose(); }}>
      <DialogContent className="rounded-3xl max-w-sm p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera size={18} weight="duotone" style={{ color: 'var(--primary)' }} />
            Share a moment{pet ? ` — ${pet.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            Photos are checked by a manager before the owner sees them; notes go straight away.
          </DialogDescription>
        </DialogHeader>

        {/* Photo */}
        {photo ? (
          <div className="relative rounded-2xl overflow-hidden bg-[#F4F3EF]">
            <img src={photo.preview} alt="Selected moment" className="w-full max-h-64 object-cover" />
            <button
              onClick={() => setPhoto(p => { if (p) URL.revokeObjectURL(p.preview); return null; })}
              aria-label="Remove photo"
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-36 rounded-2xl border-2 border-dashed border-[#D4CFC9] hover:border-primary hover:bg-primary-tint transition-colors flex flex-col items-center justify-center gap-1.5 text-[#6B6762]"
          >
            <Camera size={28} weight="duotone" />
            <span className="text-sm font-medium">Tap to add a photo</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => void pickFile(e)}
          className="hidden"
        />

        {/* One-line note */}
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={280}
          placeholder="One line for the owner (optional)…"
          className="w-full px-4 py-3 rounded-xl border border-[#E2DED8] bg-[#F4F3EF] text-base md:text-sm text-[#1C1916] placeholder:text-tertiary-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
        />

        <button
          onClick={() => void share()}
          disabled={sharing || (!photo && !note.trim())}
          className="w-full h-11 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:opacity-90 active:opacity-80 transition-opacity"
          style={{ background: 'var(--primary)' }}
        >
          {sharing
            ? <><CircleNotch size={16} className="animate-spin" /> Sharing…</>
            : <><PaperPlaneTilt size={16} weight="bold" /> Share</>}
        </button>
      </DialogContent>
    </Dialog>
  );
}
