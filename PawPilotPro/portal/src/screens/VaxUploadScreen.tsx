import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

const VAX_TYPES = [
  { value: "rabies", label: "Rabies" },
  { value: "dhpp", label: "DHPP (distemper, hepatitis, parvo, parainfluenza)" },
  { value: "bordetella", label: "Bordetella (kennel cough)" },
  { value: "leptospirosis", label: "Leptospirosis" },
  { value: "influenza", label: "Canine influenza" },
  { value: "other", label: "Other" },
] as const;

export function VaxUploadScreen() {
  const { id } = useParams();
  const nav = useNavigate();
  const online = useOnlineStatus();
  const [file, setFile] = useState<File | null>(null);
  const [vaxType, setVaxType] = useState<string>("rabies");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickFile(f: File | null) {
    setErr(null);
    if (!f) { setFile(null); return; }
    if (f.size > MAX_BYTES) { setErr("File too large (max 10MB)."); return; }
    if (!ALLOWED.includes(f.type)) { setErr("PDF, JPG, or PNG only."); return; }
    setFile(f);
  }

  async function submit() {
    if (!file || !id) return;
    setBusy(true); setErr(null);
    try {
      const { data: sess } = await getSupabase().auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal/vax`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("meta", JSON.stringify({
        petId: id,
        vaxType,
        issuedAt: issuedAt ? new Date(issuedAt).toISOString() : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        notes: notes || undefined,
      }));
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${anonKey}`,
          "X-User-Token": `Bearer ${sess.session?.access_token ?? ""}`,
        },
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      toast.success("Uploaded — staff will review");
      nav(`/pets/${id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-5 pt-8 max-w-md mx-auto pb-12">
      <Link
        to={`/pets/${id}`}
        className="press inline-flex items-center gap-0.5 -ml-1 mb-5 h-8 pr-2 pl-1 rounded-lg text-sm font-medium text-primary"
      >
        <ChevronLeft size={16} strokeWidth={2.5} />
        Back
      </Link>
      <header className="mb-6 anim-fade-in">
        <p className="text-eyebrow mb-2">Vaccinations</p>
        <h1 className="text-display-sm mb-1.5">Upload vaccination</h1>
        <p className="text-sm text-muted-foreground">
          Staff will review the certificate and add it to your pet's record.
        </p>
      </header>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1.5">Certificate (PDF / JPG / PNG, ≤10MB)</span>
        <input
          id="vax-file"
          type="file"
          accept=".pdf,image/jpeg,image/png"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm rounded-xl border border-input bg-input-background px-3 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-secondary file:text-secondary-foreground file:text-sm file:font-medium file:cursor-pointer"
        />
        {file && (
          <p className="mt-1.5 text-xs text-muted-foreground text-tabular">
            {file.name} · {(file.size / 1024).toFixed(0)} KB
          </p>
        )}
      </label>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1.5">Vaccination type</span>
        <select
          value={vaxType}
          onChange={(e) => setVaxType(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border border-input bg-input-background text-foreground text-sm transition focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
        >
          {VAX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1.5">Date administered (optional)</span>
        <input
          type="date"
          value={issuedAt}
          onChange={(e) => setIssuedAt(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border border-input bg-input-background text-foreground text-sm text-tabular transition focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
        />
      </label>

      <label className="block mb-4">
        <span className="block text-sm font-medium mb-1.5">Next due (optional)</span>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full h-12 px-3 rounded-xl border border-input bg-input-background text-foreground text-sm text-tabular transition focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
        />
      </label>

      <label className="block mb-6">
        <span className="block text-sm font-medium mb-1.5">Notes for staff (optional)</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything we should know about this certificate?"
          className="w-full px-3 py-2.5 rounded-xl border border-input bg-input-background text-foreground text-sm resize-none transition focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
        />
      </label>

      {err && <p role="alert" className="text-sm text-destructive mb-3">{err}</p>}

      {!online && (
        <p role="status" className="text-sm text-muted-foreground mb-3">
          You're offline — you can submit this as soon as you're back online.
        </p>
      )}

      <button
        disabled={!file || busy || !online}
        onClick={submit}
        className="press group relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
      >
        <span className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none" aria-hidden="true" />
        <span className="tracking-[-0.005em]">{busy ? "Uploading…" : "Submit for review"}</span>
      </button>
    </main>
  );
}
