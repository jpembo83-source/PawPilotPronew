// Gallery — the household's full photo repository: every approved moment
// across time, newest first, with full-size viewing and download (one or
// all). Only manager-APPROVED photos ever reach this screen; the server
// mints signed URLs exclusively for approved rows.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, Download, Images, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { getPortalApi } from "@/lib/api";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface GalleryItemWire {
  id: string;
  petId: string;
  petName: string;
  text: string | null;
  photoUrl: string | null;
  createdAt: string;
}

interface GalleryPageWire {
  items: GalleryItemWire[];
  nextCursor: string | null;
}

interface ManifestFileWire {
  name: string;
  url: string;
  createdAt: string;
  petName: string;
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

/** Fetch a (short-lived signed) URL and hand it to the browser as a named
 *  download. Signed URLs expire in 30 minutes, so we always download from a
 *  freshly-fetched blob rather than caching URLs. */
async function saveFile(url: string, name: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Photo link expired — pull to refresh");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function GalleryScreen() {
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const petFilter = searchParams.get("pet") ?? "";

  const { data: petsData } = usePortalQuery<{ pets: Array<{ id: string; name: string }> }>(
    ["portal", "pets"],
    "/portal/pets",
  );
  const pets = petsData?.pets ?? [];

  const [items, setItems] = useState<GalleryItemWire[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewing, setViewing] = useState<GalleryItemWire | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const galleryPath = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (petFilter) params.set("pet_id", petFilter);
      if (cursor) params.set("cursor", cursor);
      const qs = params.toString();
      return `/portal/gallery${qs ? `?${qs}` : ""}`;
    },
    [petFilter],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    setNextCursor(null);
    getPortalApi()
      .get<GalleryPageWire>(galleryPath())
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((e: unknown) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Couldn't load the gallery");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [galleryPath]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await getPortalApi().get<GalleryPageWire>(galleryPath(nextCursor));
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't load more photos");
    } finally {
      setLoadingMore(false);
    }
  };

  const saveOne = async (item: GalleryItemWire) => {
    if (!item.photoUrl || savingId) return;
    setSavingId(item.id);
    try {
      const day = item.createdAt.split("T")[0];
      await saveFile(item.photoUrl, `${item.petName || "pet"}-${day}-${item.id}.jpg`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't download the photo");
    } finally {
      setSavingId(null);
    }
  };

  // "Download all": ask the server for a signed-URL manifest and fetch each
  // file client-side — keeps the backend zip-free (and each photo lands as a
  // normal image the OS can put in the camera roll).
  const saveAll = async () => {
    if (savingAll) return;
    setSavingAll(true);
    try {
      const manifest = await getPortalApi().get<{ files: ManifestFileWire[]; truncated: boolean }>(
        `/portal/gallery/download${petFilter ? `?pet_id=${encodeURIComponent(petFilter)}` : ""}`,
      );
      if (manifest.files.length === 0) {
        toast.info("No photos to download yet");
        return;
      }
      toast.info(`Downloading ${manifest.files.length} photo${manifest.files.length !== 1 ? "s" : ""}…`);
      let failed = 0;
      for (const file of manifest.files) {
        try {
          await saveFile(file.url, file.name);
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) toast.error(`${failed} photo${failed !== 1 ? "s" : ""} failed to download`);
      else toast.success("All photos downloaded");
      if (manifest.truncated) toast.info("Showing the most recent 500 photos");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't download photos");
    } finally {
      setSavingAll(false);
    }
  };

  // Month sections keep an all-time grid scannable.
  const sections = useMemo(() => {
    const byMonth = new Map<string, GalleryItemWire[]>();
    for (const item of items) {
      const label = monthLabel(item.createdAt);
      const list = byMonth.get(label);
      if (list) list.push(item);
      else byMonth.set(label, [item]);
    }
    return [...byMonth.entries()];
  }, [items]);

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
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={savingAll}
            className="press inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold shadow-[var(--shadow-xs)] disabled:opacity-50"
          >
            {savingAll ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2.4} />}
            Download all
          </button>
        )}
      </header>

      <section className="anim-fade-in mb-5">
        <p className="text-eyebrow mb-2">Moments</p>
        <h1 className="text-display-sm leading-tight">Gallery</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed">
          Every photo the team has shared, for keeps. Tap one to view full size or save it.
        </p>
      </section>

      {pets.length > 1 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 anim-fade-in">
          <button
            type="button"
            onClick={() => setSearchParams({}, { replace: true })}
            className={`press shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold border ${
              !petFilter ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
            }`}
          >
            All pets
          </button>
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSearchParams({ pet: p.id }, { replace: true })}
              className={`press shrink-0 h-9 px-3.5 rounded-full text-[13px] font-semibold border ${
                petFilter === p.id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Images size={18} />}
          title="No photos yet"
          body="When the team shares photos from the day and they're approved, they'll all live here."
        />
      ) : (
        <>
          {sections.map(([label, sectionItems]) => (
            <section key={label} className="mb-6 anim-fade-in">
              <h2 className="text-eyebrow mb-2">{label}</h2>
              <div className="grid grid-cols-3 gap-1.5">
                {sectionItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setViewing(item)}
                    className="press relative aspect-square rounded-xl overflow-hidden bg-secondary"
                    aria-label={`View photo of ${item.petName} from ${dayLabel(item.createdAt)}`}
                  >
                    {item.photoUrl && (
                      <img
                        src={item.photoUrl}
                        alt={item.text ?? `${item.petName}`}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {nextCursor && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="press w-full h-11 rounded-2xl border border-border bg-card text-[14px] font-semibold text-muted-foreground disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}

      {/* Full-size viewer */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={`Photo of ${viewing.petName}`}
          onClick={() => setViewing(null)}
        >
          <div className="flex items-center justify-between p-4">
            <button
              type="button"
              onClick={() => setViewing(null)}
              className="press p-2.5 rounded-full bg-white/10 text-white"
              aria-label="Close"
            >
              <X size={18} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void saveOne(viewing);
              }}
              disabled={savingId === viewing.id}
              className="press inline-flex items-center gap-1.5 h-11 px-4 rounded-full bg-white/10 text-white text-[14px] font-semibold disabled:opacity-50"
            >
              {savingId === viewing.id
                ? <Loader2 size={16} className="animate-spin" />
                : <Download size={16} strokeWidth={2.2} />}
              Save
            </button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center px-2" onClick={(e) => e.stopPropagation()}>
            {viewing.photoUrl && (
              <img
                src={viewing.photoUrl}
                alt={viewing.text ?? viewing.petName}
                className="max-w-full max-h-full object-contain rounded-xl"
              />
            )}
          </div>
          <div className="p-5 text-white" onClick={(e) => e.stopPropagation()}>
            {viewing.text && <p className="text-[14px] leading-snug mb-1">{viewing.text}</p>}
            <p className="text-[14px] text-white/70">
              {viewing.petName} · {dayLabel(viewing.createdAt)}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
