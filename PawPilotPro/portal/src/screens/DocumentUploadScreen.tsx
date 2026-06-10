import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, FileUp, ShieldCheck, Stethoscope, IdCard, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getSupabase } from "@/lib/supabase";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { OWNER_UPLOADABLE_DOCUMENT_TYPES } from "@shared/types/document";
import type { DocumentType } from "@shared/types/document";
import type { Pet } from "@shared/types/pet";

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const TYPE_OPTIONS: Array<{ value: DocumentType; label: string; hint: string; icon: typeof FileText }> = [
  { value: "insurance",  label: "Insurance",  hint: "Pet insurance certificate",      icon: ShieldCheck },
  { value: "vet_records", label: "Vet records", hint: "Vet history, prescriptions",   icon: Stethoscope },
  { value: "photo_id",   label: "Photo ID",   hint: "Owner ID (passport, driving)",   icon: IdCard },
  { value: "other",      label: "Other",      hint: "Anything else",                  icon: FileText },
];

export function DocumentUploadScreen() {
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: petsData } = usePortalQuery<{ pets: Pet[] }>(
    ["portal", "pets"],
    "/portal/pets",
  );
  const verifiedPets = (petsData?.pets ?? []).filter(
    (p) => (p.verificationStatus ?? "verified") === "verified",
  );

  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("insurance");
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [petId, setPetId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickFile(f: File | null) {
    setErr(null);
    if (!f) { setFile(null); return; }
    if (f.size > MAX_BYTES) { setErr("File too large (max 15MB)."); return; }
    if (!ALLOWED_MIME.includes(f.type)) { setErr("PDF, JPG, PNG, HEIC, or Word doc only."); return; }
    setFile(f);
    if (!name.trim()) setName(stripExt(f.name));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErr("Pick a file to upload");
      return;
    }
    if (!OWNER_UPLOADABLE_DOCUMENT_TYPES.includes(documentType)) {
      setErr("That document type can't be uploaded from here");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { data: sess } = await getSupabase().auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal/documents`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("meta", JSON.stringify({
        documentType,
        name: name.trim() || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        petId: petId || undefined,
        notes: notes.trim() || undefined,
      }));
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${anonKey}`,
          "X-User-Token": `Bearer ${sess.session?.access_token ?? ""}`,
        },
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      qc.invalidateQueries({ queryKey: ["portal", "documents"] });
      qc.invalidateQueries({ queryKey: ["portal", "home"] });
      toast.success("Document uploaded");
      nav("/account/documents", { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-5 pt-4 pb-12 max-w-md mx-auto">
      <header className="flex items-center gap-2 mb-5 -ml-2 anim-fade-in">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="press p-2 rounded-full hover:bg-secondary/60"
          aria-label="Back"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <span className="text-[15px] font-semibold tracking-tight">Upload document</span>
      </header>

      <section className="anim-fade-in mb-6">
        <p className="text-eyebrow mb-2">New document</p>
        <h1 className="text-display-sm leading-tight">What are you sharing?</h1>
      </section>

      <form onSubmit={submit} className="space-y-5 anim-slide-up">
        {/* TYPE PICKER --------------------------------------------- */}
        <fieldset className="rounded-2xl border border-border bg-card p-3 space-y-2">
          <legend className="text-eyebrow px-1.5 mb-1.5">Type</legend>
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`press flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                documentType === opt.value
                  ? "border-primary bg-secondary/40"
                  : "border-border bg-background/40 hover:border-primary/40"
              }`}
            >
              <input
                type="radio"
                name="document_type"
                value={opt.value}
                checked={documentType === opt.value}
                onChange={() => setDocumentType(opt.value)}
                className="sr-only"
              />
              <div className={`size-10 rounded-xl grid place-items-center shrink-0 ${
                documentType === opt.value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              }`}>
                <opt.icon size={18} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[14.5px] leading-tight">{opt.label}</p>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">{opt.hint}</p>
              </div>
            </label>
          ))}
        </fieldset>

        {/* FILE PICKER --------------------------------------------- */}
        <label className="block">
          <span className="text-eyebrow block mb-1.5">File</span>
          <div className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed ${
            file ? "border-primary/50 bg-secondary/30" : "border-border bg-card"
          }`}>
            <div className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center shrink-0">
              <FileUp size={20} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              {file ? (
                <>
                  <p className="font-semibold text-[14px] leading-tight truncate">{file.name}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 text-tabular">
                    {(file.size / 1024).toFixed(0)} KB · {file.type || "unknown"}
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Pick a PDF, image, or Word doc — up to 15MB.
                </p>
              )}
            </div>
            <input
              type="file"
              accept={ALLOWED_MIME.join(",")}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Pick a file"
            />
          </div>
        </label>

        {/* NAME ---------------------------------------------------- */}
        <label className="block">
          <span className="text-eyebrow block mb-1.5">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pet insurance 2026"
            className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
          />
        </label>

        {/* EXPIRY -------------------------------------------------- */}
        <label className="block">
          <span className="text-eyebrow block mb-1.5">Expires (optional)</span>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
          />
        </label>

        {/* PET ATTRIBUTION ---------------------------------------- */}
        {verifiedPets.length > 0 && (
          <label className="block">
            <span className="text-eyebrow block mb-1.5">For which pet? (optional)</span>
            <select
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
              className="w-full h-12 px-3 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow appearance-none"
            >
              <option value="">Whole household</option>
              {verifiedPets.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
        )}

        {/* NOTES --------------------------------------------------- */}
        <label className="block">
          <span className="text-eyebrow block mb-1.5">Notes for the team (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Renewed by phone — claim limit increased"
            className="w-full p-3.5 rounded-xl border border-input bg-input-background text-foreground text-[14px] leading-relaxed resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
          />
        </label>

        {err && (
          <p role="alert" className="text-[13px] text-destructive font-medium anim-fade-in">{err}</p>
        )}

        <button
          type="submit"
          disabled={busy || !file}
          className="press relative flex items-center justify-center w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
    </main>
  );
}

function stripExt(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}
