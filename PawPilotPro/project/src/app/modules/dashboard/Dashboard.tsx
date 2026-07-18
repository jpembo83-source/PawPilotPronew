import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { DashboardHeader } from './components/DashboardHeader';
import { PoliciesAlertBanner } from './components/PoliciesAlertBanner';
import { MyShiftsCard } from './components/MyShiftsCard';
import { useDaycareStore } from '../daycare/store';
import { useDashboardStore } from './store';
import { useAuth } from '../../context/AuthContext';
import { ShareMomentModal, type ShareMomentPet } from '../daycare/components/ShareMomentModal';
import {
  SignIn, SignOut, Plus, Users,
  ArrowRight, Dog, Camera, Warning, FirstAidKit,
  Pulse, FileDashed, Syringe,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { Tooltip, TooltipTrigger, TooltipContent } from '../../components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';

interface AlertKind {
  key: 'medical' | 'behaviour' | 'paperwork' | 'vaccination';
  label: string;
  count: number;
  icon: Icon;
  /** Safety signals (a dog could get hurt today) render louder than paperwork. */
  loud: boolean;
  fg: string;
  bg: string;
  border: string;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Flag icon that actually tells you WHAT the alert is: hover shows a tooltip,
 * tap opens a popover with the same text (hover-only tooltips are dead on
 * touch). Alert text is safety-critical and renders at 14px minimum.
 */
function FlagBadge({ kind, petName, text }: {
  kind: 'behaviour' | 'medical';
  petName: string;
  text?: string;
}) {
  const medical = kind === 'medical';
  const Icon = medical ? FirstAidKit : Warning;
  const colour = medical ? '#DC2626' : '#D97706';
  const label = medical ? 'Medical' : 'Behaviour';
  const body = text?.trim() || `${label} flag on file — see pet profile for details.`;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              onClick={e => e.stopPropagation()}
              aria-label={`${label} alert for ${petName}: ${body}`}
              className="p-1.5 -my-1.5 -mx-0.5 rounded-full flex-shrink-0 hover:bg-black/5 transition-colors"
            >
              <Icon size={14} weight="fill" style={{ color: colour }} aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-sm">{body}</TooltipContent>
      </Tooltip>
      <PopoverContent className="max-w-72 w-auto p-3" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-semibold mb-1" style={{ color: colour }}>
          {label} — {petName}
        </p>
        <p className="text-sm text-[#1C1916]">{body}</p>
      </PopoverContent>
    </Popover>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { stats, bookings, isLoading, fetchStats, fetchBookings } = useDaycareStore();
  const [momentPet, setMomentPet] = useState<ShareMomentPet | null>(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const loc = selectedLocationId === 'ALL' ? undefined : selectedLocationId;
    fetchStats(loc, today);
    fetchBookings({ location_id: loc, date: today });
  }, [selectedLocationId]);

  const checkedIn = stats?.checked_in_count ?? 0;
  const available = stats?.available_slots ?? 0;
  const utilisation = stats?.capacity_utilisation ? Math.round(stats.capacity_utilisation) : 0;
  const totalBookings = stats?.total_bookings ?? 0;
  const expectedArrivals = stats?.expected_arrivals_2h ?? 0;

  // Same categories the server counts over today's bookings (daycare /stats).
  // Paperwork = waiver issues + account holds; safety flags stay separate.
  const alertKinds: AlertKind[] = [
    {
      key: 'medical',
      label: 'Medical',
      count: stats?.medical_flags ?? 0,
      icon: Pulse,
      loud: true,
      fg: '#B91C1C', bg: '#FEF2F2', border: '#FECACA',
    },
    {
      key: 'behaviour',
      label: 'Behaviour',
      count: stats?.behaviour_flags ?? 0,
      icon: Warning,
      loud: true,
      fg: '#B45309', bg: '#FFFBEB', border: '#FDE68A',
    },
    {
      key: 'paperwork',
      label: 'Paperwork',
      count: (stats?.waiver_alerts ?? 0) + (stats?.hold_alerts ?? 0),
      icon: FileDashed,
      loud: false,
      fg: '#6B6762', bg: '#FAFAF9', border: '#E7E5E4',
    },
    {
      key: 'vaccination',
      label: 'Vaccines',
      count: stats?.vaccination_alerts ?? 0,
      icon: Syringe,
      loud: false,
      fg: '#6B6762', bg: '#FAFAF9', border: '#E7E5E4',
    },
  ];
  const urgentCount = alertKinds.filter(k => k.loud).reduce((sum, k) => sum + k.count, 0);
  const alertCount = alertKinds.reduce((sum, k) => sum + k.count, 0);

  const onSite = bookings.filter(b => b.check_in_status === 'checked_in');
  const arriving = bookings.filter(b =>
    b.check_in_status === 'not_checked_in' && b.booking_status === 'confirmed'
  ).slice(0, 8);

  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <div className="flex flex-col min-h-full" style={{ background: '#F4F3EF' }}>
      <DashboardHeader />

      <div className="flex-1 p-5 md:p-7 max-w-5xl w-full mx-auto space-y-6">
        <PoliciesAlertBanner />

        {/* Page heading */}
        <div>
          <h1 className="text-2xl font-semibold text-[#1C1916] tracking-tight">
            {getGreeting()}{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p className="text-sm text-[#6B6762] mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        {/* Capacity strip + quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            className="col-span-2 rounded-2xl px-6 py-5 flex items-center justify-between"
            style={{ background: 'var(--primary)' }}
          >
            <div>
              {/* White below 92% opacity fails 4.5:1 on --primary (#177C5E) —
                  keep ≥0.92 for any text on this card. */}
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>
                Capacity
              </p>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-bold text-white leading-none">{utilisation}%</span>
                <div className="pb-0.5">
                  <p className="text-sm text-white/95">{checkedIn} in</p>
                  <p className="text-sm text-white/92">{available} free</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="w-20 h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-all duration-700"
                  style={{ width: `${Math.min(utilisation, 100)}%` }}
                />
              </div>
              <p className="text-xs text-white/92">of capacity</p>
            </div>
          </div>

          <div
            className="rounded-2xl px-4 py-4 flex flex-col justify-between cursor-pointer transition-all hover:shadow-md"
            style={{ background: '#fff', border: '1px solid #E2DED8' }}
            onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}`)}
          >
            <p className="text-xs text-tertiary-foreground font-medium mb-2">Bookings today</p>
            <div>
              <p className="text-3xl font-bold text-[#1C1916]">{totalBookings}</p>
              <p className="text-xs text-tertiary-foreground mt-0.5">{stats?.confirmed_bookings ?? 0} confirmed</p>
            </div>
          </div>

          <div
            className="rounded-2xl px-3 py-3 flex flex-col"
            style={{
              background: urgentCount > 0 ? '#FFF5F5' : '#fff',
              border: `1px solid ${urgentCount > 0 ? '#FECACA' : '#E2DED8'}`,
            }}
          >
            {/* Alert text carries a 14px floor — see CLAUDE.md */}
            <p className="text-sm font-medium mb-2 px-1" style={{ color: urgentCount > 0 ? '#C03030' : 'var(--tertiary-foreground)' }}>
              Alerts{alertCount === 0 ? ' — all clear' : ''}
            </p>
            <div className="grid grid-cols-2 gap-1.5 flex-1">
              {alertKinds.map(kind => {
                const Icon = kind.icon;
                const active = kind.count > 0;
                return (
                  <button
                    key={kind.key}
                    aria-label={`${kind.count} ${kind.label.toLowerCase()} alert${kind.count === 1 ? '' : 's'} — view affected dogs`}
                    onClick={() => navigate(`/daycare/bookings?filter=today&date=${today}&flag=${kind.key}`)}
                    className="min-h-[44px] rounded-xl px-2 py-1.5 flex flex-col items-center justify-center transition-all hover:shadow-sm active:scale-[0.97]"
                    style={{
                      background: active ? kind.bg : '#FAFAF9',
                      border: `1px solid ${active ? kind.border : '#EEECE8'}`,
                      opacity: active ? 1 : 0.5,
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <Icon
                        size={kind.loud && active ? 15 : 13}
                        weight={kind.loud && active ? 'fill' : 'regular'}
                        style={{ color: active ? kind.fg : 'var(--tertiary-foreground)' }}
                      />
                      <span
                        className={kind.loud && active ? 'text-lg font-bold leading-none' : 'text-base font-semibold leading-none'}
                        style={{ color: active ? kind.fg : 'var(--tertiary-foreground)' }}
                      >
                        {kind.count}
                      </span>
                    </span>
                    <span
                      className={`text-sm leading-tight mt-0.5 ${kind.loud && active ? 'font-semibold' : 'font-medium'}`}
                      style={{ color: active ? kind.fg : 'var(--tertiary-foreground)' }}
                    >
                      {kind.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Primary actions — Check In / Out */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/daycare/check-in')}
            className="group relative rounded-2xl p-5 text-left overflow-hidden transition-all active:scale-[0.98] hover:shadow-lg"
            style={{ background: 'var(--primary)' }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.06)' }} />
            <SignIn size={26} weight="duotone" className="text-white/75 mb-3" />
            <p className="text-lg font-semibold text-white leading-tight">Check In</p>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.92)' }}>
              {expectedArrivals > 0 ? `${expectedArrivals} arriving soon` : 'No arrivals due'}
            </p>
            <ArrowRight size={15} className="absolute right-4 bottom-4 text-white/30 group-hover:text-white/60 transition-colors" />
          </button>

          <button
            onClick={() => navigate('/daycare/check-out')}
            className="group relative rounded-2xl p-5 text-left overflow-hidden transition-all active:scale-[0.98] hover:shadow-md"
            style={{ background: '#fff', border: '1px solid #E2DED8' }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: '#F5F3F0' }} />
            <SignOut size={26} weight="duotone" className="mb-3" style={{ color: 'var(--primary)' }} />
            <p className="text-lg font-semibold text-[#1C1916] leading-tight">Check Out</p>
            <p className="text-sm text-tertiary-foreground mt-0.5">
              {checkedIn > 0 ? `${checkedIn} on site` : 'No dogs on site'}
            </p>
            <ArrowRight size={15} className="absolute right-4 bottom-4 text-[#C8C4BC] group-hover:text-[#6B6762] transition-colors" />
          </button>
        </div>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/daycare/bookings?action=create')}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:bg-white hover:shadow-sm active:scale-[0.99]"
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #E2DED8' }}
          >
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-tint)' }}>
              <Plus size={17} weight="bold" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1C1916]">New Booking</p>
              <p className="text-xs text-tertiary-foreground">Schedule a visit</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/daycare/attendance')}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:bg-white hover:shadow-sm active:scale-[0.99]"
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #E2DED8' }}
          >
            <div className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--primary-tint)' }}>
              <Users size={17} weight="duotone" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1C1916]">Attendance</p>
              <p className="text-xs text-tertiary-foreground">Today's register</p>
            </div>
          </button>
        </div>

        {/* Live lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* On Site */}
          <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #E2DED8' }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #F0EDE8' }}>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="text-sm font-semibold text-[#1C1916]">On Site</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary-tint text-primary">{onSite.length}</span>
              </div>
              <button
                onClick={() => navigate('/daycare/attendance')}
                className="text-xs font-medium text-primary flex items-center gap-1 hover:gap-1.5 transition-all"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-2.5">
                {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl animate-pulse bg-[#F4F3EF]" />)}
              </div>
            ) : onSite.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Dog size={36} weight="thin" className="text-[#D4CFC9] mb-2" />
                <p className="text-sm text-tertiary-foreground">No dogs on site yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F5F3F0]">
                {onSite.slice(0, 6).map(b => (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-8 w-8 rounded-full bg-primary-tint flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                      {b.pet_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-semibold text-[#1C1916] truncate">{b.pet_name}</p>
                        {b.has_behaviour_flag && <FlagBadge kind="behaviour" petName={b.pet_name} text={b.behaviour_notes} />}
                        {b.has_medical_flag && <FlagBadge kind="medical" petName={b.pet_name} text={b.medical_notes} />}
                      </div>
                      <p className="text-xs text-tertiary-foreground truncate">{b.household_name}</p>
                    </div>
                    <button
                      onClick={() => setMomentPet({
                        id: b.pet_id,
                        name: b.pet_name,
                        householdId: b.household_id,
                        bookingId: b.id,
                      })}
                      aria-label={`Share a moment for ${b.pet_name}`}
                      className="p-1.5 rounded-lg flex-shrink-0 text-tertiary-foreground hover:text-primary hover:bg-primary-tint transition-colors"
                    >
                      <Camera size={15} weight="duotone" />
                    </button>
                    <button
                      onClick={() => navigate('/daycare/check-out')}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium flex-shrink-0 text-[#6B6762] hover:text-[#1C1916] hover:bg-[#F5F3F0] transition-colors"
                    >
                      Check out
                    </button>
                  </div>
                ))}
                {onSite.length > 6 && (
                  <button onClick={() => navigate('/daycare/attendance')} className="w-full py-3 text-xs font-medium text-center text-primary">
                    +{onSite.length - 6} more
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Arriving */}
          <div className="rounded-2xl overflow-hidden bg-white" style={{ border: '1px solid #E2DED8' }}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #F0EDE8' }}>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D97706] animate-pulse" />
                <span className="text-sm font-semibold text-[#1C1916]">Arriving Today</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#FEF3C7] text-[#B45309]">{arriving.length}</span>
              </div>
              <button
                onClick={() => navigate('/daycare/check-in')}
                className="text-xs font-medium text-primary flex items-center gap-1 hover:gap-1.5 transition-all"
              >
                Check in <ArrowRight size={12} />
              </button>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-2.5">
                {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl animate-pulse bg-[#F4F3EF]" />)}
              </div>
            ) : arriving.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Dog size={36} weight="thin" className="text-[#D4CFC9] mb-2" />
                <p className="text-sm text-tertiary-foreground">
                  {totalBookings > 0 ? 'All booked dogs have arrived' : 'No bookings today'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#F5F3F0]">
                {arriving.map(b => {
                  const isLate = (() => {
                    if (!b.planned_start_time) return false;
                    const [h, m] = b.planned_start_time.split(':').map(Number);
                    const planned = new Date(); planned.setHours(h, m, 0, 0);
                    return Date.now() - planned.getTime() > 30 * 60 * 1000;
                  })();
                  return (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="h-8 w-8 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[#B45309] text-xs font-bold flex-shrink-0">
                      {b.pet_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-[#1C1916] truncate">{b.pet_name}</p>
                        {b.has_behaviour_flag && <FlagBadge kind="behaviour" petName={b.pet_name} text={b.behaviour_notes} />}
                        {b.has_medical_flag && <FlagBadge kind="medical" petName={b.pet_name} text={b.medical_notes} />}
                        {isLate && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Late</span>
                        )}
                      </div>
                      <p className="text-xs text-tertiary-foreground truncate">{b.household_name}</p>
                    </div>
                    <button
                      onClick={() => navigate('/daycare/check-in')}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium flex-shrink-0 text-primary bg-primary-tint hover:opacity-90 transition-opacity"
                      style={{ border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' }}
                    >
                      Check in
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Where am I working — staff rotate between locations */}
        <MyShiftsCard />
      </div>

      <ShareMomentModal open={momentPet !== null} onClose={() => setMomentPet(null)} pet={momentPet} />
    </div>
  );
}
