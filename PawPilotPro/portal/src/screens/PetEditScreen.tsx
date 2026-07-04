import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePortalQuery } from "@/hooks/usePortalQuery";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Skeleton } from "@/components/Skeleton";
import { getPortalApi } from "@/lib/api";
import type { Pet, PetPatch, Sex, NeuteredStatus } from "@shared/types/pet";
import type { Vaccination } from "@shared/types/vaccination";

interface PetDetailData {
  pet: Pet;
  vaccinations: Vaccination[];
}

/**
 * Editable pet chart — basics, care, vet, owner notes.
 *
 * Field ownership mirrors the backend allowlist (PATCH /portal/pets/:id):
 * everything here is owner-editable. The staff's clinical/behavioural
 * notes (teamBehaviourNotes / teamMedicalNotes) are intentionally absent
 * from this form — they're displayed read-only on PetDetailScreen as
 * "From the team".
 */
export function PetEditScreen() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  const { data, isLoading } = usePortalQuery<PetDetailData>(
    ["portal", "pets", id],
    `/portal/pets/${id}`,
    { enabled: !!id },
  );

  // Form fields — initialise empty, hydrate from query on first land.
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [sex, setSex] = useState<Sex>("unknown");
  const [dob, setDob] = useState("");
  const [weight, setWeight] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [colour, setColour] = useState("");
  const [neutered, setNeutered] = useState<NeuteredStatus>("unknown");
  const [feeding, setFeeding] = useState("");
  const [allergies, setAllergies] = useState("");
  const [vetName, setVetName] = useState("");
  const [vetPhone, setVetPhone] = useState("");
  const [vetAddress, setVetAddress] = useState("");
  const [ownerNotes, setOwnerNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    const p = data.pet;
    setName(p.name ?? "");
    setBreed(p.breed ?? "");
    setSex((p.sex ?? "unknown") as Sex);
    setDob(p.dob && p.dob !== new Date(0).toISOString() ? p.dob.slice(0, 10) : "");
    setWeight(p.weightKg ? String(p.weightKg) : "");
    setMicrochip(p.microchip ?? "");
    setColour(p.colour ?? "");
    setNeutered((p.neuteredStatus ?? "unknown") as NeuteredStatus);
    setFeeding(p.feedingInstructions ?? "");
    setAllergies(p.allergies ?? "");
    setVetName(p.vetName ?? "");
    setVetPhone(p.vetPhone ?? "");
    setVetAddress(p.vetAddress ?? "");
    setOwnerNotes(p.ownerNotes ?? "");
    setHydrated(true);
  }, [data, hydrated]);

  const update = useMutation({
    mutationFn: (payload: PetPatch) => getPortalApi().patch(`/portal/pets/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal", "pets"] });
      queryClient.invalidateQueries({ queryKey: ["portal", "pets", id] });
      queryClient.invalidateQueries({ queryKey: ["portal", "home"] });
      toast.success("Saved");
      nav(`/pets/${id}`, { replace: true });
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const weightNum = weight ? Number(weight) : null;
    if (weight && (isNaN(weightNum!) || weightNum! < 0 || weightNum! > 200)) {
      toast.error("Weight should be in kilograms");
      return;
    }
    update.mutate({
      name: name.trim(),
      breed: breed.trim() || "",
      sex,
      date_of_birth: dob || "",
      microchip: microchip.trim() || "",
      weight_kg: weightNum,
      colour: colour.trim() || "",
      neutered_status: neutered,
      feeding_instructions: feeding.trim() || null,
      allergies: allergies.trim() || null,
      vet_name: vetName.trim() || null,
      vet_phone: vetPhone.trim() || null,
      vet_address: vetAddress.trim() || null,
      owner_notes: ownerNotes.trim() || null,
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
        <span className="text-[15px] font-semibold tracking-tight">
          {data?.pet.name ? `Edit ${data.pet.name}` : "Edit pet"}
        </span>
      </header>

      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 anim-slide-up">
          {/* BASICS ---------------------------------------------------- */}
          <fieldset className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <legend className="text-eyebrow px-1">Basics</legend>
            <Field label="Name" value={name} onChange={setName} required />
            <Field label="Breed" value={breed} onChange={setBreed} placeholder="e.g. Cockapoo" />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Sex"
                value={sex}
                onChange={(v) => setSex(v as Sex)}
                options={[
                  { value: "unknown", label: "—" },
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                ]}
              />
              <Select
                label="Neutered?"
                value={neutered}
                onChange={(v) => setNeutered(v as NeuteredStatus)}
                options={[
                  { value: "unknown", label: "—" },
                  { value: "neutered", label: "Yes" },
                  { value: "intact", label: "No" },
                ]}
              />
            </div>
            <Field label="Date of birth" type="date" value={dob} onChange={setDob} />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Weight (kg)"
                type="number"
                value={weight}
                onChange={setWeight}
                placeholder="e.g. 18.5"
              />
              <Field label="Colour" value={colour} onChange={setColour} placeholder="optional" />
            </div>
            <Field
              label="Microchip number"
              value={microchip}
              onChange={setMicrochip}
              placeholder="optional"
            />
          </fieldset>

          {/* CARE ----------------------------------------------------- */}
          <fieldset className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <legend className="text-eyebrow px-1">Care</legend>
            <TextArea
              label="Feeding instructions"
              value={feeding}
              onChange={setFeeding}
              placeholder="What and when. Treats they love. Anything to avoid."
              rows={3}
            />
            <TextArea
              label="Allergies & sensitivities"
              value={allergies}
              onChange={setAllergies}
              placeholder="Foods, medications, environmental — anything to keep them away from."
              rows={2}
            />
            <TextArea
              label="Notes for the team"
              value={ownerNotes}
              onChange={setOwnerNotes}
              placeholder="Anything else helpful — favourite toys, quirks, fears, comforts."
              rows={3}
            />
          </fieldset>

          {/* VET ----------------------------------------------------- */}
          <fieldset className="rounded-2xl border border-border bg-card p-4 space-y-4">
            <legend className="text-eyebrow px-1">Vet</legend>
            <Field
              label="Practice name"
              value={vetName}
              onChange={setVetName}
              placeholder="e.g. Hampstead Vets"
            />
            <Field
              label="Practice phone"
              type="tel"
              value={vetPhone}
              onChange={setVetPhone}
              autoComplete="tel"
            />
            <TextArea
              label="Practice address"
              value={vetAddress}
              onChange={setVetAddress}
              placeholder="optional"
              rows={2}
            />
          </fieldset>

          {!online && (
            <p role="status" className="text-sm text-muted-foreground">
              You're offline — you can save this as soon as you're back online.
            </p>
          )}

          <button
            type="submit"
            disabled={update.isPending || !online}
            className="press relative flex items-center justify-center w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold shadow-[var(--shadow-sm)] disabled:opacity-50"
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}
    </main>
  );
}

// ------- form atoms (kept local — Phase A's atoms live in ContactEditScreen
// and AddPetScreen; once we have three copies we'll extract to /components) --

function Field({
  label, value, onChange, type = "text", placeholder, required, autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
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
        autoComplete={autoComplete}
        inputMode={type === "number" ? "decimal" : undefined}
        className="w-full h-12 px-3.5 rounded-xl border border-input bg-input-background text-foreground text-[15px] focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow"
      />
    </label>
  );
}

function TextArea({
  label, value, onChange, placeholder, rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-eyebrow block mb-1.5">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-xl border border-input bg-input-background text-foreground text-[15px] p-3.5 leading-relaxed focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-shadow resize-none"
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
