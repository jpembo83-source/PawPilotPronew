
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { initConnectivityMonitor } from "./app/hooks/useConnectivity";
  import "./styles/index.css";

  initConnectivityMonitor();

  createRoot(document.getElementById("root")!).render(<App />);
