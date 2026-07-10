// Vaccine checklists per operating region, keyed by the canonical
// vaccination_type values of the vaccination:{tenant}:{petId}:{id} records
// (see supabase/functions/server/vaccinations_routes.tsx). The schedule only
// drives which vaccines the staff checklist OFFERS and how they're labelled —
// stored records are region-agnostic.
//
// Selection comes from organisation settings (vaccinationSchedule, default
// 'uk' — the app operates in the UK per the README). The Swiss list the old
// hardcoded SWISS_VACCINATIONS constant carried is preserved as the 'ch'
// option.

export type VaccinationType =
  | 'dhpp'
  | 'rabies'
  | 'bordetella'
  | 'leptospirosis'
  | 'canine_influenza'
  | 'lyme'
  | 'other';

export type VaccineScheduleRegion = 'uk' | 'ch';

export interface VaccineScheduleItem {
  type: Exclude<VaccinationType, 'other'>;
  label: string;
  description: string;
  required: boolean;
}

export const UK_VACCINATIONS: VaccineScheduleItem[] = [
  {
    type: 'dhpp',
    label: 'DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)',
    description: 'Core combination vaccine — puppy course then regular boosters',
    required: true,
  },
  {
    type: 'leptospirosis',
    label: 'Leptospirosis',
    description: 'Core in the UK — annual booster',
    required: true,
  },
  {
    type: 'bordetella',
    label: 'Kennel Cough (Bordetella)',
    description: 'Expected for daycare and boarding — typically annual',
    required: true,
  },
  {
    type: 'rabies',
    label: 'Rabies',
    description: 'Only required for pets travelling abroad (Animal Health Certificate)',
    required: false,
  },
  {
    type: 'canine_influenza',
    label: 'Canine Influenza',
    description: 'Uncommon in the UK — record if administered',
    required: false,
  },
];

export const SWISS_VACCINATIONS: VaccineScheduleItem[] = [
  {
    type: 'dhpp',
    label: 'DHPP (Staupe, Hepatitis, Parvovirose, Parainfluenza)',
    description: 'Core combination vaccine — puppy course then regular boosters',
    required: true,
  },
  {
    type: 'rabies',
    label: 'Rabies (Tollwut)',
    description: 'Required in Switzerland and for cross-border travel',
    required: true,
  },
  {
    type: 'leptospirosis',
    label: 'Leptospirosis',
    description: 'Recommended annually',
    required: true,
  },
  {
    type: 'bordetella',
    label: 'Kennel Cough (Zwingerhusten)',
    description: 'Expected for daycare and boarding — typically annual',
    required: true,
  },
  {
    type: 'canine_influenza',
    label: 'Canine Influenza',
    description: 'Record if administered',
    required: false,
  },
];

export const VACCINE_SCHEDULES: Record<
  VaccineScheduleRegion,
  { label: string; items: VaccineScheduleItem[] }
> = {
  uk: { label: 'United Kingdom', items: UK_VACCINATIONS },
  ch: { label: 'Switzerland', items: SWISS_VACCINATIONS },
};

/** Resolve a stored org setting to a schedule; anything unknown → UK. */
export function scheduleForRegion(region: string | undefined): VaccineScheduleItem[] {
  return VACCINE_SCHEDULES[(region as VaccineScheduleRegion) ?? 'uk']?.items ?? UK_VACCINATIONS;
}
