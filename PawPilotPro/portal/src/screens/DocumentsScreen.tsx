import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronLeft, Plus, FileText, FileBadge, ShieldCheck, Stethoscope,
  IdCard, FileWarning, Trash2, Download, AlertCircle,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { getPortalApi } from "@/lib/api";
import type { Document, DocumentsResponse, DocumentType } from "@shared/types/document";

const TYPE_LABEL: Record<DocumentType, string> = {
  waiver: "Waiver",
  insurance: "Insurance",
  vet_records: "Vet records",
  photo_id: "Photo ID",
  medical: "Medical",
  other: "Other",
};

const TYPE_ICON: Record<DocumentType, typeof FileText> = {
  waiver: FileBadge,
  insurance: ShieldCheck,
  vet_records: Stethoscope,
  photo_id: IdCard,
  medical: Stethoscope,
  other: FileText,
};

interface Bucketed {
  actionNeeded: Document[];
  active: Document[];
}

/** "Action needed" = already expired OR expires within 30 days. */
function bucket(docs: Document[]): Bucketed {
  const now = Date.now();
  const soonMs = 30 * 24 * 60 * 60 * 1000;
  const actionNeeded: Document[] = [];
  const active: Document[] = [];
  for (const d of docs) {
    if (d.expiresAt) {
      const t = new Date(d.expiresAt).getTime();
      if (!Number.isNaN(t) && t - now < soonMs) actionNeeded.push(d);
      else active.push(d);
    } else {
      active.push(d);
    }
  }
  return { actionNeeded, active };
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function expiryLabel(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.round((t - Date.now()) / 86_400_000);
  if (days < 0) return `Expired ${-days}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days < 14) return `Expires in ${days}d`;
  return `Expires ${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

export function DocumentsScreen() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = usePortalQuery<DocumentsResponse>(
    ["portal", "documents"],
    "/portal/documents",
  );

  const buckets = useMemo(() => bucket(data?.documents ?? []), [data]);

  const remove = useMutation({
    mutationFn: (id: string) => getPortalApi().del(`/portal/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "documents"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "home"] });
      toast.success("Document deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't delete"),
  });

  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  async function open(doc: Document) {
    setOpeningId(doc.id);
    try {
      const r = await getPortalApi().get<{ url: string }>(`/portal/documents/${doc.id}/download`);
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't open document");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <main className="px-5 pt-4 pb-8 max-w-md mx-auto">
      <header className="flex items-center justify-between gap-2 mb-5 -ml-2 anim-fade-in">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="press p-2 rounded-full hover:bg-secondary/60"
          aria-label="Back"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <Link
          to="/account/documents/upload"
          className="press inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold shadow-[var(--shadow-xs)]"
        >
          <Plus size={14} strokeWidth={2.4} />
          Upload
        </Link>
      </header>

      <section className="anim-fade-in mb-6">
        <p className="text-eyebrow mb-2">Vault</p>
        <h1 className="text-display-sm leading-tight">Documents</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed">
          Insurance certs, vet records, ID. Add new files here and the team will see
          them straight away.
        </p>
      </section>

      {isLoading || !data ? (
        <ul className="space-y-2.5">
          <li><Skeleton className="h-[72px] rounded-2xl" /></li>
          <li><Skeleton className="h-[72px] rounded-2xl opacity-60" /></li>
        </ul>
      ) : (data.documents.length === 0 ? (
        <EmptyDocs />
      ) : (
        <div className="space-y-7">
          {buckets.actionNeeded.length > 0 && (
            <Group
              title="Action needed"
              tone="warn"
              items={buckets.actionNeeded}
              onOpen={open}
              onDelete={setDeleteId}
              openingId={openingId}
            />
          )}
          {buckets.active.length > 0 && (
            <Group
              title="Active"
              items={buckets.active}
              onOpen={open}
              onDelete={setDeleteId}
              openingId={openingId}
            />
          )}
        </div>
      ))}

      <ConfirmSheet
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove.mutate(deleteId);
          setDeleteId(null);
        }}
        title="Delete this document?"
        body="It'll disappear from your vault — the team may ask for a fresh copy later."
        confirmLabel="Delete document"
        cancelLabel="Keep document"
      />
    </main>
  );
}

function Group({
  title, items, onOpen, onDelete, openingId, tone,
}: {
  title: string;
  items: Document[];
  onOpen: (d: Document) => void;
  onDelete: (id: string) => void;
  openingId: string | null;
  tone?: "warn";
}) {
  return (
    <section>
      <p className={`text-eyebrow mb-2.5 ${tone === "warn" ? "text-destructive" : ""}`}>{title}</p>
      <ul className="space-y-2">
        {items.map((d, i) => (
          <li key={d.id} className="anim-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
            <DocCard
              doc={d}
              onOpen={() => onOpen(d)}
              onDelete={() => onDelete(d.id)}
              opening={openingId === d.id}
              tone={tone}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function DocCard({
  doc, onOpen, onDelete, opening, tone,
}: {
  doc: Document;
  onOpen: () => void;
  onDelete: () => void;
  opening: boolean;
  tone?: "warn";
}) {
  const Icon = TYPE_ICON[doc.documentType] ?? FileText;
  const expired = doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now();
  return (
    <div
      className={`group flex items-start gap-3 p-3.5 rounded-2xl border bg-card ${
        tone === "warn" ? "border-destructive/30 bg-destructive/5" : "border-border"
      }`}
    >
      <div
        className={`size-11 rounded-xl grid place-items-center shrink-0 ${
          tone === "warn" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"
        }`}
        aria-hidden="true"
      >
        {expired ? <FileWarning size={18} strokeWidth={2.2} /> : <Icon size={18} strokeWidth={2} />}
      </div>
      <button
        type="button"
        onClick={onOpen}
        disabled={opening}
        className="press flex-1 min-w-0 text-left"
      >
        <p className="font-semibold text-[15px] leading-tight truncate">{doc.name}</p>
        <p className="text-[12.5px] text-muted-foreground mt-0.5 text-tabular truncate">
          {TYPE_LABEL[doc.documentType]} · {formatBytes(doc.fileSize)}
          {doc.uploadedByOwner ? " · You uploaded" : " · From the team"}
        </p>
        {doc.expiresAt && (
          <p className={`text-[12px] font-medium mt-1 text-tabular ${
            expired ? "text-destructive" : tone === "warn" ? "text-destructive" : "text-muted-foreground"
          }`}>
            {expiryLabel(doc.expiresAt)}
          </p>
        )}
      </button>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <button
          type="button"
          onClick={onOpen}
          disabled={opening}
          className="press p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-secondary/60 disabled:opacity-50"
          aria-label="Open document"
        >
          <Download size={16} strokeWidth={2.2} />
        </button>
        {doc.uploadedByOwner && (
          <button
            type="button"
            onClick={onDelete}
            className="press p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label="Delete document"
          >
            <Trash2 size={16} strokeWidth={2.2} />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyDocs() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-5 py-10 text-center anim-fade-in">
      <div className="size-14 rounded-full bg-secondary text-secondary-foreground grid place-items-center mx-auto mb-4">
        <AlertCircle size={24} strokeWidth={1.75} />
      </div>
      <h3 className="font-semibold text-[15px] mb-1">No documents on file yet</h3>
      <p className="text-[13px] text-muted-foreground mb-5">
        Upload your dog's insurance, vet records, or anything else the team should
        keep on hand.
      </p>
      <Link
        to="/account/documents/upload"
        className="press inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-[var(--shadow-xs)]"
      >
        <Plus size={14} strokeWidth={2.4} />
        Upload a document
      </Link>
    </div>
  );
}
