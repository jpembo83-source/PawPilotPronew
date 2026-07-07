
  import { createRoot } from "react-dom/client";
  import { registerSW } from "virtual:pwa-register";
  import App from "./app/App.tsx";
  import { initConnectivityMonitor } from "./app/hooks/useConnectivity";
  import "./styles/index.css";

  // Stale-shell defence. registerType is 'autoUpdate', but a long-lived
  // phone tab restored from memory never re-checks the service worker on
  // its own — staff were stuck on week-old bundles until a manual reload.
  // Re-check on every return to the foreground (and hourly as a backstop),
  // and reload once when a NEW worker takes over an already-controlled tab
  // (first-ever install must not reload — hence the hadController guard).
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => void registration.update().catch(() => {});
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
      setInterval(check, 60 * 60 * 1000);
    },
  });
  if ("serviceWorker" in navigator) {
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController) window.location.reload();
      hadController = true;
    });
  }

  initConnectivityMonitor();

  createRoot(document.getElementById("root")!).render(<App />);






