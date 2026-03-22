import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pet, PetVaccinations, VaccinationEntry, SWISS_VACCINATIONS } from '../../types';
import { useCustomerStore } from '../../store';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';
import {
  Syringe,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

interface VaccinationManagerProps {
  petId: string;
  pet: Pet;
}

function toDateOnly(d: Date): string {
  return d.toISOString().split('T')[0];
}

function computeVaccinationStatus(vaccinations?: PetVaccinations): {
  status: 'up_to_date' | 'expiring_soon' | 'expired' | 'unknown';
  earliestExpiry?: string;
} {
  if (!vaccinations) return { status: 'unknown' };

  const todayStr = toDateOnly(new Date());
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const thirtyDaysStr = toDateOnly(thirtyDays);

  let hasAnyDone = false;
  let hasExpired = false;
  let hasExpiringSoon = false;
  let earliestExpiry: string | undefined;

  for (const vac of SWISS_VACCINATIONS) {
    const entry = vaccinations[vac.key];
    if (!entry?.done) continue;
    hasAnyDone = true;

    if (entry.expiry_date) {
      if (!earliestExpiry || entry.expiry_date < earliestExpiry) {
        earliestExpiry = entry.expiry_date;
      }
      if (entry.expiry_date < todayStr) {
        hasExpired = true;
      } else if (entry.expiry_date <= thirtyDaysStr) {
        hasExpiringSoon = true;
      }
    }
  }

  if (!hasAnyDone) return { status: 'unknown' };
  if (hasExpired) return { status: 'expired', earliestExpiry };
  if (hasExpiringSoon) return { status: 'expiring_soon', earliestExpiry };
  return { status: 'up_to_date', earliestExpiry };
}

export function VaccinationManager({ petId, pet }: VaccinationManagerProps) {
  const updatePet = useCustomerStore((s) => s.updatePet);
  const [vaccinations, setVaccinations] = useState<PetVaccinations>(pet.vaccinations || {});
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<PetVaccinations>(vaccinations);

  useEffect(() => {
    setVaccinations(pet.vaccinations || {});
    latestDataRef.current = pet.vaccinations || {};
  }, [pet.vaccinations]);

  const debouncedSave = useCallback((data: PetVaccinations) => {
    latestDataRef.current = data;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      performSave(latestDataRef.current);
    }, 500);
  }, [petId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const performSave = async (data: PetVaccinations) => {
    setIsSaving(true);
    try {
      const computed = computeVaccinationStatus(data);
      await updatePet(petId, {
        vaccinations: data,
        vaccination_status: computed.status,
        vaccination_expiry_date: computed.earliestExpiry,
      });
      toast.success('Vaccinations updated');
    } catch (err: any) {
      console.error('Failed to save vaccinations:', err);
      toast.error('Failed to save vaccinations');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof PetVaccinations, checked: boolean) => {
    const updated = {
      ...vaccinations,
      [key]: {
        ...vaccinations[key],
        done: checked,
        expiry_date: checked ? vaccinations[key]?.expiry_date : undefined,
      },
    };
    setVaccinations(updated);
    debouncedSave(updated);
  };

  const handleExpiryChange = (key: keyof PetVaccinations, date: string) => {
    const updated = {
      ...vaccinations,
      [key]: {
        ...vaccinations[key],
        done: true,
        expiry_date: date || undefined,
      },
    };
    setVaccinations(updated);
    debouncedSave(updated);
  };

  const overall = computeVaccinationStatus(vaccinations);
  const getOverallDisplay = () => {
    switch (overall.status) {
      case 'up_to_date':
        return { icon: ShieldCheck, label: 'Up to Date', className: 'text-green-600' };
      case 'expiring_soon':
        return { icon: AlertTriangle, label: 'Expiring Soon', className: 'text-orange-600' };
      case 'expired':
        return { icon: ShieldAlert, label: 'Action Required', className: 'text-red-600' };
      default:
        return { icon: AlertCircle, label: 'No Records', className: 'text-slate-500' };
    }
  };

  const display = getOverallDisplay();

  const getEntryStatus = (entry?: VaccinationEntry) => {
    if (!entry?.done) return null;
    if (!entry.expiry_date) return { label: 'Done', variant: 'default' as const, className: 'bg-green-100 text-green-800 border-0' };

    const todayStr = toDateOnly(new Date());
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const thirtyDaysStr = toDateOnly(thirtyDays);

    if (entry.expiry_date < todayStr) return { label: 'Expired', variant: 'destructive' as const, className: '' };
    if (entry.expiry_date <= thirtyDaysStr) return { label: 'Expiring Soon', variant: 'secondary' as const, className: 'bg-orange-100 text-orange-800 border-0' };
    return { label: 'Valid', variant: 'default' as const, className: 'bg-green-100 text-green-800 border-0' };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Syringe className="h-5 w-5" />
            <div>
              <CardTitle>Vaccinations</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <display.icon className={`h-4 w-4 ${display.className}`} />
                <span className={`text-sm font-medium ${display.className}`}>
                  {display.label}
                </span>
                {isSaving && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-slate-500 mb-4">
          Standard vaccinations for dogs in Switzerland. Tick each vaccination and set the expiry date.
        </p>

        <div className="space-y-3">
          {SWISS_VACCINATIONS.map((vac) => {
            const entry = vaccinations[vac.key];
            const status = getEntryStatus(entry);

            return (
              <div
                key={vac.key}
                className={`p-3 rounded-lg border transition-colors ${
                  entry?.done
                    ? status?.label === 'Expired'
                      ? 'bg-red-50 border-red-200'
                      : status?.label === 'Expiring Soon'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-green-50 border-green-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={entry?.done || false}
                      onChange={(e) => handleToggle(vac.key, e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer flex-shrink-0 mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-900">{vac.label}</span>
                        {vac.required && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700">
                            Required
                          </Badge>
                        )}
                        {status && (
                          <Badge className={`text-[10px] px-1.5 py-0 ${status.className}`} variant={status.variant}>
                            {status.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{vac.description}</p>
                    </div>
                  </label>

                  {entry?.done && (
                    <div className="flex-shrink-0 w-36">
                      <label className="text-[10px] text-slate-500 block mb-0.5">Expiry Date</label>
                      <Input
                        type="date"
                        value={entry.expiry_date || ''}
                        onChange={(e) => handleExpiryChange(vac.key, e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
