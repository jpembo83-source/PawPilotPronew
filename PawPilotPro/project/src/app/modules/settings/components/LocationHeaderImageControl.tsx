// Settings → Locations: per-location dashboard header image.
// Upload → crop at the banner's ~7.4:1 aspect (position/zoom) → client-side
// downscale to ≤2400px wide → POST to the private tenant-assets bucket.
// The strength slider previews the REAL header treatment (same scrim/shadow
// constants the dashboard uses) so legibility is judged before saving.

import React, { useCallback, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Slider } from '../../../components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Image as ImageIcon, Trash, UploadSimple, CircleNotch } from '@phosphor-icons/react';
import { getAuthHeaders } from '@/utils/supabase/authHeaders';
import { projectId } from '../../../../../utils/supabase/info';
import type { Location } from '../store';
import {
  HEADER_IMAGE_SCRIM,
  HEADER_IMAGE_TEXT_SHADOW,
  DEFAULT_HEADER_STRENGTH,
  headerImageOpacity,
  headerObjectPosition,
} from '../../dashboard/headerImageStyle';

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;

/** Dashboard header banner aspect (~7.4:1) — the crop is locked to it. */
const HEADER_ASPECT = 7.4;
const MAX_UPLOAD_WIDTH = 2400;

async function cropToBlob(objectUrl: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not read the image'));
    el.src = objectUrl;
  });
  const outWidth = Math.min(MAX_UPLOAD_WIDTH, Math.round(area.width));
  const outHeight = Math.round(outWidth / HEADER_ASPECT);
  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, outWidth, outHeight);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error('Could not encode the image');
  return blob;
}

interface LocationHeaderImageControlProps {
  /** Existing location id, or null while creating (upload needs an id). */
  locationId: string | null;
  formData: Partial<Location>;
  setFormData: (next: Partial<Location>) => void;
}

export function LocationHeaderImageControl({ locationId, formData, setFormData }: LocationHeaderImageControlProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = formData.headerImageStrength ?? DEFAULT_HEADER_STRENGTH;
  const imageUrl = formData.headerImageUrl ?? null;

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file');
      return;
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropSrc(URL.createObjectURL(file));
  };

  const closeCropper = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCroppedArea(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmCrop = async () => {
    if (!cropSrc || !croppedArea || !locationId) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(cropSrc, croppedArea);
      if (blob.size > 8 * 1024 * 1024) {
        toast.error('Cropped image is still larger than 8MB');
        return;
      }
      const body = new FormData();
      body.append('file', new File([blob], 'header.jpg', { type: 'image/jpeg' }));
      body.append('strength', String(strength));
      body.append('focalX', '0.5');
      body.append('focalY', '0.5');
      const res = await fetch(`${API_URL}/locations/${locationId}/header-image`, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Upload failed');
      }
      const updated = (await res.json()) as Partial<Location>;
      setFormData({
        ...formData,
        headerImagePath: updated.headerImagePath,
        headerImageStrength: updated.headerImageStrength,
        headerImageFocalPoint: updated.headerImageFocalPoint,
        headerImageUrl: updated.headerImageUrl,
      });
      toast.success('Header image updated');
      closeCropper();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const removeImage = async () => {
    if (!locationId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/locations/${locationId}/header-image`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Could not remove the image');
      setFormData({
        ...formData,
        headerImagePath: null,
        headerImageUrl: null,
        headerImageFocalPoint: null,
      });
      toast.success('Header image removed');
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not remove the image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
      <h4 className="text-sm font-medium text-slate-900 mb-1">Header image</h4>
      <p className="text-xs text-slate-500 mb-3">
        Shown behind the dashboard greeting when this location is selected. A fixed
        left-side fade keeps the text readable whatever the photo.
      </p>

      {!locationId ? (
        <p className="text-sm text-slate-400 border border-dashed rounded-md px-4 py-6 text-center">
          Save the location first, then add a header image.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Live preview — the REAL header treatment (same scrim + shadow) */}
          <div
            className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
            style={{ aspectRatio: '7.4 / 1', minHeight: 72 }}
            aria-label="Header preview"
          >
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  opacity: headerImageOpacity(strength),
                  objectPosition: headerObjectPosition(formData.headerImageFocalPoint),
                }}
              />
            )}
            {imageUrl && <div className="absolute inset-0" style={{ background: HEADER_IMAGE_SCRIM }} />}
            <div className="relative h-full flex flex-col justify-center px-4">
              <span
                className="text-[10px] font-medium text-tertiary-foreground uppercase tracking-wide"
                style={imageUrl ? { textShadow: HEADER_IMAGE_TEXT_SHADOW } : undefined}
              >
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}{formData.name || 'This location'}
              </span>
              <span
                className="text-base font-bold text-[#1C1916] leading-tight"
                style={imageUrl ? { textShadow: HEADER_IMAGE_TEXT_SHADOW } : undefined}
              >
                Good Morning, Jason 👋
              </span>
            </div>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium px-2 py-1 rounded-md border border-slate-200 bg-white/70 backdrop-blur-md text-slate-700">
              Today
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
              {imageUrl ? <ImageIcon className="h-4 w-4 mr-2" /> : <UploadSimple className="h-4 w-4 mr-2" />}
              {imageUrl ? 'Replace image' : 'Upload image'}
            </Button>
            {imageUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void removeImage()}
                className="border-destructive/30 text-destructive hover:bg-destructive/5"
              >
                <Trash className="h-4 w-4 mr-2" />
                Remove
              </Button>
            )}
          </div>

          {imageUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="header-strength">Image strength</Label>
                <span className="text-xs tabular-nums text-slate-500">{strength}</span>
              </div>
              <Slider
                id="header-strength"
                value={[strength]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setFormData({ ...formData, headerImageStrength: v })}
                aria-label="Header image strength"
              />
              <p className="text-xs text-slate-400">
                0 hides the photo entirely; 100 shows it at full strength under the fade.
                Saved with the location.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Cropper — locked to the banner aspect */}
      <Dialog open={cropSrc !== null} onOpenChange={(open) => { if (!open && !busy) closeCropper(); }}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Position the header image</DialogTitle>
            <DialogDescription>
              Drag to position and pinch or scroll to zoom. The crop matches the dashboard banner.
            </DialogDescription>
          </DialogHeader>
          <div className="relative w-full rounded-lg overflow-hidden bg-slate-900" style={{ height: 260 }}>
            {cropSrc && (
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={HEADER_ASPECT}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={closeCropper}>Cancel</Button>
            <Button type="button" disabled={busy || !croppedArea} onClick={() => void confirmCrop()}>
              {busy ? <CircleNotch className="h-4 w-4 mr-2 animate-spin" /> : null}
              {busy ? 'Uploading…' : 'Use image'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
