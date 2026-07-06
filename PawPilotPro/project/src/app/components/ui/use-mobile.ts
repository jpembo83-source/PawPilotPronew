import * as React from "react";

// THE mobile check — the app previously had three independent copies of
// this (here, App.tsx, Transportation.tsx) that could disagree. This keeps
// the most robust semantics: viewport width OR a mobile user agent, so a
// phone reporting a wide viewport still gets the touch-first experience.
const MOBILE_BREAKPOINT = 768;
const MOBILE_UA = /iPhone|iPad|iPod|Android/i;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < MOBILE_BREAKPOINT || MOBILE_UA.test(navigator.userAgent),
      );
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}
