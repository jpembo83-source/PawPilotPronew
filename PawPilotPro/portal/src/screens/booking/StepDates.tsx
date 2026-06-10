import { useState } from "react";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";

export function StepDates({ onNext }: { onNext: () => void }) {
  const { service, setDates } = useBookingDraftStore();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  function handleContinue() {
    let start: Date, end: Date;
    if (service === "overnights") {
      // Multi-night: 17:00 day 1 → 08:00 day N+1
      start = new Date(`${date}T17:00:00`);
      end = new Date(`${endDate}T08:00:00`);
    } else if (service === "grooming") {
      // 1-hour slot from chosen time
      start = new Date(`${date}T${time}:00`);
      end = new Date(start.getTime() + 60 * 60 * 1000);
    } else if (service === "transport") {
      // 2-hour pickup window
      start = new Date(`${date}T${time}:00`);
      end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    } else {
      // Daycare: drop / pick times
      start = new Date(`${date}T${time}:00`);
      end = new Date(`${date}T${endTime}:00`);
    }
    if (end <= start) return;
    setDates(start.toISOString(), end.toISOString());
    onNext();
  }

  const subtitle =
    service === "overnights"
      ? "Pick your check-in and check-out dates. Staff will confirm."
      : service === "grooming"
        ? "Pick a date and start time. Staff will confirm."
        : service === "transport"
          ? "Pick the pickup date and a 2-hour window."
          : "Pick a date and drop-off / pickup times.";

  return (
    <>
      <header className="mb-6 anim-fade-in">
        <p className="text-eyebrow mb-2">Step 3</p>
        <h1 className="text-display-sm mb-1.5">When?</h1>
        <p className="text-[14px] text-muted-foreground">{subtitle}</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-4 mb-7 anim-slide-up space-y-4">
        <Field label={service === "overnights" ? "Check-in date" : "Date"}>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] text-tabular focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
          />
        </Field>

        {service === "overnights" && (
          <Field label="Check-out date">
            <input
              type="date"
              value={endDate}
              min={date}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] text-tabular focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
            />
          </Field>
        )}

        {(service === "daycare" || service === "grooming" || service === "transport") && (
          <Field
            label={
              service === "transport"
                ? "Pickup time"
                : service === "grooming"
                  ? "Appointment time"
                  : "Drop-off time"
            }
          >
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] text-tabular focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
            />
          </Field>
        )}

        {service === "daycare" && (
          <Field label="Pickup time">
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] text-tabular focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
            />
          </Field>
        )}
      </div>

      <button
        onClick={handleContinue}
        className="press group relative flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] overflow-hidden"
      >
        <span
          className="absolute inset-x-0 top-0 h-px bg-white/20 pointer-events-none"
          aria-hidden="true"
        />
        <span className="tracking-[-0.005em]">Continue</span>
      </button>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-eyebrow block mb-2">{label}</span>
      {children}
    </label>
  );
}
