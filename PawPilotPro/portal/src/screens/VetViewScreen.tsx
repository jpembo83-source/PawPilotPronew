/**
 * Public read-only view shown when a vet opens a share link.
 * NO authentication required — only the token in the URL.
 * Routed at /vet/:token outside the RequirePortalAuth wrapper.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Stethoscope, Heart, Syringe, AlertTriangle, Loader2 } from "lucide-react";
import { brandDisplayName, useBranding } from "@/lib/branding";

const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

interface VetViewData {
  pet: {
    name: string;
    breed?: string;
    sex?: string;
    neutered_status?: string;
    date_of_birth?: string;
    weight_kg?: number;
    microchip?: string;
    colour?: string;
    vet_name?: string;
    vet_phone?: string;
    allergies?: string;
    feeding_instructions?: string;
    medical_notes?: string;
    behaviour_notes?: string;
  };
  vaccinations: Array<{
    type: string;
    issuedAt?: string;
    expiresAt?: string;
  }>;
  biometrics: {
    hrDaily: Array<{ date: string; bpm: number | null }>;
    window: { from: string; to: string };
  };
  sharedBy: {
    vetName: string | null;
    note: string | null;
    createdAt: string;
    expiresAt: string;
  };
}

export function VetViewScreen() {
  const { token } = useParams<{ token: string }>();
  // Subscribed (not a one-off read): the vet's browser has no cached brand,
  // so the name arrives async from the public branding fetch in main.tsx.
  const brand = useBranding((s) => s.brand);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [data, setData] = useState<VetViewData | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/portal/vet/${token}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setErrMsg(json?.error ?? `HTTP ${res.status}`);
          setState("error");
          return;
        }
        setData(json as VetViewData);
        setState("loaded");
      } catch (e: any) {
        if (cancelled) return;
        setErrMsg(e?.message ?? "Could not load");
        setState("error");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [token]);

  const hrStats = useMemo(() => {
    if (!data) return null;
    const points = data.biometrics.hrDaily.filter((p) => typeof p.bpm === "number");
    if (points.length === 0) return null;
    const vals = points.map((p) => p.bpm as number);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { count: points.length, mean, min, max, points };
  }, [data]);

  if (state === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </main>
    );
  }

  if (state === "error" || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-3 text-red-500" size={32} />
          <h1 className="text-xl font-semibold mb-2">Link unavailable</h1>
          <p className="text-sm text-slate-600">{errMsg ?? "This link may have been revoked or expired. Ask the owner for a fresh one."}</p>
        </div>
      </main>
    );
  }

  const p = data.pet;
  const sharedExpiry = new Date(data.sharedBy.expiresAt);
  const businessName = brandDisplayName(brand);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Stethoscope className="text-primary" size={24} />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Veterinary share · {businessName}</p>
            <p className="text-sm font-semibold text-slate-900">
              {p.name}
              {p.breed ? <span className="text-slate-500 font-normal"> · {p.breed}</span> : null}
            </p>
          </div>
          <p className="ml-auto text-xs text-slate-500 hidden sm:block">
            Read-only · expires {sharedExpiry.toLocaleDateString("en-GB")}
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Pet summary */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-base font-semibold mb-3">Patient summary</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Row label="Name" value={p.name} />
            <Row label="Breed" value={p.breed} />
            <Row label="Sex" value={p.sex} />
            <Row label="Neutered" value={p.neutered_status} />
            <Row label="Date of birth" value={p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString("en-GB") : undefined} />
            <Row label="Weight" value={p.weight_kg != null ? `${p.weight_kg} kg` : undefined} />
            <Row label="Colour" value={p.colour} />
            <Row label="Microchip" value={p.microchip} />
            <Row label="Primary vet" value={p.vet_name} />
            <Row label="Vet phone" value={p.vet_phone} />
          </dl>
          {(p.allergies || p.feeding_instructions || p.medical_notes || p.behaviour_notes) && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
              {p.allergies && <Note label="Allergies" body={p.allergies} />}
              {p.feeding_instructions && <Note label="Feeding instructions" body={p.feeding_instructions} />}
              {p.medical_notes && <Note label="Medical notes" body={p.medical_notes} />}
              {p.behaviour_notes && <Note label="Behaviour notes" body={p.behaviour_notes} />}
            </div>
          )}
        </section>

        {/* Vaccinations */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Syringe size={16} className="text-slate-500" />
            <h2 className="text-base font-semibold">Vaccinations</h2>
          </div>
          {data.vaccinations.length === 0 ? (
            <p className="text-sm text-slate-500">No vaccinations on file.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 text-left">
                <tr>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Issued</th>
                  <th className="pb-2">Expires</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.vaccinations.map((v, i) => {
                  const exp = v.expiresAt ? new Date(v.expiresAt) : null;
                  const expired = exp && exp.getTime() < Date.now();
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-2 font-medium">{(v.type || "—").toUpperCase()}</td>
                      <td className="py-2 text-slate-600">{v.issuedAt ? new Date(v.issuedAt).toLocaleDateString("en-GB") : "—"}</td>
                      <td className="py-2 text-slate-600">{exp ? exp.toLocaleDateString("en-GB") : "—"}</td>
                      <td className="py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          expired ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        }`}>
                          {expired ? "Expired" : "Current"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        {/* Biometrics — daily HR */}
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Heart size={16} className="text-rose-500" />
            <h2 className="text-base font-semibold">Heart rate (daily resting)</h2>
            <span className="text-xs text-slate-500 ml-auto">
              {data.biometrics.window.from} → {data.biometrics.window.to}
            </span>
          </div>
          {!hrStats ? (
            <p className="text-sm text-slate-500">
              No biometric readings captured yet in this period.
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-4 gap-3 text-sm mb-4">
                <Stat label="Days" value={String(hrStats.count)} />
                <Stat label="Mean" value={`${hrStats.mean.toFixed(1)} bpm`} />
                <Stat label="Min" value={`${hrStats.min} bpm`} />
                <Stat label="Max" value={`${hrStats.max} bpm`} />
              </dl>
              <HrSparkline points={hrStats.points.map((p) => p.bpm as number)} />
              <div className="mt-3 text-xs text-slate-500">
                Typical canine resting HR is 60-100 bpm (large breeds skew lower, small breeds higher).
              </div>
            </>
          )}
        </section>

        {/* Footer / disclaimer */}
        <footer className="text-xs text-slate-500 pt-4 pb-8 text-center space-y-1">
          {data.sharedBy.note && <p className="italic">"{data.sharedBy.note}"</p>}
          <p>Shared on {new Date(data.sharedBy.createdAt).toLocaleDateString("en-GB")} by the owner. Access expires {sharedExpiry.toLocaleDateString("en-GB")}.</p>
          <p>This view is read-only. Data sourced from tracker integration + owner records.</p>
        </footer>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 mt-0.5">{value || "—"}</dd>
    </div>
  );
}

function Note({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-0.5">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function HrSparkline({ points }: { points: number[] }) {
  if (points.length === 0) return null;
  const w = 600, h = 80, pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  const stepX = points.length > 1 ? (w - 2 * pad) / (points.length - 1) : 0;
  const path = points
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = h - pad - ((v - min) / span) * (h - 2 * pad);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
      <path d={path} fill="none" stroke="rgb(244, 63, 94)" strokeWidth={2} strokeLinejoin="round" />
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="rgb(226,232,240)" strokeWidth={1} />
    </svg>
  );
}
