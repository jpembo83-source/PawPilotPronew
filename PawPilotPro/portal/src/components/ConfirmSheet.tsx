import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  /** Dismiss without confirming — backdrop tap, Escape, or the safe button. */
  onClose: () => void;
  /** Run the destructive action. The sheet does not close itself. */
  onConfirm: () => void;
  title: string;
  /** One line of consequence copy under the title. */
  body?: string;
  /** Destructive action label, e.g. "Cancel request". */
  confirmLabel: string;
  /** Safe action label, e.g. "Keep booking". */
  cancelLabel: string;
  busy?: boolean;
}

/**
 * Branded bottom-sheet confirmation — replaces window.confirm, which renders
 * as OS chrome inside the Capacitor WebView. Follows the portal sheet idiom
 * (NotificationDrawer / RequestEditSheet): backdrop tap and Escape dismiss
 * without confirming, so the destructive path always takes a deliberate tap.
 */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busy = false,
}: Props) {
  // Close on Escape + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 anim-fade-in"
      onClick={() => !busy && onClose()}
      role="presentation"
    >
      <div
        className="bg-card rounded-t-3xl w-full max-w-md p-5 shadow-[var(--shadow-lg)] anim-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.75rem + var(--safe-bottom))" }}
        role="alertdialog"
        aria-label={title}
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" aria-hidden="true" />

        <h2 className="text-display-sm mb-1.5">{title}</h2>
        {body && (
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-5">{body}</p>
        )}

        <button
          onClick={onConfirm}
          disabled={busy}
          className="press flex items-center justify-center w-full h-12 rounded-2xl bg-destructive text-destructive-foreground font-semibold shadow-[var(--shadow-sm)] disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          autoFocus
          className="press flex items-center justify-center w-full h-12 rounded-2xl mt-2.5 bg-secondary text-secondary-foreground font-semibold disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}
