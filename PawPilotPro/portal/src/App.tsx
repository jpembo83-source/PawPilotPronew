import { useEffect, useState } from "react";
import { getPortalApi } from "@/lib/api";

export default function App() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    getPortalApi().get<{ ok: boolean }>("/portal/health")
      .then(r => setStatus(r.ok ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-widest text-neutral-500">PawPilotPro</p>
        <h1 className="text-2xl font-semibold">
          {status === "loading" && "Connecting…"}
          {status === "ok" && "Portal online"}
          {status === "error" && "Backend unreachable"}
        </h1>
      </div>
    </main>
  );
}
