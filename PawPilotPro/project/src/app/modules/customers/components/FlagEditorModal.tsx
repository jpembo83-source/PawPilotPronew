// Flag editor — the single create/edit surface for operational flags.
// Opened from the household Notes & Flags tab (pet optional) and from the
// pet profile header (pet fixed), so "reactive dog at the front desk" to
// "live check-in warning" is one dialog either way.
import React, { useState } from 'react';
import { HouseholdFlag, Pet, FlagKey, FlagSeverity } from '../types';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { toast } from 'sonner';
import { useCustomerStore } from '../store';
import { useUnsavedChangesGuard, formIsDirty } from '../../../hooks/useUnsavedChangesGuard';
import { FLAG_KEYS, SEVERITY_OPTIONS, getFlagIcon, getFlagLabel } from '../flagMeta';

interface FlagEditorModalProps {
  open: boolean;
  onClose: () => void;
  householdId: string;
  /** Pets offered in the "applies to" picker (household entry point). */
  pets?: Pet[];
  /** Fixes the flag to one pet and hides the picker (pet-profile entry point). */
  fixedPet?: Pet | null;
  /** Existing flag switches the dialog to edit mode (type and pet are fixed). */
  flag?: HouseholdFlag | null;
}

// NOTE: mount conditionally ({show && <FlagEditorModal open …/>}) like
// EditNoteModal, so the form state initialises fresh for each flag/pet.

const HOUSEHOLD_WIDE = 'household-wide';

export function FlagEditorModal({
  open,
  onClose,
  householdId,
  pets = [],
  fixedPet = null,
  flag = null,
}: FlagEditorModalProps) {
  const { createFlag, updateFlag } = useCustomerStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = !!flag;
  const initialFormData: { flag_key: FlagKey; severity: FlagSeverity; reason: string; pet_id: string | null } = {
    flag_key: flag?.flag_key ?? 'behaviour_caution',
    severity: flag?.severity ?? 'warn',
    reason: flag?.reason ?? '',
    pet_id: flag?.pet_id ?? fixedPet?.id ?? null,
  };
  const [formData, setFormData] = useState(initialFormData);

  // Every dismissal path (Cancel button, overlay click, Escape) funnels
  // through requestClose, so a dirty form is always guarded.
  const { requestClose, guardDialog } = useUnsavedChangesGuard({
    isDirty: () => formIsDirty(formData, initialFormData),
    onClose: () => {
      setFormData(initialFormData);
      onClose();
    },
    description: isEdit
      ? "This flag's changes haven't been saved yet. Closing now will lose them."
      : "This flag hasn't been created yet. Closing now will lose what you've entered.",
  });

  const severityMeta = SEVERITY_OPTIONS.find((s) => s.value === formData.severity);
  const TypeIcon = getFlagIcon(formData.flag_key);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (flag) {
        // Backend PATCH supports severity/reason/is_active; type and pet
        // are fixed after creation — clear and re-add to change those.
        await updateFlag(flag.id, {
          severity: formData.severity,
          reason: formData.reason.trim() || undefined,
        });
        toast.success('Flag updated — check-in screens see it immediately');
      } else {
        await createFlag(householdId, {
          flag_key: formData.flag_key,
          severity: formData.severity,
          is_active: true,
          ...(formData.reason.trim() ? { reason: formData.reason.trim() } : {}),
          ...(formData.pet_id ? { pet_id: formData.pet_id } : {}),
        });
        toast.success('Flag created — check-in screens see it immediately');
      }
      setFormData(initialFormData);
      onClose();
    } catch (error) {
      console.error('Failed to save flag:', error);
      toast.error(isEdit ? 'Failed to update flag — please try again' : 'Failed to create flag — please try again');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) void requestClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Flag' : 'Add Operational Flag'}</DialogTitle>
          <DialogDescription>
            {fixedPet
              ? `Flags for ${fixedPet.name} appear on their profile and gate check-in`
              : 'Flags appear on the household and gate check-in for the pets they cover'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <Label htmlFor="flag_key">Flag Type *</Label>
            {isEdit ? (
              <div className="flex items-center gap-2 mt-1 p-2.5 border rounded-md bg-slate-50 text-sm font-medium text-slate-700">
                <TypeIcon className="h-4 w-4" />
                {getFlagLabel(formData.flag_key)}
              </div>
            ) : (
              <Select
                value={formData.flag_key}
                onValueChange={(value) => setFormData({ ...formData, flag_key: value as FlagKey })}
              >
                <SelectTrigger id="flag_key">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLAG_KEYS.map((key) => {
                    const Icon = getFlagIcon(key);
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {getFlagLabel(key)}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="severity">Severity *</Label>
            <Select
              value={formData.severity}
              onValueChange={(value) => setFormData({ ...formData, severity: value as FlagSeverity })}
            >
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} — {opt.explanation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {severityMeta && (
              <p className="text-sm text-muted-foreground mt-1.5">{severityMeta.explanation}.</p>
            )}
          </div>

          {!isEdit && !fixedPet && pets.length > 0 && (
            <div>
              <Label htmlFor="pet_id">Applies To</Label>
              <Select
                value={formData.pet_id || HOUSEHOLD_WIDE}
                onValueChange={(value) =>
                  setFormData({ ...formData, pet_id: value === HOUSEHOLD_WIDE ? null : value })
                }
              >
                <SelectTrigger id="pet_id">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HOUSEHOLD_WIDE}>Household-wide (all pets)</SelectItem>
                  {pets.map((pet) => (
                    <SelectItem key={pet.id} value={pet.id}>
                      {pet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="reason">Reason / Details</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="What should staff know? Shown word-for-word at check-in…"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Saving…'
                : isEdit
                ? 'Save Changes'
                : 'Create Flag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {guardDialog}
    </Dialog>
  );
}
