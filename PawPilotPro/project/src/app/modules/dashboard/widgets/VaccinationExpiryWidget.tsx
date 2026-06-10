import React, { useEffect, useState } from 'react';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '../../../../utils/supabase/authHeaders';
import { WidgetCard } from './WidgetCard';
import { Badge } from '../../../components/ui/badge';
import {
  Syringe,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDashboardStore } from '../store';
import { supabase } from '../../../../utils/supabase/client';

interface VaccinationAlert {
  pet_id: string;
  pet_name: string;
  household_id: string;
  vaccination_key: string;
  vaccination_label: string;
  expiry_date: string;
  days_until_expiry: number;
  status: 'expired' | 'expiring_soon';
}

const VAC_LABELS: Record<string, string> = {
  rabies: 'Rabies',
  shp: 'SHP',
  leptospirosis: 'Leptospirosis',
  kennel_cough: 'Kennel Cough',
};

export function VaccinationExpiryWidget() {
  const navigate = useNavigate();
  const { selectedLocationId, widgetRefreshTrigger } = useDashboardStore();

  const [alerts, setAlerts] = useState<VaccinationAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchVaccinationAlerts();
  }, [selectedLocationId, widgetRefreshTrigger]);

  const fetchVaccinationAlerts = async () => {
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAlerts([]);
        return;
      }

      const headers = await getAuthHeaders();

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/households`,
        { headers }
      );

      if (!response.ok) {
        setAlerts([]);
        return;
      }

      const households = await response.json();
      const todayStr = new Date().toISOString().split('T')[0];
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const thirtyDaysStr = thirtyDays.toISOString().split('T')[0];
      const computed: VaccinationAlert[] = [];

      const petFetches = [];
      for (const hh of (Array.isArray(households) ? households : [])) {
        petFetches.push(
          fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/customers/households/${hh.id}/pets`,
            { headers }
          ).then(r => r.ok ? r.json() : []).then(pets => ({ householdId: hh.id, pets }))
           .catch(() => ({ householdId: hh.id, pets: [] }))
        );
      }

      const results = await Promise.all(petFetches);

      for (const { householdId, pets } of results) {
        for (const pet of (Array.isArray(pets) ? pets : [])) {
          if (!pet.vaccinations || !pet.active) continue;

          for (const [key, entry] of Object.entries(pet.vaccinations) as [string, any][]) {
            if (!entry?.done || !entry?.expiry_date) continue;
            const expDateStr = entry.expiry_date as string;
            const expMs = new Date(expDateStr).getTime();
            const nowMs = new Date(todayStr).getTime();
            const daysUntil = Math.round((expMs - nowMs) / (1000 * 60 * 60 * 24));

            if (expDateStr <= thirtyDaysStr) {
              computed.push({
                pet_id: pet.id,
                pet_name: pet.name,
                household_id: householdId,
                vaccination_key: key,
                vaccination_label: VAC_LABELS[key] || key,
                expiry_date: expDateStr,
                days_until_expiry: daysUntil,
                status: expDateStr < todayStr ? 'expired' : 'expiring_soon',
              });
            }
          }
        }
      }

      computed.sort((a, b) => a.days_until_expiry - b.days_until_expiry);
      setAlerts(computed);
    } catch (err) {
      console.error('Failed to fetch vaccination alerts:', err);
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (alert: VaccinationAlert) => {
    if (alert.status === 'expired') {
      return <Badge variant="destructive" className="text-xs">Expired</Badge>;
    }
    return <Badge className="bg-orange-500 text-xs">Expiring Soon</Badge>;
  };

  const getStatusIcon = (alert: VaccinationAlert) => {
    if (alert.status === 'expired') {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    return <AlertTriangle className="h-4 w-4 text-orange-500" />;
  };

  const formatExpiryText = (alert: VaccinationAlert) => {
    if (alert.days_until_expiry < 0) {
      return `Expired ${Math.abs(alert.days_until_expiry)} days ago`;
    }
    if (alert.days_until_expiry === 0) {
      return 'Expires today';
    }
    return `Expires in ${alert.days_until_expiry} days`;
  };

  const expiredCount = alerts.filter(a => a.status === 'expired').length;
  const expiringSoonCount = alerts.filter(a => a.status === 'expiring_soon').length;

  if (isLoading) {
    return (
      <WidgetCard title="Vaccination Alerts" icon={Syringe} description="Expiring vaccinations">
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      title="Vaccination Alerts"
      icon={Syringe}
      actions={
        alerts.length > 0 ? (
          <div className="flex gap-1.5">
            {expiredCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {expiredCount} expired
              </Badge>
            )}
            {expiringSoonCount > 0 && (
              <Badge className="bg-orange-500 text-xs">
                {expiringSoonCount} soon
              </Badge>
            )}
          </div>
        ) : undefined
      }
    >
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-8">
          <div className="bg-green-100 rounded-full p-3 mb-3">
            <ShieldCheck className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm font-medium text-slate-900">All Clear!</p>
          <p className="text-xs text-slate-500 mt-1">
            No vaccination alerts in the next 30 days
          </p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto max-h-[280px] pr-1">
          {alerts.slice(0, 8).map((alert, idx) => (
            <div
              key={`${alert.pet_id}-${alert.vaccination_key}-${idx}`}
              className={`
                p-3 rounded-lg border cursor-pointer transition-colors
                ${alert.status === 'expired'
                  ? 'bg-red-50 border-red-200 hover:bg-red-100'
                  : 'bg-orange-50 border-orange-200 hover:bg-orange-100'
                }
              `}
              onClick={() => navigate(`/customers/pets/${alert.pet_id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {getStatusIcon(alert)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {alert.pet_name}
                      </span>
                      {getStatusBadge(alert)}
                    </div>
                    <p className="text-xs text-slate-600 truncate">
                      {alert.vaccination_label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatExpiryText(alert)}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
              </div>
            </div>
          ))}

          {alerts.length > 8 && (
            <p className="text-xs text-center text-slate-500 mt-2">
              Showing 8 of {alerts.length} alerts
            </p>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
