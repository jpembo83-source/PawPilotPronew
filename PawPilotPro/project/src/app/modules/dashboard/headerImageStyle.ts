// Shared visual contract for the location header image — used by the real
// DashboardHeader AND the settings live preview so what the admin approves
// is exactly what renders.
//
// Legibility never depends on the photo: the left-anchored scrim in the
// card colour (white) is ALWAYS on. Worst case for the greeting zone is a
// pure-black image at strength 100 under the 0.75-alpha stop:
// 0.75·white over black = #BFBFBF (L 0.52) vs text #1C1916 (L 0.011)
// → 9.3:1, comfortably past WCAG AA 4.5:1. At the left edge (0.92 stop)
// it is ~14:1. The strength slider only fades the image UNDER this scrim.
// Right of ~45% there is no text (the Today chip is frosted and carries its
// own backdrop), so the scrim falls to clear and the photo shows in full
// colour on the right.
export const HEADER_IMAGE_SCRIM =
  'linear-gradient(90deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.75) 45%, rgba(255,255,255,0.28) 72%, rgba(255,255,255,0) 100%)';

/** Subtle white halo that lifts dark text off busy photo areas. */
export const HEADER_IMAGE_TEXT_SHADOW = '0 1px 2px rgba(255,255,255,0.85), 0 0 12px rgba(255,255,255,0.45)';

export const DEFAULT_HEADER_STRENGTH = 70;

export function headerObjectPosition(focal: { x?: number; y?: number } | null | undefined): string {
  const clamp = (n: unknown) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
  return `${clamp(focal?.x) * 100}% ${clamp(focal?.y) * 100}%`;
}

export function headerImageOpacity(strength: number | undefined): number {
  const s = typeof strength === 'number' && Number.isFinite(strength) ? strength : DEFAULT_HEADER_STRENGTH;
  return Math.min(100, Math.max(0, s)) / 100;
}
