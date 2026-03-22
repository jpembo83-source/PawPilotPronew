// Daycare Attendance - MDC Operations Centre

import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useDaycareStore } from '../store';
import { useDashboardStore } from '../../dashboard/store';
import { useModuleRealtimeSync } from '../../../hooks/useModuleRealtimeSync';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Users, AlertTriangle, Clock } from 'lucide-react';

export function DaycareAttendance() {
  const navigate = useNavigate();
  const { selectedLocationId } = useDashboardStore();
  const { attendance, isLoading, fetchActiveAttendance } = useDaycareStore();
  
  const refetch = useCallback(() => {
    loadAttendance();
  }, [selectedLocationId]);

  useModuleRealtimeSync('daycare', refetch);

  useEffect(() => {
    loadAttendance();
    const interval = setInterval(loadAttendance, 120000);
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
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
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
            <Users className="h-5 w-5" />
            Currently In Daycare ({attendance.length})
          </CardTitle>
          <CardDescription>
            Last updated: {new Date().toLocaleTimeString('en-GB')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Loading attendance...</div>
          ) : attendance.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No pets currently in daycare</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendance.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50"
                >
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
                        <span className="text-xs text-slate-500">
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
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Behaviour
                      </Badge>
                    )}
                    {record.has_medical_flag && (
                      <Badge className="bg-red-100 text-red-700 border-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Medical
                      </Badge>
                    )}
                    {record.assigned_group && (
                      <Badge variant="outline">{record.assigned_group}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}