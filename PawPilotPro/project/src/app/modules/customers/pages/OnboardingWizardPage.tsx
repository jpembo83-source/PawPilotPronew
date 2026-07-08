// New Customer Onboarding Wizard
// Chains household → contact → pet → waiver → portal invite into one
// continuous front-desk flow. Every step commits on advance, so an
// interruption mid-wizard loses at most the current step; abandoning after
// step 1 leaves a valid household, same as the standalone flow. Back
// navigation edits the already-created records via the update actions.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  CaretDown,
  CheckCircle,
  Circle,
  Dog,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Warning,
  X,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible';
import { Progress } from '../../../components/ui/progress';
import { useCustomerStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import type { Household } from '../types';
import {
  HouseholdFormFields,
  initialHouseholdFormData,
  validateHouseholdForm,
  buildHouseholdPayload,
} from '../components/forms/HouseholdFormFields';
import {
  ContactBasicFields,
  ContactSettingsFields,
  ContactConsentFields,
  ContactAddressFields,
  initialContactFormData,
  validateContactForm,
  buildContactPayload,
  type ContactFormData,
} from '../components/forms/ContactFormSections';
import {
  PetEssentialFields,
  PetPhysicalFields,
  PetAddressFields,
  PetCareFields,
  PetVetFields,
  PetEnrolmentFields,
  initialPetFormData,
  buildPetPayload,
  type PetFormData,
} from '../components/forms/PetFormSections';
import { DocumentUploadForm } from '../components/forms/DocumentUploadForm';
import { ContactDuplicateNotice, HouseholdNameDuplicateNotice } from '../components/forms/DuplicateNotice';
import { useUnsavedChangesGuard, formIsDirty } from '../../../hooks/useUnsavedChangesGuard';
import { sendPortalInviteRequest, notifyPortalActionResult } from '../portalAdmin';

const STEPS = [
  { key: 'household', label: 'Household' },
  { key: 'contact', label: 'Contact' },
  { key: 'pet', label: 'Pet' },
  { key: 'waiver', label: 'Waiver' },
  { key: 'portal', label: 'Portal invite' },
] as const;

const FINISH_INDEX = STEPS.length;

// The wizard marks the contact as primary automatically.
const initialWizardContactForm: ContactFormData = {
  ...initialContactFormData,
  is_primary: true,
};

/** Collapsed disclosure for the optional sections of a step. */
function MoreDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between">
          More details
          <CaretDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-6 space-y-6">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function OnboardingWizardPage() {
  const navigate = useNavigate();
  const {
    createHousehold,
    updateHousehold,
    createContact,
    updateContact,
    createPet,
    updatePet,
  } = useCustomerStore();
  const { locations, fetchLocations } = useSettingsStore();

  useEffect(() => {
    void fetchLocations();
  }, [fetchLocations]);

  const [stepIndex, setStepIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1 — household (created on first advance, updated on later advances)
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdForm, setHouseholdForm] = useState(initialHouseholdFormData);
  // Form values as of the last commit — the Exit guard compares against this,
  // so only UNCOMMITTED edits count as unsaved.
  const [savedHouseholdForm, setSavedHouseholdForm] = useState(initialHouseholdFormData);
  const [householdErrors, setHouseholdErrors] = useState<Record<string, string>>({});

  // Step 2 — primary contact (marked primary automatically)
  const [contactId, setContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormData>(initialWizardContactForm);
  const [savedContactForm, setSavedContactForm] = useState<ContactFormData>(initialWizardContactForm);
  const [contactError, setContactError] = useState<string | null>(null);

  // Step 3 — pets ("Add another pet" loops the step)
  const [savedPets, setSavedPets] = useState<Array<{ id: string; form: PetFormData }>>([]);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [petForm, setPetForm] = useState<PetFormData>(initialPetFormData);
  const [petError, setPetError] = useState<string | null>(null);

  // Steps 4 & 5
  const [waiverUploaded, setWaiverUploaded] = useState(false);
  const [waiverFormDirty, setWaiverFormDirty] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const goNext = () => setStepIndex(i => Math.min(i + 1, FINISH_INDEX));
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));

  // Uncommitted edits on the CURRENT step — committed steps are already
  // persisted, so exiting only ever risks the step being worked on.
  const currentStepDirty = (): boolean => {
    switch (stepIndex) {
      case 0:
        return formIsDirty(householdForm, savedHouseholdForm);
      case 1:
        return formIsDirty(contactForm, savedContactForm);
      case 2:
        return editingPetId
          ? formIsDirty(petForm, savedPets.find(p => p.id === editingPetId)?.form ?? initialPetFormData)
          : formIsDirty(petForm, initialPetFormData);
      case 3:
        return waiverFormDirty;
      default:
        return false;
    }
  };

  const { requestClose: requestExit, guardDialog: exitGuardDialog } = useUnsavedChangesGuard({
    isDirty: currentStepDirty,
    onClose: () => {
      void navigate(household ? `/customers/${household.id}` : '/customers');
    },
    description: "This step hasn't been saved. Leaving the wizard now will lose what you've entered on it.",
  });

  const handleExit = () => {
    void requestExit();
  };

  const errorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  // ── Step 1: household ────────────────────────────────────────────────────
  const handleHouseholdNext = async () => {
    const errors = validateHouseholdForm(householdForm);
    setHouseholdErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      if (household) {
        const updated = await updateHousehold(household.id, buildHouseholdPayload(householdForm));
        setHousehold(updated);
      } else {
        const created = await createHousehold(buildHouseholdPayload(householdForm));
        setHousehold(created);
        toast.success(`Household created: ${created.name}`);
      }
      setSavedHouseholdForm(householdForm);
      goNext();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save household'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step 2: primary contact ──────────────────────────────────────────────
  const handleContactChange = (field: keyof ContactFormData, value: string | boolean) => {
    setContactForm(prev => ({ ...prev, [field]: value }));
    setContactError(null);
  };

  const handleContactNext = async () => {
    const validationError = validateContactForm(contactForm);
    if (validationError) {
      setContactError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      if (contactId) {
        await updateContact(contactId, buildContactPayload(contactForm));
      } else {
        const contact = await createContact(household!.id, buildContactPayload(contactForm));
        setContactId(contact.id);
      }
      setSavedContactForm(contactForm);
      goNext();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save contact'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Step 3: pets ─────────────────────────────────────────────────────────
  const handlePetChange = (field: keyof PetFormData, value: string | boolean) => {
    setPetForm(prev => ({ ...prev, [field]: value }));
    setPetError(null);
  };

  const petFormStarted = petForm.name.trim().length > 0 || editingPetId !== null;

  const commitCurrentPet = async (): Promise<boolean> => {
    if (!petForm.name.trim()) {
      setPetError('Pet name is required');
      return false;
    }

    setIsSaving(true);
    try {
      if (editingPetId) {
        await updatePet(editingPetId, buildPetPayload(petForm));
        setSavedPets(prev => prev.map(p => (p.id === editingPetId ? { id: p.id, form: petForm } : p)));
      } else {
        const pet = await createPet(household!.id, buildPetPayload(petForm));
        setSavedPets(prev => [...prev, { id: pet.id, form: petForm }]);
      }
      return true;
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save pet'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const resetPetForm = () => {
    setPetForm(initialPetFormData);
    setEditingPetId(null);
    setPetError(null);
  };

  const handleAddAnotherPet = async () => {
    if (await commitCurrentPet()) {
      toast.success(`Pet saved: ${petForm.name.trim()}`);
      resetPetForm();
    }
  };

  const handleEditPet = async (saved: { id: string; form: PetFormData }) => {
    // Commit what's currently in the form first so switching never loses work
    if (petFormStarted && !(await commitCurrentPet())) return;
    setPetForm(saved.form);
    setEditingPetId(saved.id);
    setPetError(null);
  };

  const handlePetNext = async () => {
    if (!petFormStarted) {
      goNext();
      return;
    }
    if (await commitCurrentPet()) {
      resetPetForm();
      goNext();
    }
  };

  // ── Step 5: portal invite ────────────────────────────────────────────────
  const contactEmail = contactId ? contactForm.email.trim() : '';

  const handleSendInvite = async () => {
    setIsSaving(true);
    try {
      const body = await sendPortalInviteRequest(household!.id);
      await notifyPortalActionResult(body, 'Invite email sent');
      setInviteSent(true);
      goNext();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to send invite'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Finish checklist ─────────────────────────────────────────────────────
  const petNames = savedPets.map(p => p.form.name.trim()).filter(Boolean);
  const checklist: Array<{
    label: string;
    done: boolean;
    detail: string;
    fixStep?: number;
    fixLabel?: string;
  }> = [
    {
      label: 'Household',
      done: true,
      detail: household?.name ?? '',
    },
    {
      label: 'Primary contact',
      done: !!contactId,
      detail: contactId
        ? `${contactForm.first_name} ${contactForm.last_name}`.trim()
        : 'Not added',
      fixStep: 1,
      fixLabel: 'Add contact',
    },
    {
      label: savedPets.length === 1 ? 'Pet' : 'Pets',
      done: savedPets.length > 0,
      detail: savedPets.length > 0 ? petNames.join(', ') : 'Not added',
      fixStep: 2,
      fixLabel: 'Add pet',
    },
    {
      label: 'Waiver',
      done: waiverUploaded,
      detail: waiverUploaded ? 'Uploaded' : 'No waiver on file — the household will show as flagged',
      fixStep: 3,
      fixLabel: 'Upload waiver',
    },
    {
      label: 'Portal invite',
      done: inviteSent,
      detail: inviteSent ? `Sent to ${contactEmail}` : 'Not sent',
      fixStep: 4,
      fixLabel: 'Send invite',
    },
  ];

  const isFinish = stepIndex === FINISH_INDEX;
  const currentStep = isFinish ? null : STEPS[stepIndex];
  const progressValue = ((isFinish ? STEPS.length : stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Persistent progress header — sticky so it survives scrolling on mobile */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-semibold text-slate-900">
              {isFinish
                ? 'All done'
                : `Step ${stepIndex + 1} of ${STEPS.length} · ${currentStep!.label}`}
            </p>
            <Button variant="ghost" size="sm" onClick={handleExit}>
              <X className="h-4 w-4 mr-1" />
              Exit
            </Button>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        {/* ── Step 1: Household ─────────────────────────────────────────── */}
        {stepIndex === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Household Details</CardTitle>
            </CardHeader>
            <CardContent>
              <HouseholdFormFields
                formData={householdForm}
                errors={householdErrors}
                onChange={(field, value) => setHouseholdForm(prev => ({ ...prev, [field]: value }))}
                locations={locations}
              />
              {/* Repeat-customer nudge — fuzzy name match, never blocks.
                  When the notice renders null the empty div's margin collapses
                  into the footer's, so spacing is unchanged. */}
              <div className="mt-6">
                <HouseholdNameDuplicateNotice name={householdForm.name} excludeHouseholdId={household?.id} />
              </div>
              <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
                <Button onClick={() => void handleHouseholdNext()} disabled={isSaving}>
                  {isSaving ? 'Saving…' : household ? 'Save & Continue' : 'Create & Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Primary contact ───────────────────────────────────── */}
        {stepIndex === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Primary Contact</CardTitle>
              <p className="text-sm text-slate-600">
                This person is marked as the household's primary contact automatically.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {contactError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <Warning className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{contactError}</p>
                </div>
              )}

              <ContactBasicFields formData={contactForm} onChange={handleContactChange} disabled={isSaving} />

              {/* Non-blocking duplicate nudge — matches in OTHER households only */}
              <ContactDuplicateNotice
                email={contactForm.email}
                phone={contactForm.phone}
                excludeHouseholdId={household?.id}
              />

              <MoreDetails>
                <ContactSettingsFields formData={contactForm} onChange={handleContactChange} disabled={isSaving} />
                <ContactConsentFields formData={contactForm} onChange={handleContactChange} disabled={isSaving} />
                <ContactAddressFields formData={contactForm} onChange={handleContactChange} disabled={isSaving} />
              </MoreDetails>

              <div className="flex justify-between gap-3 pt-4 border-t">
                <Button variant="outline" onClick={goBack} disabled={isSaving}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex gap-3">
                  {!contactId && (
                    <Button variant="ghost" onClick={goNext} disabled={isSaving}>
                      Skip
                    </Button>
                  )}
                  <Button onClick={() => void handleContactNext()} disabled={isSaving}>
                    {isSaving ? 'Saving…' : 'Save & Continue'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Pet ───────────────────────────────────────────────── */}
        {stepIndex === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>{editingPetId ? 'Edit Pet' : savedPets.length > 0 ? 'Add Another Pet' : 'First Pet'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {savedPets.length > 0 && (
                <div className="space-y-2">
                  {savedPets.map(saved => (
                    <div
                      key={saved.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-slate-50"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Dog className="h-4 w-4 text-slate-500 shrink-0" />
                        <p className="text-sm font-medium truncate">
                          {saved.form.name.trim()}
                          {saved.id === editingPetId && (
                            <span className="text-slate-500 font-normal"> — editing</span>
                          )}
                        </p>
                      </div>
                      {saved.id !== editingPetId && (
                        <Button variant="ghost" size="sm" onClick={() => void handleEditPet(saved)} disabled={isSaving}>
                          <PencilSimple className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {petError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <Warning className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{petError}</p>
                </div>
              )}

              <PetEssentialFields formData={petForm} onChange={handlePetChange} />

              {/* Allergy/behaviour info is the safety payoff of onboarding —
                  keep the care textareas in front of staff, not collapsed. */}
              <PetCareFields formData={petForm} onChange={handlePetChange} />

              <MoreDetails>
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900">Physical Details</h3>
                  <PetPhysicalFields formData={petForm} onChange={handlePetChange} />
                </div>
                <PetAddressFields formData={petForm} onChange={handlePetChange} />
                <PetVetFields formData={petForm} onChange={handlePetChange} />
                <PetEnrolmentFields formData={petForm} onChange={handlePetChange} />
              </MoreDetails>

              <div className="flex flex-wrap justify-between gap-3 pt-4 border-t">
                <Button variant="outline" onClick={goBack} disabled={isSaving}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div className="flex flex-wrap gap-3">
                  {savedPets.length === 0 && !petFormStarted && (
                    <Button variant="ghost" onClick={goNext} disabled={isSaving}>
                      Skip
                    </Button>
                  )}
                  {petFormStarted && (
                    <Button variant="outline" onClick={() => void handleAddAnotherPet()} disabled={isSaving}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add another pet
                    </Button>
                  )}
                  {(petFormStarted || savedPets.length > 0) && (
                    <Button onClick={() => void handlePetNext()} disabled={isSaving}>
                      {isSaving ? 'Saving…' : 'Save & Continue'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Waiver ────────────────────────────────────────────── */}
        {stepIndex === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Waiver</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {waiverUploaded && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800">
                    Waiver uploaded. You can upload another document below or continue.
                  </p>
                </div>
              )}

              <DocumentUploadForm
                householdId={household!.id}
                initialType="waiver"
                submitLabel="Upload & Continue"
                onUploaded={() => {
                  setWaiverUploaded(true);
                  toast.success('Waiver uploaded');
                  goNext();
                }}
                onDirtyChange={setWaiverFormDirty}
              />

              {!waiverUploaded && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <Warning className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    No waiver yet — the household will be flagged as missing a signed waiver until one is uploaded.
                  </p>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4 border-t">
                <Button variant="outline" onClick={goBack} disabled={isSaving}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button variant={waiverUploaded ? 'default' : 'ghost'} onClick={goNext}>
                  {waiverUploaded ? 'Continue' : 'Skip — no waiver yet'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 5: Portal invite ─────────────────────────────────────── */}
        {stepIndex === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Portal Invite</CardTitle>
              <p className="text-sm text-slate-600">
                Let this household self-serve booking requests, vaccination uploads, and pet profile views.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {inviteSent ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800">Portal invite sent to {contactEmail}.</p>
                </div>
              ) : contactEmail ? (
                <Button onClick={() => void handleSendInvite()} disabled={isSaving} className="w-full sm:w-auto">
                  <PaperPlaneTilt className="h-4 w-4 mr-2" />
                  {isSaving ? 'Sending…' : `Send portal invite to ${contactEmail}`}
                </Button>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-sm text-slate-700">
                    No contact email on file — add an email address to the primary contact to send a portal invite.
                    You can send one later from the household's Portal tab.
                  </p>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4 border-t">
                <Button variant="outline" onClick={goBack} disabled={isSaving}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button variant={inviteSent ? 'default' : 'ghost'} onClick={goNext} disabled={isSaving}>
                  {inviteSent ? 'Finish' : 'Skip'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Finish: summary checklist ─────────────────────────────────── */}
        {isFinish && household && (
          <Card>
            <CardHeader>
              <CardTitle>{household.name} is set up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-2">
                {checklist.map(item => (
                  <li
                    key={item.label}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                      item.done ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      {item.done ? (
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{item.label}</p>
                        <p className={`text-sm ${item.done ? 'text-slate-600' : 'text-amber-800'}`}>
                          {item.detail}
                        </p>
                      </div>
                    </div>
                    {!item.done && item.fixStep !== undefined && (
                      <Button variant="outline" size="sm" onClick={() => setStepIndex(item.fixStep!)}>
                        {item.fixLabel}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => void navigate(`/customers/${household.id}`)}>
                  Go to household
                </Button>
                <Button onClick={() => void navigate(`/customers/${household.id}?tab=bookings`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Booking
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      {exitGuardDialog}
    </div>
  );
}
