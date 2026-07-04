import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { Skeleton } from "@/components/Skeleton";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { getPortalApi } from "@/lib/api";
import type {
  ContactCreate,
  ContactPatch,
  HouseholdResponse,
  PreferredContactMethod,
} from "@shared/types/household";

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  preferred_contact_method: PreferredContactMethod | "";
  is_primary: boolean;
  is_emergency_contact: boolean;
  emergency_contact_relationship: string;
  marketing_consent: boolean;
  sms_consent: boolean;
  email_consent: boolean;
}

const EMPTY: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  preferred_contact_method: "",
  is_primary: false,
  is_emergency_contact: false,
  emergency_contact_relationship: "",
  marketing_consent: false,
  sms_consent: false,
  email_consent: false,
};

/**
 * Add or edit a contact. Route convention:
 *   /account/people/new   → create
 *   /account/people/:id   → edit
 *
 * The form is owner-friendly (no "consent management" jargon) but the
 * underlying fields map 1:1 to the staff CRM schema. Validation is
 * intentionally light — server enforces hard rules (required fields,
 * one primary per household).
 */
export function ContactEditScreen() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== "new";
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = usePortalQuery<HouseholdResponse>(
    ["portal", "household"],
    "/portal/household",
  );

  const [form, setForm] = useState<FormState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!isEdit) { setHydrated(true); return; }
    if (!data || hydrated) return;
    const found = data.contacts.find((co) => co.id === id);
    if (found) {
      setForm({
        first_name: found.first_name ?? "",
        last_name: found.last_name ?? "",
        email: found.email ?? "",
        phone: found.phone ?? "",
        preferred_contact_method: found.preferred_contact_method ?? "",
        is_primary: !!found.is_primary,
        is_emergency_contact: !!found.is_emergency_contact,
        emergency_contact_relationship: found.emergency_contact_relationship ?? "",
        marketing_consent: !!found.marketing_consent,
        sms_consent: !!found.sms_consent,
        email_consent: !!found.email_consent,
      });
      setHydrated(true);
    }
  }, [data, hydrated, id, isEdit]);

  const create = useMutation({
    mutationFn: (payload: ContactCreate) => getPortalApi().post("/portal/contacts", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "household"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "account"] });
      toast.success("Contact added");
      nav("/account/people", { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't add contact"),
  });

  const update = useMutation({
    mutationFn: (payload: ContactPatch) => getPortalApi().patch(`/portal/contacts/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "household"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "account"] });
      toast.success("Contact saved");
      nav(-1);
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save contact"),
  });

  const remove = useMutation({
    mutationFn: () => getPortalApi().del(`/portal/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "household"] });
      toast.success("Contact removed");
      nav("/account/people", { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't remove contact"),
  });

  const busy = create.isPending || update.isPending || remove.isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || "",
      phone: form.phone.trim() || "",
      preferred_contact_method: form.preferred_contact_method || null,
      is_primary: form.is_primary,
      is_emergency_contact: form.is_emergency_contact,
      emergency_contact_relationship: form.emergency_contact_relationship.trim() || null,
      marketing_consent: form.marketing_consent,
      sms_consent: form.sms_consent,
      email_consent: form.email_consent,
    };
    if (isEdit) update.mutate(payload as ContactPatch);
    else create.mutate(payload as ContactCreate);
  }

  const existing = isEdit ? data?.contacts.find((co) => co.id === id) : null;
  const showDelete = isEdit && existing && !existing.is_primary;

  return (
    <main className="px-5 pt-4 pb-12 max-w-md mx-auto">
      <header className="flex items-center gap-2 mb-5 -ml-2 anim-fade-in">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="press p-2 rounded-full hover:bg-secondary/60"
          aria-label="Back"
        >
          <ChevronLeft size={20} strokeWidth={2.2} />
        </button>
        <span className="text-[15px] font-semibold tracking-tight">
          {isEdit ? "Edit person" : "Add person"}
        </span>
      </header>

      {isEdit && (!data || isLoading) ? (
        <div className="space-y-4">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5 anim-slide-up">
          {/* NAMES ------------------------------------------------- */}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="First name"
              value={form.first_name}
              onChange={(v) => setForm({ ...form, first_name: v })}
              autoComplete="given-name"
              required
            />
            <Field
              label="Last name"
              value={form.last_name}
              onChange={(v) => setForm({ ...form, last_name: v })}
              autoComplete="family-name"
              required
            />
          </div>

          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            autoComplete="email"
            placeholder="optional"
          />

          <Field
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            autoComplete="tel"
            placeholder="optional"
          />

          <Select
            label="Best way to reach them"
            value={form.preferred_contact_method}
            onChange={(v) => setForm({ ...form, preferred_contact_method: v as PreferredContactMethod | "" })}
            options={[
              { value: "", label: "No preference" },
              { value: "phone", label: "Phone call" },
              { value: "sms", label: "Text message" },
              { value: "email", label: "Email" },
            ]}
          />

          {/* ROLES ------------------------------------------------- */}
          <fieldset className="rounded-2xl border border-border bg-card p-4 space-y-3.5">
            <legend className="text-eyebrow px-1">Role</legend>
            <Toggle
              label="Primary contact"
              hint="The team will contact this person first about anything important."
              checked={form.is_primary}
              onChange={(v) => setForm({ ...form, is_primary: v })}
            />
            <Toggle
              label="Emergency contact"
              hint="We'll call them if we can't reach the primary."
              checked={form.is_emergency_contact}
              onChange={(v) => setForm({ ...form, is_emergency_contact: v })}
            />
            {form.is_emergency_contact && (
              <Field
                label="Relationship"
                value={form.emergency_contact_relationship}
                onChange={(v) => setForm({ ...form, emergency_contact_relationship: v })}
                placeholder="Partner, parent, neighbour…"
              />
            )}
          </fieldset>

          {/* CONSENTS ---------------------------------------------- */}
          <fieldset className="rounded-2xl border border-border bg-card p-4 space-y-3.5">
            <legend className="text-eyebrow px-1">They're OK to receive</legend>
            <Toggle
              label="Booking confirmations & alerts by email"
              checked={form.email_consent}
              onChange={(v) => setForm({ ...form, email_consent: v })}
            />
            <Toggle
              label="Booking confirmations & alerts by SMS"
              checked={form.sms_consent}
              onChange={(v) => setForm({ ...form, sms_consent: v })}
            />
            <Toggle
              label="Marketing — offers, events, newsletters"
              checked={form.marketing_consent}
              onChange={(v) => setForm({ ...form, marketing_consent: v })}
            />
          </fieldset>

          <button
            type="submit"
            disabled={busy}
            className="press relative flex items-center justify-center w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] disabled:opacity-50"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Add to household"}
          </button>

          {showDelete && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmRemove(true)}
                className="press inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-border bg-card text-[13.5px] font-semibold text-destructive hover:border-destructive/40 disabled:opacity-50"
              >
                <Trash2 size={15} strokeWidth={2.2} />
                Remove from household
              </button>
              <ConfirmSheet
                open={confirmRemove}
                onClose={() => setConfirmRemove(false)}
                onConfirm={() => {
                  setConfirmRemove(false);
                  remove.mutate();
                }}
                title="Remove this person from the household?"
                body="Their details will come off your household record — you can add them back anytime."
                confirmLabel="Remove person"
                cancelLabel="Keep them"
              />
            </>
          )}
        </form>
      )}
    </main>
  );
}

// ------- tiny form atoms -----------------------------------------------

function Field({
  label, value, onChange, type = "text", autoComplete, placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-eyebrow block mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
      />
    </label>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-eyebrow block mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 px-3 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function Toggle({
  label, hint, checked, onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-5 rounded border-2 border-border accent-primary cursor-pointer"
      />
      <span className="flex-1">
        <span className="block text-[14px] font-medium leading-tight">{label}</span>
        {hint && <span className="block text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}
