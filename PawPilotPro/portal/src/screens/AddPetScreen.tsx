import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, PawPrint } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getPortalApi } from "@/lib/api";
import type { NewPetRequest } from "@shared/types/household";

/**
 * Owner-requested new pet. Lands in the staff app's verification queue
 * (`portal_pet_verification:{tenantId}:{id}`) and the pet itself is written
 * with `verification_status: "pending_staff_review"` — so it shows in the
 * portal's pet list immediately with a "Pending team verification" badge,
 * but won't appear in booking selectors until staff confirms identity.
 */
export function AddPetScreen() {
  const nav = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "unknown">("unknown");
  const [dob, setDob] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [weight, setWeight] = useState("");
  const [neutered, setNeutered] = useState<"yes" | "no" | "unknown">("unknown");
  const [colour, setColour] = useState("");

  const create = useMutation({
    mutationFn: (payload: NewPetRequest) => getPortalApi().post("/portal/pets", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "pets"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "home"] });
      toast.success("Pet added — the team will confirm shortly");
      nav("/pets", { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't add pet"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Pet name is required");
      return;
    }
    const weightNum = weight ? Number(weight) : null;
    if (weight && (isNaN(weightNum!) || weightNum! < 0 || weightNum! > 200)) {
      toast.error("Weight should be in kilograms");
      return;
    }
    create.mutate({
      name: name.trim(),
      breed: breed.trim() || undefined,
      sex,
      dob: dob || undefined,
      microchip: microchip.trim() || undefined,
      weight_kg: weightNum,
      neutered: neutered === "unknown" ? undefined : neutered === "yes",
      colour: colour.trim() || undefined,
    });
  }

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
        <span className="text-[15px] font-semibold tracking-tight">Add a pet</span>
      </header>

      <section className="anim-fade-in mb-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-12 rounded-2xl bg-secondary text-secondary-foreground grid place-items-center">
            <PawPrint size={22} strokeWidth={2} />
          </div>
          <p className="text-eyebrow">New family member</p>
        </div>
        <h1 className="text-display-sm leading-tight">Tell us about them</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed">
          We'll confirm the details with you next time you're in — once
          verified, you can book sessions for them too.
        </p>
      </section>

      <form onSubmit={submit} className="space-y-5 anim-slide-up">
        <Field label="Pet's name" value={name} onChange={setName} required placeholder="e.g. Luna" />
        <Field label="Breed" value={breed} onChange={setBreed} placeholder="e.g. Cockapoo" />

        <Select
          label="Sex"
          value={sex}
          onChange={(v) => setSex(v as typeof sex)}
          options={[
            { value: "unknown", label: "Prefer not to say" },
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
          ]}
        />

        <Field label="Date of birth" type="date" value={dob} onChange={setDob} />

        <Field
          label="Weight (kg)"
          type="number"
          value={weight}
          onChange={setWeight}
          placeholder="optional"
        />

        <Field label="Colour" value={colour} onChange={setColour} placeholder="optional" />

        <Field
          label="Microchip number"
          value={microchip}
          onChange={setMicrochip}
          placeholder="optional — helps us verify faster"
        />

        <Select
          label="Neutered / spayed?"
          value={neutered}
          onChange={(v) => setNeutered(v as typeof neutered)}
          options={[
            { value: "unknown", label: "Not sure" },
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ]}
        />

        <button
          type="submit"
          disabled={create.isPending}
          className="press relative flex items-center justify-center w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] disabled:opacity-50"
        >
          {create.isPending ? "Adding…" : "Send to the team"}
        </button>
        <p className="text-[12px] text-muted-foreground text-center leading-relaxed -mt-1">
          The team will verify identity and microchip before you can book sessions for them.
        </p>
      </form>
    </main>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
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
        placeholder={placeholder}
        required={required}
        inputMode={type === "number" ? "decimal" : undefined}
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
