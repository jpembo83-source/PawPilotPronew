import { render, act } from "@testing-library/react";
// @ts-ignore - screen is exported at runtime by @testing-library/react v16 but types lag
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

function Probe() {
  const online = useOnlineStatus();
  return <span data-testid="status">{online ? "online" : "offline"}</span>;
}

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
}

describe("useOnlineStatus", () => {
  it("tracks offline → online transitions from browser events", () => {
    setNavigatorOnLine(true);
    render(<Probe />);
    expect(screen.getByTestId("status").textContent).toBe("online");

    // Airplane mode: banner state must flip immediately.
    act(() => {
      setNavigatorOnLine(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByTestId("status").textContent).toBe("offline");

    // Signal back: clears without any user action.
    act(() => {
      setNavigatorOnLine(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByTestId("status").textContent).toBe("online");
  });

  it("reads the current value on mount, not a stale default", () => {
    setNavigatorOnLine(false);
    render(<Probe />);
    expect(screen.getByTestId("status").textContent).toBe("offline");
    setNavigatorOnLine(true);
  });
});
