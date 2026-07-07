import { useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { useBookingDraftStore } from "@/stores/bookingDraftStore";

function formatDateDisplay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (isNaN(d.getTime())) return "Pick a date";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/**
 * Native pickers, app skin. The real <input type="date|time"> stays — it's
 * the reliable choice on mobile — but it's stretched invisibly over a
 * styled trigger row, so the CLOSED state matches the design language
 * while every tap still opens the platform picker.
 */
function NativePickerRow({
  icon,
  display,
  children,
}: {
  icon: React.ReactNode;
  display: string;
  children: React.ReactNode; // the native input (rendered invisible on top)
}) {
  return (
    <div className="relative h-12 rounded-xl border border-input bg-input-background transition-shadow focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
      <div className="pointer-events-none absolute inset-0 flex items-center gap-2.5 px-3.5" aria-hidden="true">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <span className="text-[15px] text-foreground text-tabular truncate">{display}</span>
      </div>
      {children}
    </div>
  );
}

// Invisible but fully tappable native input, stretched over the styled row.
const NATIVE_INPUT_CLASS = "absolute inset-0 w-full h-full opacity-0 cursor-pointer";

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
          <NativePickerRow icon={<CalendarDays size={16} strokeWidth={2.2} />} display={formatDateDisplay(date)}>
            <input
              type="date"
              value={date}
              min={today}
              onChange={(e) => setDate(e.target.value)}
              className={NATIVE_INPUT_CLASS}
            />
          </NativePickerRow>
        </Field>

        {service === "overnights" && (
          <Field label="Check-out date">
            <NativePickerRow icon={<CalendarDays size={16} strokeWidth={2.2} />} display={formatDateDisplay(endDate)}>
              <input
                type="date"
                value={endDate}
                min={date}
                onChange={(e) => setEndDate(e.target.value)}
                className={NATIVE_INPUT_CLASS}
              />
            </NativePickerRow>
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
            <NativePickerRow icon={<Clock size={16} strokeWidth={2.2} />} display={time}>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={NATIVE_INPUT_CLASS}
              />
            </NativePickerRow>
          </Field>
        )}

        {service === "daycare" && (
          <Field label="Pickup time">
            <NativePickerRow icon={<Clock size={16} strokeWidth={2.2} />} display={endTime}>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={NATIVE_INPUT_CLASS}
              />
            </NativePickerRow>
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
