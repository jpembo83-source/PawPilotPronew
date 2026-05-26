import { useState } from "react";
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-neutral-950 rounded-t-3xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(2rem + var(--safe-bottom))" }}
        role="dialog"
        aria-label="Request profile edit"
      >
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Request profile edit</h2>
          <button onClick={onClose} className="text-sm text-neutral-500">
            Cancel
          </button>
        </header>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="What needs to change?"
          className="w-full p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm bg-white dark:bg-neutral-900"
        />
        <button
          disabled={busy || !note.trim()}
          onClick={submit}
          className="mt-3 w-full h-12 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
    </div>
  );
}
