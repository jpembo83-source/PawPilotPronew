/**
 * Persisted "which pet is the Home hero" preference.
 *
 * The HomeScreen featurés ONE pet at a time — its photo is the hero, its
 * pulse drives the big breathing display, its timeline feeds the
 * editorial snapshot.  With multi-pet households the original behaviour
 * ("first pet with a photo") leaves the other pets feeling invisible.
 *
 * This store remembers which pet the owner last picked so it sticks
 * across cold launches.  The HomeScreen falls back to the first
 * available pet when nothing's stored yet (fresh install) or when the
 * stored pet no longer exists (deleted from the household).
 *
 * Storage is the standard Capacitor / WKWebView localStorage — small,
 * synchronous, and survives app updates as long as the bundle id stays
 * the same.
 */
import { create } from "zustand";

const KEY = "ppp.home.heroPetId.v1";

interface HeroPetStore {
  heroPetId: string | null;
  setHeroPetId: (id: string | null) => void;
}

function load(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function save(id: string | null) {
  try {
    if (id == null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch {
    // Private mode / quota — silent. The store still works in-memory for
    // the current session.
  }
}

export const useHeroPetStore = create<HeroPetStore>((set) => ({
  heroPetId: load(),
  setHeroPetId: (id) => {
    save(id);
    set({ heroPetId: id });
  },
}));
