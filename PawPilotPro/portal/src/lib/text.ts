/**
 * Text sanitisers — used wherever we render server-supplied narrative copy
 * (Invoxia life_reports, insight narratives, etc.).
 *
 * Why this exists:
 *   Invoxia's `life_report.msg` field includes emoji like 🐾 ✨ 📊 inside the
 *   prose.  Our brand voice is editorial and our design system is strictly
 *   anti-emoji (we use Phosphor/Lucide icon primitives at deliberate stroke
 *   weights instead).  Letting upstream emoji leak through breaks the look.
 *   Strip them at the render boundary, not at ingest — we keep the raw text
 *   in the database for future audit / vet-share / debugging.
 */

// Cover the contiguous emoji + symbol blocks plus the ZWJ + variation
// selector glue that joins compound emoji like 🐕‍🦺.
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}]/gu;
const JOINER_RE = /[‍️︎]/g;

/**
 * Remove all emoji + glue characters from a string.  Collapses any whitespace
 * left in their place and trims.  Safe on undefined / null (returns "").
 */
export function stripEmoji(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(EMOJI_RE, "")
    .replace(JOINER_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}
