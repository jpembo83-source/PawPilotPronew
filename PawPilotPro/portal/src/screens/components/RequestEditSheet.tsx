import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getPortalApi } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  petId: string;
}

export function RequestEditSheet({ open, onClose, petId }: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Lock body scroll while sheet open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    try {
      await getPortalApi().post(`/portal/pets/${petId}/edit-request`, { note });
      toast.success("Sent — staff will review.");
      setNote("");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 anim-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-card rounded-t-3xl w-full max-w-md p-5 shadow-[var(--shadow-lg)] anim-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.75rem + var(--safe-bottom))" }}
        role="dialog"
        aria-label="Request profile edit"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" aria-hidden="true" />

        <header className="flex items-baseline justify-between mb-1">
          <h2 className="text-display-sm">Request edit</h2>
          <button
            onClick={onClose}
            className="press text-sm text-muted-foreground hover:text-foreground -mr-1 h-8 px-2 rounded-lg"
          >
            Cancel
          </button>
        </header>
        <p className="text-[13px] text-muted-foreground mb-4">
          Tell us what should change and our team will update the profile.
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="e.g. New vet phone number, updated weight…"
          className="w-full p-3.5 rounded-xl border border-input bg-input-background text-[14px] leading-relaxed text-foreground resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
          autoFocus
        />

        <button
          disabled={busy || !note.trim()}
          onClick={submit}
          className="press group relative mt-4 flex items-center justify-center w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          <span
            className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none"
            aria-hidden="true"
          />
          <span className="tracking-[-0.005em]">{busy ? "Sending…" : "Send request"}</span>
        </button>
      </div>
    </div>
  );
}
