import { Camera, ChevronRight, LogIn, LogOut, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";

/**
 * "Today" — the staff-driven day feed for the featured pet (design spec:
 * "how is my dog right now"). Renders only when there is at least one
 * update today, and sits above the Pulse/biometric surfaces: a photo from
 * the yard beats a heart-rate chart.
 */

interface PetUpdateWire {
  id: string;
  type: "checked_in" | "checked_out" | "photo" | "note";
  text: string | null;
  photoUrl: string | null;
  createdAt: string;
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Check-out notes arrive as "Mood: Great day\n<rest>" when staff picked a mood. */
function splitMood(text: string | null): { mood: string | null; rest: string | null } {
  if (!text) return { mood: null, rest: null };
  const match = /^Mood:\s*(.+)$/m.exec(text);
  const rest = text.replace(/^Mood:\s*.+$/m, "").trim();
  return { mood: match?.[1]?.trim() ?? null, rest: rest || null };
}

export function TodayCard({ petId, petName }: { petId: string; petName: string }) {
  const { data, isLoading } = usePortalQuery<{ updates: PetUpdateWire[] }>(
    ["portal", "pets", petId, "updates"],
    `/portal/pets/${petId}/updates`,
    { staleTime: 60_000 },
  );

  if (isLoading) {
    return (
      <section className="mb-6">
        <h2 className="text-eyebrow mb-3">Today</h2>
        <Skeleton className="h-[92px] rounded-2xl" />
      </section>
    );
  }

  const updates = data?.updates ?? [];
  if (updates.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="text-eyebrow mb-3">Today</h2>
      <div
        className="bg-card border border-border rounded-2xl p-4"
        style={{ boxShadow: "var(--shadow-card-soft)" }}
      >
        <ul className="space-y-3.5">
          {updates.map((u) => (
            <li key={u.id} className="flex gap-3">
              <div className="size-9 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0 mt-0.5">
                {u.type === "checked_in" && <LogIn size={16} strokeWidth={2} aria-hidden="true" />}
                {u.type === "checked_out" && <LogOut size={16} strokeWidth={2} aria-hidden="true" />}
                {u.type === "photo" && <Camera size={16} strokeWidth={2} aria-hidden="true" />}
                {u.type === "note" && <MessageCircle size={16} strokeWidth={2} aria-hidden="true" />}
              </div>
              <div className="flex-1 min-w-0">
                {u.type === "checked_in" && (
                  <p className="text-[14px] leading-snug">
                    <span className="font-semibold">Checked in</span>{" "}
                    <span className="text-muted-foreground text-tabular">{timeOf(u.createdAt)}</span>
                    <span className="text-muted-foreground"> — {petName} is with us.</span>
                  </p>
                )}
                {u.type === "checked_out" && (() => {
                  const { mood, rest } = splitMood(u.text);
                  return (
                    <div>
                      <p className="text-[14px] leading-snug">
                        <span className="font-semibold">Checked out</span>{" "}
                        <span className="text-muted-foreground text-tabular">{timeOf(u.createdAt)}</span>
                        {mood && <span className="text-muted-foreground"> — {mood.toLowerCase()}</span>}
                      </p>
                      {rest && <p className="text-[13px] text-muted-foreground mt-0.5">{rest}</p>}
                    </div>
                  );
                })()}
                {(u.type === "photo" || u.type === "note") && (
                  <div>
                    {u.photoUrl && (
                      <img
                        src={u.photoUrl}
                        alt={u.text ?? `${petName} today`}
                        className="w-full max-h-56 object-cover rounded-xl mb-1.5"
                      />
                    )}
                    {u.text && <p className="text-[14px] leading-snug">{u.text}</p>}
                    <p className="text-[12px] text-muted-foreground text-tabular mt-0.5">
                      {timeOf(u.createdAt)} · from the team
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        <Link
          to={`/gallery?pet=${petId}`}
          className="press mt-3.5 inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
        >
          See all photos
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
