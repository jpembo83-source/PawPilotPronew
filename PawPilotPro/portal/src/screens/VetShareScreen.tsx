import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Stethoscope, Copy, Check, Trash2, Loader2, Mail } from "lucide-react";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { getPortalApi } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";

interface VetShare {
  token: string;
  url: string;
  vetName?: string;
  vetEmail?: string;
  note?: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  lastOpenedAt?: string;
  openCount: number;
  active: boolean;
}

interface ListResponse { shares: VetShare[]; }

interface CreateResponse {
  ok: true;
  share: VetShare;
  url: string;
}

export function VetShareScreen() {
  const { id: petId } = useParams<{ id: string }>();
  const { data, isLoading, refetch } = usePortalQuery<ListResponse>(
    ["portal", "pets", petId, "vet-shares"],
    `/portal/pets/${petId}/vet-shares`,
    { enabled: !!petId },
  );

  const [vetName, setVetName] = useState("");
  const [vetEmail, setVetEmail] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<CreateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!petId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await getPortalApi().post<CreateResponse>(
        `/portal/pets/${petId}/vet-shares`,
        { vetName: vetName || undefined, vetEmail: vetEmail || undefined, note: note || undefined },
      );
      setJustCreated(res);
      setVetName(""); setVetEmail(""); setNote("");
      refetch();
    } catch (e: any) {
      setCreateError(e?.message ?? String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(token: string) {
    if (!petId) return;
    if (!confirm("Revoke this share? The vet will lose access immediately.")) return;
    try {
      await getPortalApi().del(`/portal/pets/${petId}/vet-shares/${token}`);
      refetch();
    } catch (e: any) {
      alert(`Could not revoke: ${e?.message ?? String(e)}`);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <main className="px-5 pt-8 pb-12 max-w-md mx-auto">
      <Link
        to={petId ? `/pets/${petId}` : "/pets"}
        className="inline-flex items-center gap-0.5 -ml-1 mb-5 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        Pet
      </Link>

      <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground">
        Care circle
      </p>
      <h1 className="font-display leading-[0.95] tracking-[-0.015em] mt-1 mb-3" style={{ fontSize: 40 }}>
        Vet share
      </h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-[34ch] leading-relaxed">
        A private read-only link to your dog's recent biometrics, vaccinations,
        and key health notes. No vet account needed — just send the link.
      </p>

      {/* New share form */}
      <section className="rounded-2xl border bg-card p-5 mb-4">
        <h2 className="text-sm font-medium mb-3">Create new share link</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Vet name (optional)</label>
            <input
              type="text"
              value={vetName}
              onChange={(e) => setVetName(e.target.value)}
              placeholder="Dr. Sarah Müller"
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Vet email (optional)</label>
            <input
              type="email"
              value={vetEmail}
              onChange={(e) => setVetEmail(e.target.value)}
              placeholder="vet@clinic.com"
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Sharing for the upcoming check-up."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          {createError && (
            <p className="text-xs text-destructive">{createError}</p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="press w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Stethoscope size={14} />}
            Generate share link
          </button>
          <p className="text-xs text-muted-foreground text-center">
            Link is valid for 90 days. You can revoke any time.
          </p>
        </form>

        {justCreated && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1">Link ready</p>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-emerald-200 p-2">
              <code className="text-xs flex-1 truncate font-mono">{justCreated.url}</code>
              <button
                onClick={() => copyToClipboard(justCreated.url)}
                className="press shrink-0 size-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center"
                title="Copy link"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
            {justCreated.share.vetEmail && (
              <a
                href={`mailto:${justCreated.share.vetEmail}?subject=${encodeURIComponent("Pet health link")}&body=${encodeURIComponent(`Hi,\n\nYou can review my dog's recent health data here:\n${justCreated.url}\n\nThanks!`)}`}
                className="press mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-700"
              >
                <Mail size={12} /> Email it to {justCreated.share.vetEmail}
              </a>
            )}
          </div>
        )}
      </section>

      {/* Existing shares */}
      <section>
        <h2 className="text-sm font-medium mb-2">Active links</h2>
        {isLoading ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : !data?.shares || data.shares.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No share links yet. Create one above and send it to your vet.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.shares
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((s) => (
                <li
                  key={s.token}
                  className={`rounded-xl border p-3 ${s.active ? "bg-card border-border" : "bg-muted/30 border-border opacity-60"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.vetName || s.vetEmail || "Unnamed vet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.active
                          ? `Active · opened ${s.openCount} time${s.openCount === 1 ? "" : "s"}`
                          : s.revokedAt ? "Revoked" : "Expired"}
                      </p>
                      <code className="text-[10px] font-mono text-muted-foreground truncate block mt-1">
                        {s.url}
                      </code>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {s.active && (
                        <>
                          <button
                            onClick={() => copyToClipboard(s.url)}
                            className="press size-8 rounded-lg bg-muted flex items-center justify-center"
                            title="Copy link"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            onClick={() => handleRevoke(s.token)}
                            className="press size-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"
                            title="Revoke"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>
    </main>
  );
}
