import { Link } from "react-router-dom";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import type { Pet } from "@shared/types/pet";

function ageFrom(dob: string): string {
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000);
  return years < 1 ? `${Math.round(years * 12)} mo` : `${Math.floor(years)} yr`;
}

export function PetsScreen() {
  const { data, isLoading } = usePortalQuery<{ pets: Pet[] }>(["portal", "pets"], "/portal/pets");

  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">My pets</h1>
      {isLoading || !data ? (
        <div className="space-y-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : data.pets.length === 0 ? (
        <EmptyState title="No pets on file" body="Contact your daycare to add a pet." />
      ) : (
        <ul className="space-y-2">
          {data.pets.map((p) => (
            <li key={p.id}>
              <Link
                to={`/pets/${p.id}`}
                className="flex gap-3 items-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3"
              >
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt="" className="size-14 rounded-xl object-cover" />
                ) : (
                  <div className="size-14 rounded-xl bg-neutral-200 dark:bg-neutral-800 grid place-items-center text-xl">
                    🐶
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="text-xs text-neutral-500">
                    {p.breed} · {ageFrom(p.dob)} · {p.weightKg} kg
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
