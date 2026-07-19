import React, { useState } from 'react';
import { Pet } from '../../types';
import { useCustomerStore } from '../../store';
import { derivePetFlagToggle, isPetFlagActive } from '../../petFlagToggle';
import { getFlagIcon, getFlagLabel } from '../../flagMeta';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Checkbox } from '../../../../components/ui/checkbox';
import { Textarea } from '../../../../components/ui/textarea';
import { toast } from 'sonner';
import {
  ForkKnife,
  Warning,
  FileText,
  PencilSimple,
  Check,
  X,
  CircleNotch,
} from '@phosphor-icons/react';

interface PetCareProfileTabProps {
  pet: Pet;
}

type CareField = 'feeding_instructions' | 'allergies' | 'medical_notes' | 'behaviour_notes';

interface CareSection {
  field: CareField;
  title: string;
  Icon: typeof ForkKnife;
  /** Card / title / body tone classes — preserved from the read-only cards. */
  cardClass: string;
  titleClass: string;
  bodyClass: string;
  iconClass: string;
  placeholder: string;
  staffOnly: boolean;
}

const CARE_SECTIONS: CareSection[] = [
  {
    field: 'feeding_instructions',
    title: 'Feeding',
    Icon: ForkKnife,
    cardClass: '',
    titleClass: '',
    bodyClass: 'text-sm whitespace-pre-wrap',
    iconClass: 'h-5 w-5',
    placeholder: 'e.g., 2 cups of dry food twice daily, no treats after 6pm',
    staffOnly: false,
  },
  {
    field: 'allergies',
    title: 'Allergies',
    Icon: Warning,
    cardClass: 'border-amber-200 bg-amber-50',
    titleClass: 'text-amber-900',
    bodyClass: 'text-sm text-amber-900 whitespace-pre-wrap',
    iconClass: 'h-5 w-5 text-amber-600',
    placeholder: 'e.g., Allergic to chicken, wheat sensitivity',
    staffOnly: false,
  },
  {
    field: 'medical_notes',
    title: 'Medical Notes',
    Icon: Warning,
    cardClass: 'border-blue-200 bg-blue-50',
    titleClass: 'text-blue-900',
    bodyClass: 'text-sm text-blue-900 whitespace-pre-wrap',
    iconClass: 'h-5 w-5 text-blue-600',
    placeholder: 'e.g., Hip dysplasia, takes medication for arthritis',
    staffOnly: true,
  },
  {
    field: 'behaviour_notes',
    title: 'Behaviour Notes',
    Icon: FileText,
    cardClass: 'border-purple-200 bg-purple-50',
    titleClass: 'text-purple-900',
    bodyClass: 'text-sm text-purple-800 whitespace-pre-wrap',
    iconClass: 'h-5 w-5 text-purple-600',
    placeholder: 'e.g., Nervous around loud noises, plays well with other dogs',
    staffOnly: true,
  },
];

/**
 * Care profile — the four note sections are inline-editable (pencil →
 * textarea → save/cancel, same pattern as the household name on
 * HouseholdDetailPage, adapted for multiline: Ctrl/Cmd+Enter saves, Escape
 * cancels) so staff can record an allergy change or new bite history
 * without opening the full 20-field Edit Pet modal. Saves go through the
 * customers store's updatePet, which emits the customers-module realtime
 * broadcast — open check-in screens re-validate against fresh notes.
 */
export function PetCareProfileTab({ pet }: PetCareProfileTabProps) {
  if (!pet) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-400">
          <p>No care profile information available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CareNeedsCard pet={pet} />
      {CARE_SECTIONS.map((section) => (
        <EditableCareCard key={section.field} pet={pet} section={section} />
      ))}
    </div>
  );
}

/**
 * Boolean care needs, each a friendly control over an existing operational
 * flag (no parallel data model): ticking ensures an ACTIVE pet-scoped flag,
 * unticking deactivates it, and the tick state is read straight from the
 * household's live flags (fetched by PetProfilePage on load). The server's
 * flag routes enforce the same edit roles as pet updates.
 */
