import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { useNavigate, useRouteError } from "react-router-dom";
import { PawPrint, RefreshCw } from "lucide-react";
import { brandDisplayName } from "@/lib/branding";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Called when the user taps "Try again" — navigate home, clear state, etc. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last line of defence against render errors. Without this, any uncaught
 * exception during render white-screens the whole Capacitor shell. Catches,
 * logs locally, and shows a branded fallback the owner can recover from.
 *
 * Note: React Router data routers (createBrowserRouter) trap render errors
 * inside the nearest route `errorElement` — they never reach a React error
 * boundary mounted above <RouterProvider>. So this class guards everything
 * outside the router (providers, splash, toaster), while RouteErrorFallback
 * below is wired up as the router's root errorElement for route errors.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Local console only — never ship user data or tokens (repo logging rules).
    console.error("[ErrorBoundary] render error caught", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}

/**
 * Root `errorElement` for the router — catches render/loader errors thrown
 * inside any route and shows the same branded fallback. "Try again" clears
 * the router's error state by navigating home.
 */
export function RouteErrorFallback() {
  const error = useRouteError();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("[ErrorBoundary] route error caught", error);
  }, [error]);

  return <ErrorFallback onReset={() => void navigate("/", { replace: true })} />;
}

/** Branded fallback shared by the app-level boundary and the router errorElement. */
function ErrorFallback({ onReset }: { onReset: () => void }) {
  return (
    <main className="min-h-dvh flex flex-col px-6 pt-16 pb-10 max-w-sm mx-auto">
      <header className="mb-7 anim-fade-in">
        <p className="text-eyebrow mb-3">{brandDisplayName()}</p>
        <h1 className="text-display">Something went wrong</h1>
      </header>
      <div className="rounded-2xl border border-border bg-card p-5 anim-slide-up">
        <div className="size-11 rounded-xl bg-secondary text-secondary-foreground grid place-items-center mb-3.5">
          <PawPrint size={20} strokeWidth={2.2} />
        </div>
        <h2 className="font-semibold text-[15px] mb-1.5">
          Something went wrong — your data is safe.
        </h2>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
          An unexpected hiccup stopped this screen from loading. Nothing has been
          lost — try again and we&rsquo;ll take you back home.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="press flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
        >
          <RefreshCw size={16} strokeWidth={2.2} />
          <span className="tracking-[-0.005em]">Try again</span>
        </button>
      </div>
    </main>
  );
}
