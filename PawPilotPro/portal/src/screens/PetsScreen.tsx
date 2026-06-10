import { Link } from "react-router-dom";
import { ChevronRight, PawPrint, Plus, Clock, Heart } from "lucide-react";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import type { Pet } from "@shared/types/pet";

function ageFrom(dob: string): string {
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 86_400_000);
  return years < 1 ? `${Math.round(years * 12)} mo` : `${Math.floor(years)} yr`;
}

export function PetsScreen() {
  const { data, isLoading } = usePortalQuery<{ pets: Pet[] }>(["portal", "pets"], "/portal/pets");

  return (
    <main className="px-5 pt-8 pb-4 max-w-md mx-auto">
      <header className="mb-7 anim-fade-in">
        <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground mb-2">
          Household
        </p>
        <div className="flex items-end justify-between gap-3">
          <h1 className="font-display leading-[0.95] tracking-[-0.015em]" style={{ fontSize: 40 }}>
            Our pets
          </h1>
          <Link
            to="/pets/add"
            className="press inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-foreground text-background text-[12px] font-medium shrink-0"
            style={{ boxShadow: "var(--shadow-xs)" }}
          >
            <Plus size={13} strokeWidth={2.4} />
            Add a pet
          </Link>
        </div>
        {data?.pets && data.pets.length > 0 && (
          <p className="text-[12px] text-muted-foreground mt-3">
            {data.pets.length} {data.pets.length === 1 ? "companion" : "companions"} · tap any one to see today's pulse.
          </p>
        )}
      </header>

      {isLoading || !data ? (
        <ul className="space-y-3">
          <li><Skeleton className="h-[180px] rounded-3xl" /></li>
          <li><Skeleton className="h-[180px] rounded-3xl opacity-60" /></li>
        </ul>
      ) : data.pets.length === 0 ? (
        <EmptyPets />
      ) : (
        <ul className="space-y-3">
          {data.pets.map((p, i) => {
            const pending = p.verificationStatus === "pending_staff_review";
            return (
              <li
                key={p.id}
                className="anim-slide-up"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <PetCard pet={p} pending={pending} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function PetCard({ pet: p, pending }: { pet: Pet; pending: boolean }) {
  return (
    <Link
      to={`/pets/${p.id}`}
      className="press group relative block overflow-hidden rounded-3xl bg-card border border-border"
      style={{ boxShadow: "var(--shadow-xs)" }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
        {p.photoUrl ? (
          <img
            src={p.photoUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-secondary to-primary/20">
            <PawPrint size={48} strokeWidth={1.5} className="text-primary/40" />
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-[55%]"
          style={{ background: "linear-gradient(to top, rgba(28,25,22,0.72) 0%, rgba(28,25,22,0.0) 100%)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-white/80 mb-1.5">
              {p.breed || "Companion"}
            </p>
            <h2 className="text-white font-display leading-none tracking-[-0.01em]" style={{ fontSize: 36 }}>
              {p.name}
            </h2>
          </div>
          <span className="size-9 rounded-full bg-white/95 text-foreground grid place-items-center backdrop-blur-sm shrink-0">
            <ChevronRight size={16} strokeWidth={2.4} />
          </span>
        </div>
      </div>

      <div className="px-5 py-3.5 flex items-center gap-4 text-[12px] text-muted-foreground">
        {p.dob && (
          <span className="inline-flex items-center gap-1.5">
            <Clock size={12} strokeWidth={2} />
            {ageFrom(p.dob)}
          </span>
        )}
        {(p.weightKg ?? 0) > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Heart size={12} strokeWidth={2} className="text-rose-500" />
            {p.weightKg} kg
          </span>
        )}
        {pending && (
          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium tracking-wide uppercase">
            Pending review
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyPets() {
  return (
    <div className="text-center py-16 anim-fade-in">
      <div className="size-20 mx-auto mb-5 rounded-full bg-secondary grid place-items-center">
        <PawPrint size={32} strokeWidth={1.5} className="text-primary/70" />
      </div>
      <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-muted-foreground mb-2">
        Empty
      </p>
      <h2 className="font-display leading-tight mb-2" style={{ fontSize: 28 }}>
        No pets here yet.
      </h2>
      <p className="text-sm text-muted-foreground max-w-[28ch] mx-auto mb-5">
        Add the dogs in your household and we'll start tracking their pulse, paws, and progress.
      </p>
      <Link
        to="/pets/add"
        className="press inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-medium"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        <Plus size={14} strokeWidth={2.4} />
        Add your first pet
      </Link>
    </div>
  );
}
