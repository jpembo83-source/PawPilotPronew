import React, { useEffect, useState } from 'react';
import { WidgetCard } from './WidgetCard';
import { AlertTriangle, FileWarning, Ban, Activity, Syringe } from 'lucide-react';
import { useDaycareStore } from '../../daycare/store';
import { useDashboardStore } from '../store';
import { useCustomerStore } from '../../customers/store';
import { SWISS_VACCINATIONS } from '../../customers/types';
import type { PetVaccinations } from '../../customers/types';
import { supabase } from '../../../../utils/supabase/client';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';

interface AlertCounts {
  vaccinationIssues: number;
  waiverIssues: number;
  behaviourFlags: number;
  medicalFlags: number;
  holds: number;
}

function computePetVaccinationIssue(vaccinations?: PetVaccinations): boolean {
  if (!vaccinations) return false;

  const todayStr = new Date().toISOString().split('T')[0];

  for (const vac of SWISS_VACCINATIONS) {
    const entry = vaccinations[vac.key];
    if (!entry?.done || !entry?.expiry_date) continue;
    if (entry.expiry_date < todayStr) return true;
  }
  return false;
}

function computePetVaccinationExpiringSoon(vaccinations?: PetVaccinations): boolean {
  if (!vaccinations) return false;

  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const thirtyDaysStr = thirtyDays.toISOString().split('T')[0];

  for (const vac of SWISS_VACCINATIONS) {
    const entry = vaccinations[vac.key];
    if (!entry?.done || !entry?.expiry_date) continue;
    if (entry.expiry_date >= todayStr && entry.expiry_date <= thirtyDaysStr) return true;
  }
  return false;
}

export function AlertsFlagsWidget() {
  const [isLoading, setIsLoading] = useState(true);
  const [alertCounts, setAlertCounts] = useState<AlertCounts>({
    vaccinationIssues: 0,
    waiverIssues: 0,
    behaviourFlags: 0,
    medicalFlags: 0,
    holds: 0,
  });

  const { bookings, fetchBookings } = useDaycareStore();
  const { selectedLocationId, refreshTrigger } = useDashboardStore();

  useEffect(() => {
    loadAlerts();
  }, [selectedLocationId, refreshTrigger]);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await fetchBookings({
        booking_date: today,
        location_id: selectedLocationId === 'ALL' ? undefined : selectedLocationId,
      });

      const allBookings = useDaycareStore.getState().bookings;

      const counts: AlertCounts = {
        vaccinationIssues: 0,
        waiverIssues: 0,
        behaviourFlags: 0,
        medicalFlags: 0,
        holds: 0,
      };

      const petIds = [...new Set(allBookings.map(b => b.pet_id).filter(Boolean))];
      const petVacMap = new Map<string, PetVaccinations | undefined>();

      if (petIds.length > 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const headers = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-User-Token': `Bearer ${session.access_token}`,
            };

            const petFetches = petIds.map(id =>
              fetch(
                `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/pets/${id}`,
                { headers }
              )
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
            );

            const pets = await Promise.all(petFetches);
            pets.forEach(pet => {
              if (pet?.id) {
                petVacMap.set(pet.id, pet.vaccinations);
              }
            });
          }
        } catch {
        }
      }

      allBookings.forEach(booking => {
        const petVaccinations = petVacMap.get(booking.pet_id);

        if (petVaccinations) {
          if (computePetVaccinationIssue(petVaccinations) || computePetVaccinationExpiringSoon(petVaccinations)) {
            counts.vaccinationIssues++;
          }
        }

        if (booking.waiver_status === 'expired' || booking.waiver_status === 'expiring_soon') {
          counts.waiverIssues++;
        }

        if (booking.has_behaviour_flag) {
          counts.behaviourFlags++;
        }

        if (booking.has_medical_flag) {
          counts.medicalFlags++;
        }

        if (booking.has_booking_hold || booking.has_payment_hold) {
          counts.holds++;
        }
      });

      setAlertCounts(counts);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalAlerts = Object.values(alertCounts).reduce((sum, count) => sum + count, 0);

  return (
    <WidgetCard 
      title="Alerts & Flags" 
      icon={AlertTriangle}
      description="Issues requiring attention"
    >
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-slate-200 border-t-slate-600 rounded-full mx-auto mb-2"></div>
              <p className="text-xs text-slate-500">Loading alerts...</p>
            </div>
          </div>
        ) : totalAlerts === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No alerts today</p>
            <p className="text-xs text-slate-400 mt-1">All clear!</p>
          </div>
        ) : (
          <>
            {alertCounts.vaccinationIssues > 0 && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg p-3 hover:bg-red-100 transition-colors cursor-pointer">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Syringe className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Vaccination Issues</p>
                  <p className="text-2xl font-bold text-red-700">{alertCounts.vaccinationIssues}</p>
                </div>
              </div>
            )}

            {alertCounts.waiverIssues > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg p-3 hover:bg-amber-100 transition-colors cursor-pointer">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <FileWarning className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Waiver Issues</p>
                  <p className="text-2xl font-bold text-amber-700">{alertCounts.waiverIssues}</p>
                </div>
              </div>
            )}

            {alertCounts.behaviourFlags > 0 && (
              <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-lg p-3 hover:bg-orange-100 transition-colors cursor-pointer">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Behaviour Flags</p>
                  <p className="text-2xl font-bold text-orange-700">{alertCounts.behaviourFlags}</p>
                </div>
              </div>
            )}

            {alertCounts.medicalFlags > 0 && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg p-3 hover:bg-red-100 transition-colors cursor-pointer">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Activity className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Medical Flags</p>
                  <p className="text-2xl font-bold text-red-700">{alertCounts.medicalFlags}</p>
                </div>
              </div>
            )}

            {alertCounts.holds > 0 && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-slate-100 transition-colors cursor-pointer">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <Ban className="h-5 w-5 text-slate-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-600">Account Holds</p>
                  <p className="text-2xl font-bold text-slate-700">{alertCounts.holds}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </WidgetCard>
  );
}
