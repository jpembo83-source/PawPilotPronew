/**
 * Tap-to-replace pet photo.
 *
 * On native iOS this uses Capacitor's Camera plugin (`@capacitor/camera`)
 * with `source: Prompt` so the user gets the system action sheet — Take
 * photo / Choose from library / Cancel.  On the web fallback it presents
 * the same plugin's HTML5 file picker.
 *
 * The upload is a raw multipart POST to the portal endpoint (the shared
 * client is JSON-only).  On success we invalidate the React-Query caches
 * for `pets` and `pets/:id`, so both the PetDetail header and the Pets
 * grid re-render the new photo without a hard reload.  The KV write the
 * endpoint performs is the same key staff dashboards read from — they
 * pick the photo up on their next refresh.
 */
import { useState } from "react";
import { Camera as CameraIcon, Loader2, PawPrint } from "lucide-react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";

interface PetPhotoEditorProps {
  petId: string;
  petName: string;
  /** existing URL or null/undefined for the PawPrint fallback */
  photoUrl: string | null | undefined;
  /** optional override of the avatar size in px */
  size?: number;
}

export function PetPhotoEditor({ petId, petName, photoUrl, size = 96 }: PetPhotoEditorProps) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  // Optimistic preview while the upload is in flight.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const visibleUrl = previewUrl ?? photoUrl ?? null;

  async function pick() {
    if (busy) return;
    setBusy(true);
    let didStart = false;
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        quality: 82,
        width: 1200,
        allowEditing: true,
        promptLabelHeader: `New photo of ${petName}`,
        promptLabelPhoto: "Choose from library",
        promptLabelPicture: "Take photo",
      });
      didStart = true;

      if (!photo.dataUrl) {
        setBusy(false);
        return;
      }

      // Optimistic preview — feels instant on flaky connections.
      setPreviewUrl(photo.dataUrl);

      // Convert data URL to Blob for multipart upload.
      const blob = await (await fetch(photo.dataUrl)).blob();

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey   = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await getSupabase().auth.getSession();
      const token = session?.access_token;

      const fd = new FormData();
      fd.append("file", blob, `pet-${petId}.${photo.format ?? "jpg"}`);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal/pets/${petId}/photo`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${anonKey}`,
            ...(token ? { "X-User-Token": `Bearer ${token}` } : {}),
          },
          body: fd,
        },
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      // Hand off to React Query — both the singular pet and the list view
      // re-render with the new URL.
      qc.invalidateQueries({ queryKey: ["portal", "pets", petId] });
      qc.invalidateQueries({ queryKey: ["portal", "pets"] });
      toast.success("Photo updated.", { description: "Your team will see it next time they refresh." });
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      // The Capacitor plugin throws "User cancelled photos app" or similar —
      // treat any cancellation as silent rather than an error.
      if (didStart && (msg.toLowerCase().includes("cancel") || msg.includes("UserCancelled"))) {
        // user cancelled — silent
      } else if (!didStart && msg.toLowerCase().includes("cancel")) {
        // pre-start cancel — silent
      } else {
        console.error("[photo-upload]", e);
        toast.error("Couldn't update photo.", { description: msg });
      }
      setPreviewUrl(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={pick}
      disabled={busy}
      className="press relative shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
      style={{ width: size, height: size }}
      aria-label={`Change ${petName}'s photo`}
    >
      {visibleUrl ? (
        <img
          src={visibleUrl}
          alt=""
          className={`size-full rounded-full object-cover shadow-[var(--shadow-sm)] ring-1 ring-border transition-opacity ${busy ? "opacity-70" : ""}`}
        />
      ) : (
        <div
          className={`size-full rounded-full bg-secondary text-secondary-foreground grid place-items-center shadow-[var(--shadow-sm)] ${busy ? "opacity-70" : ""}`}
          aria-hidden="true"
        >
          <PawPrint size={Math.round(size * 0.4)} strokeWidth={1.5} />
        </div>
      )}

      {/* Camera affordance — bottom-right; switches to spinner during upload */}
      <span
        className="absolute -bottom-0.5 -right-0.5 size-8 rounded-full bg-foreground text-background grid place-items-center shadow-[var(--shadow-md)] ring-2 ring-background"
        aria-hidden="true"
      >
        {busy ? (
          <Loader2 size={14} strokeWidth={2.4} className="animate-spin" />
        ) : (
          <CameraIcon size={14} strokeWidth={2.2} />
        )}
      </span>
    </button>
  );
}
