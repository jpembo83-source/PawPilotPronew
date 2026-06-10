/**
 * Horizontal strip of pet avatars used to switch which pet is featured
 * on the HomeScreen hero.  Only renders when the household has more than
 * one pet — single-pet households don't need the switcher.
 *
 * Tapping an avatar updates the persisted heroPetStore and the rest of
 * the screen (hero photo, PulseHero, timeline fetches) re-renders
 * against the new selection.
 */
import { PawPrint } from "lucide-react";
import type { Pet } from "@shared/types/pet";
import { useHeroPetStore } from "@/stores/heroPetStore";

interface Props {
  pets: Pet[];
}

export function PetSwitcherStrip({ pets }: Props) {
  const { heroPetId, setHeroPetId } = useHeroPetStore();

  if (pets.length <= 1) return null;

  return (
    <nav
      aria-label="Featured pet"
      className="px-5 pt-4 -mt-2"
    >
      <ul className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
        {pets.map((p) => {
          const selected = (heroPetId ?? pets[0]?.id) === p.id;
          return (
            <li key={p.id} className="shrink-0">
              <button
                onClick={() => setHeroPetId(p.id)}
                aria-pressed={selected}
                aria-label={`Feature ${p.name}`}
                className="press group flex flex-col items-center gap-1.5"
              >
                <span
                  className={`relative size-14 rounded-full grid place-items-center overflow-hidden transition-shadow ${
                    selected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-[var(--shadow-sm)]"
                      : "ring-1 ring-border"
                  }`}
                >
                  {p.photoUrl ? (
                    <img
                      src={p.photoUrl}
                      alt=""
                      className={`size-full object-cover transition-[filter,opacity] ${
                        selected ? "" : "opacity-90 group-hover:opacity-100"
                      }`}
                    />
                  ) : (
                    <span
                      className="size-full bg-secondary text-secondary-foreground grid place-items-center"
                      aria-hidden="true"
                    >
                      <PawPrint size={20} strokeWidth={1.8} />
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] leading-tight max-w-[64px] truncate text-center ${
                    selected ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {p.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