function CareNeedsCard({ pet }: { pet: Pet }) {
  const { flags, createFlag, updateFlag } = useCustomerStore();
  const [saving, setSaving] = useState(false);

  const diaperKey = 'needs_diaper' as const;
  const DiaperIcon = getFlagIcon(diaperKey);
  const diaperLabel = getFlagLabel(diaperKey);
  const checked = isPetFlagActive(flags, pet.id, diaperKey);

  const toggleDiaper = async (next: boolean) => {
    if (saving) return;
    const action = derivePetFlagToggle(flags, pet.id, diaperKey, next);
    if (action.type === 'none') return;
    setSaving(true);
    try {
      if (action.type === 'create') {
        // severity 'warn': shows wherever flags render AND surfaces as an
        // acknowledgeable warning at check-in (flag_gate) — staff must see a
        // care need like this when the dog arrives, not just on the profile.
        await createFlag(pet.household_id, {
          flag_key: diaperKey,
          severity: 'warn',
          pet_id: pet.id,
          is_active: true,
          reason: 'Set from the pet care profile',
        });
      } else if (action.type === 'activate') {
        // Reactivation also normalises severity — older tick-box flags were
        // created as 'info', which never reached the check-in warnings.
        await updateFlag(action.flagId, { is_active: true, severity: 'warn' });
      } else {
        await updateFlag(action.flagId, { is_active: false });
      }
      toast.success(next ? `${diaperLabel} flag raised` : `${diaperLabel} flag cleared`);
    } catch {
      toast.error(`Could not update the ${diaperLabel.toLowerCase()} flag — please try again`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Care Needs</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Whole row is the tap target (touch-target = 44px floor); the
            checkbox itself keeps its compact visual size. */}
        <label className="touch-target flex items-center gap-3 cursor-pointer select-none">
          <Checkbox
            checked={checked}
            disabled={saving}
            onCheckedChange={(value) => void toggleDiaper(value === true)}
            aria-label={diaperLabel}
          />
          <DiaperIcon className="h-5 w-5 text-slate-500" />
          <span className="text-sm font-medium">{diaperLabel}</span>
          {saving && <CircleNotch className="h-4 w-4 animate-spin text-slate-400" />}
        </label>
      </CardContent>
    </Card>
  );
}

function EditableCareCard({ pet, section }: { pet: Pet; section: CareSection }) {
  const { field, title, Icon, cardClass, titleClass, bodyClass, iconClass, placeholder, staffOnly } = section;
  const { updatePet, fetchPetProfile } = useCustomerStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const value = pet[field] ?? '';

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (!saving) setEditing(false);
  };

  const save = async () => {
    if (saving) return;
    const next = draft.trim();
    if (next === value.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      // Send the (possibly empty) string — `undefined` would be dropped from
      // the JSON body and the server's spread-merge would keep the old note.
      // Stale safety notes must be clearable.
      await updatePet(pet.id, { [field]: next });
      await fetchPetProfile(pet.id);
      toast.success(`${title} updated`);
      setEditing(false);
    } catch {
      toast.error(`Could not update ${title.toLowerCase()} — please try again`);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Multiline adaptation of the household-name semantics: plain Enter
    // inserts a newline, Ctrl/Cmd+Enter saves, Escape cancels.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  return (
    <Card className={`group ${cardClass}`}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={iconClass} />
            <CardTitle className={titleClass}>{title}</CardTitle>
            {staffOnly && <Badge variant="outline" className="text-xs">Staff Only</Badge>}
          </div>
          {!editing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={startEdit}
              aria-label={`Edit ${title.toLowerCase()}`}
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white/60"
            >
              <PencilSimple className="h-4 w-4 text-slate-500" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={3}
              autoFocus
              disabled={saving}
              className="bg-white"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? <CircleNotch className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <p className="text-xs text-slate-500 ml-auto">Ctrl/⌘+Enter to save · Esc to cancel</p>
            </div>
          </div>
        ) : value ? (
          <p className={bodyClass}>{value}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">Not recorded</p>
        )}
      </CardContent>
    </Card>
  );
}
