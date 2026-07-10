// Daycare Attendance - MDC Operations Centre

import React, { useEffect, useState } from 'react';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { BackButton } from '../../../components/BackButton';
import { UsersThree, Warning, Clock, ChatText, SignOut } from '@phosphor-icons/react';
import { toast } from 'sonner';
import type { AttendanceRecord } from '../types';

export function DaycareAttendance() {
  const { selectedLocationId } = useDashboardStore();
  const { attendance, isLoading, fetchActiveAttendance, checkOut } = useDaycareStore();
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);

  useEffect(() => {
    loadAttendance();
    const interval = setInterval(loadAttendance, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [selectedLocationId]);

  const loadAttendance = async () => {
    try {
      await fetchActiveAttendance(selectedLocationId === 'ALL' ? undefined : selectedLocationId);
    } catch (err) {
      // Error handled by store
    }
  };

  const calculateDuration = (checkInTime: string) => {
    const checkIn = new Date(checkInTime);
    const now = new Date();
    const minutes = Math.floor((now.getTime() - checkIn.getTime()) / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // The server flags records checked in on a previous calendar day and never
  // checked out. They are missed check-outs, not dogs on site — kept out of
  // the live list and its count so the same dog can't appear "in daycare"
  // several times across days.
  const current = attendance.filter((a) => !a.stale);
  const missed = attendance.filter((a) => a.stale);

  const resolveMissed = async (record: AttendanceRecord) => {
    setCheckingOutId(record.id);
    try {
      await checkOut(record.booking_id, 'Checked out retrospectively — missed check-out cleared from Live Attendance');
      toast.success(`${record.pet_name} checked out`);
      await loadAttendance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Check-out failed');
    } finally {
      setCheckingOutId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <BackButton fallback="/daycare" className="-ml-2 mb-1" />
          <h1 className="text-3xl font-bold text-slate-900">Live Attendance</h1>
          <p className="text-slate-600 mt-1">Pets currently in daycare</p>
        </div>
        <Button onClick={loadAttendance} variant="outline">
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersThree className="h-5 w-5" />
            Currently In Daycare ({current.length})
          </CardTitle>
          <CardDescription>
            Last updated: {new Date().toLocaleTimeString('en-GB')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading attendance...</div>
          ) : current.length === 0 ? (
            <div className="text-center py-8">
              <UsersThree className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No pets currently in daycare</p>
            </div>
          ) : (
            <div className="space-y-3">
              {current.map((record) => (
                <div
                  key={record.id}
                  className="p-4 border rounded-lg hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {record.pet_photo_url && (
                        <img
                          src={record.pet_photo_url}
                          alt={record.pet_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      )}
                      <div>
                        <p className="font-medium text-slate-900">{record.pet_name}</p>
                        <p className="text-sm text-slate-600">{record.household_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span className="text-sm text-slate-500">
                            {new Date(record.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            {' · '}
                            {calculateDuration(record.check_in_time)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {record.has_behaviour_flag && (
                        <Badge className="bg-amber-100 text-amber-700 border-0">
                          <Warning className="h-3 w-3 mr-1" />
                          Behaviour
                        </Badge>
                      )}
                      {record.has_medical_flag && (
                        <Badge className="bg-red-100 text-red-700 border-0">
                          <Warning className="h-3 w-3 mr-1" />
                          Medical
                        </Badge>
                      )}
                      {record.assigned_group && (
                        <Badge variant="outline">{record.assigned_group}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Drop-off handover — what the owner told the desk this
                      morning. Handlers work off this board, so it has to be
                      unmissable here, not buried in the event timeline. */}
                  {record.handover_notes && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                      <ChatText className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-900">
                        <span className="font-semibold">Handover:</span> {record.handover_notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {missed.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Warning className="h-5 w-5" />
              Missed check-outs ({missed.length})
            </CardTitle>
            <CardDescription>
              Checked in on a previous day and never checked out — these dogs are not on site.
              Check them out to correct the records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {missed.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border border-amber-200 bg-amber-50/50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {record.pet_photo_url && (
                      <img
                        src={record.pet_photo_url}
                        alt={record.pet_name}
                        className="w-12 h-12 rounded-full object-cover grayscale"
                      />
                    )}
                    <div>
                      <p className="font-medium text-slate-900">{record.pet_name}</p>
                      <p className="text-sm text-slate-600">{record.household_name}</p>
                      <p className="text-sm text-amber-800 mt-1">
                        Checked in {new Date(record.check_in_time).toLocaleString('en-GB', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}{' — never checked out'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void resolveMissed(record)}
                    disabled={checkingOutId === record.id}
                    className="border-amber-400 text-amber-800 hover:bg-amber-100"
                  >
                    <SignOut className="h-4 w-4 mr-2" />
                    {checkingOutId === record.id ? 'Checking out…' : 'Check out now'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
