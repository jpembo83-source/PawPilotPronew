import { EmptyState } from "@/components/EmptyState";

export function BookingsScreen() {
  return (
    <main className="px-5 pt-6 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-4">Bookings</h1>
      <EmptyState title="Coming in Phase 5" body="Booking list ships with the booking flow." />
    </main>
  );
}
