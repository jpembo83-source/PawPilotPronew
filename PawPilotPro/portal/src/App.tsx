import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CollarBridgeProvider } from "@/context/CollarBridgeContext";
import { SplashCurtain } from "@/components/SplashCurtain";
import { router } from "@/router";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CollarBridgeProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" />
          {/* Sits on top of every route during the first ~700ms so the seam
              from native cream splash to React-rendered screen is invisible.
              Also tells the Capacitor splash plugin to hide at the same
              moment, so the two layers fade out together. */}
          <SplashCurtain />
        </CollarBridgeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
