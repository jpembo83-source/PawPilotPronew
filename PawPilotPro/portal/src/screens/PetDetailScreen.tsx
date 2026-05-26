import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { RequestEditSheet } from "./components/RequestEditSheet";
import type { Pet } from "@shared/types/pet";
import type { Vaccination, VaxStatus } from "@shared/types/vaccination";

interface PetDetailData {
  pet: Pet;
  vaccinations: Vaccination[];
}

function vaxStatus(v: Vaccination): VaxStatus {
  const exp = new Date(v.expiresAt).getTime();
  const now = Date.now();
  if (exp < now) return "expired";
  if (exp - now < 30 * 86_400_000) return "expiring";
  return "current";
}

const VAX_STYLE: Record<VaxStatus, string> = {
  current: "bg-emerald-100 text-emerald-800",
  expiring: "bg-amber-100 text-amber-800",
  expired: "bg-rose-100 text-rose-800",
};

const VAX_LABEL: Record<VaxStatus, string> = {
  current: "Current",
  expiring: "Expiring",
  expired: "Expired",
};

export function PetDetailScreen() {
  const { id } = useParams();
  const { data, isLoading } = usePortalQuery<PetDetailData>(
    ["portal", "pets", id],
    `/portal/pets/${id}`,
    { enabled: !!id },
  );
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <main className="p-5">
        <Skeleton className="h-40" />
      </main>
    );
  }

  return (
    <main className="px-5 pt-6 max-w-md mx-auto pb-12">
      <Link to="/pets" className="text-sm text-blue-600 mb-3 inline-block">
        ← All pets
      </Link>
      <div className="flex gap-4 items-start mb-6">
        {data.pet.photoUrl ? (
          <img src={data.pet.photoUrl} alt="" className="size-20 rounded-2xl object-cover" />
        ) : (
          <div className="size-20 rounded-2xl bg-neutral-200 dark:bg-neutral-800 grid place-items-center text-3xl">
            🐶
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold">{data.pet.name}</h1>
          <p className="text-sm text-neutral-500">{data.pet.breed}</p>
          <p className="text-xs text-neutral-400 mt-1">
            {data.pet.weightKg} kg · born {new Date(data.pet.dob).toLocaleDateString()}
          </p>
        </div>
      </div>

      {data.pet.notes && (
        <section className="mb-5 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 text-sm">
          {data.pet.notes}
        </section>
      )}

      <section className="mb-6">
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Vaccinations</h2>
          <Link to={`/pets/${id}/vax/upload`} className="text-sm text-blue-600 font-medium">
            Upload
          </Link>
        </header>
        {data.vaccinations.length === 0 ? (
          <p className="text-sm text-neutral-500">None on file.</p>
        ) : (
          <ul className="space-y-2">
            {data.vaccinations.map((v) => {
              const s = vaxStatus(v);
              return (
                <li
                  key={v.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">{v.vaxType}</p>
                    <p className="text-xs text-neutral-500">
                      Expires {new Date(v.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${VAX_STYLE[s]}`}
                  >
                    {VAX_LABEL[s]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        onClick={() => setEditOpen(true)}
        className="w-full h-12 rounded-xl border border-neutral-200 dark:border-neutral-800 text-sm font-medium"
      >
        Request profile edit
      </button>

      <RequestEditSheet open={editOpen} onClose={() => setEditOpen(false)} petId={data.pet.id} />
    </main>
  );
}
