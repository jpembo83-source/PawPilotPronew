/**
 * Branded React splash curtain — covers the entire viewport with the brand
 * cream while React mounts and the first queries land.
 *
 * Why it exists:
 *   Without this, the user sees the iOS LaunchScreen → WebView paints → React
 *   hydrates → HomeScreen renders with `isLoading: true`, which means a
 *   half-drawn pink-paw hero placeholder, a "UP NEXT" eyebrow, and an empty
 *   skeleton card.  Even though it's "correct" loading state, it reads as
 *   broken because the hero photo isn't there yet.
 *
 * Architecture:
 *   1. iOS LaunchScreen.storyboard — solid cream (#F4F3EF), no image
 *   2. Capacitor SplashScreen plugin — solid cream, launchAutoHide:false
 *   3. THIS component — solid cream + branded wordmark, fades out after the
 *      first React paint + a minimum hold so the seam from native to React
 *      is invisible
 *
 * The seam between layers 1 → 2 → 3 is exactly the same colour value, so the
 * native-to-web handoff is visually continuous.  Then the curtain fades out
 * to reveal the Home screen with its hero photo fully loaded.
 */
import { useEffect, useState } from "react";
import { PawPrint } from "lucide-react";
import { useBranding } from "@/lib/branding";

interface SplashCurtainProps {
  /** Minimum visible time in ms — prevents a sub-100ms flash on fast loads. */
  minDurationMs?: number;
  /** Fade-out animation length in ms. */
  fadeMs?: number;
}

export function SplashCurtain({
  minDurationMs = 700,
  fadeMs = 450,
}: SplashCurtainProps) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);
  // White-label: the curtain greets the user with THEIR daycare's name (from
  // the cached brand config, so it's present on first paint). Never the
  // product name — and no text at all until a brand name is known.
  const brandName = useBranding((s) => s.brand.name?.trim() ?? "");

  useEffect(() => {
    const mountedAt = Date.now();
    let cancelled = false;
    let fadeTimer: number | undefined;
    let unmountTimer: number | undefined;

    // Wait for two paints so the wordmark has rendered and Capacitor has
    // had a chance to start fading its own splash.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const elapsed = Date.now() - mountedAt;
        const remaining = Math.max(0, minDurationMs - elapsed);

        fadeTimer = window.setTimeout(async () => {
          if (cancelled) return;
          setVisible(false);

          // Tell Capacitor's native splash to fade too — they overlap by
          // design so the user only sees one continuous fade-out.
          try {
            const mod = await import("@capacitor/splash-screen");
            await mod.SplashScreen.hide({ fadeOutDuration: fadeMs });
          } catch {
            /* Web build — no native splash to hide. */
          }

          // Unmount the curtain from the DOM after the fade so it doesn't
          // intercept clicks or burn paint cycles.
          unmountTimer = window.setTimeout(() => {
            if (!cancelled) setMounted(false);
          }, fadeMs + 50);
        }, remaining);
      });
    });

    return () => {
      cancelled = true;
      if (fadeTimer)    window.clearTimeout(fadeTimer);
      if (unmountTimer) window.clearTimeout(unmountTimer);
    };
  }, [minDurationMs, fadeMs]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center"
      style={{
        backgroundColor: "#F4F3EF",
        opacity: visible ? 1 : 0,
        transition: `opacity ${fadeMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        pointerEvents: visible ? "auto" : "none",
      }}
      aria-hidden={!visible}
    >
      <div className="flex flex-col items-center select-none animate-breathe">
        <PawPrint
          size={52}
          strokeWidth={1.3}
          className="text-foreground/60 mb-3"
          aria-hidden="true"
        />
        {brandName && (
          <span
            className="font-display text-foreground tracking-[-0.02em]"
            style={{ fontSize: 30, lineHeight: 1 }}
          >
            {brandName}
          </span>
        )}
      </div>
    </div>
  );
}
