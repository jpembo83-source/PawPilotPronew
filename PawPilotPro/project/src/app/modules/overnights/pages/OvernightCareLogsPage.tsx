import React, { useState, useEffect } from 'react';
import { ClipboardList, Moon, ArrowLeft, CheckCircle, XCircle, Search, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useOvernightsStore } from '../store';
import { useSettingsStore } from '../../settings/store';
import { useDashboardStore } from '../../dashboard/store';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { CareLogForm } from '../components/CareLogForm';
import { NightlyCareLog, BoarderSummary } from '../types';

export function OvernightCareLogsPage() {
  const navigate = useNavigate();
  const locations = useSettingsStore((s) => s.locations);
  const { selectedLocationId } = useDashboardStore();
  const {
    tonightsBoarders,
    careLogs,
    fetchTonightsBoarders,
    fetchCareLogs,
    createCareLog,
    updateCareLog,
    isLoading,
    error,
  } = useOvernightsStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'complete' | 'incomplete'>('all');
  const [selectedBoarder, setSelectedBoarder] = useState<BoarderSummary | null>(null);
  const [editingLog, setEditingLog] = useState<NightlyCareLog | undefined>(undefined);

  const locationId = selectedLocationId === 'ALL' ? locations[0]?.id : selectedLocationId;
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (locationId) {
      fetchTonightsBoarders(locationId);
      fetchCareLogs(undefined, today);
    }
  }, [locationId]);

  const boarders = tonightsBoarders?.boarders || [];

  const filteredBoarders = boarders.filter((b) => {
    const matchesSearch =
      !searchTerm ||
      b.petName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.customerName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'complete' && b.careLogCompleted) ||
      (filterStatus === 'incomplete' && !b.careLogCompleted);

    return matchesSearch && matchesFilter;
  });

  const completedCount = boarders.filter((b) => b.careLogCompleted).length;
  const totalCount = boarders.length;

  const handleOpenCareLog = (boarder: BoarderSummary) => {
    const existingLog = careLogs.find(
      (cl) => cl.reservationId === boarder.reservationId && cl.logDate === today
    );
    setEditingLog(existingLog);
    setSelectedBoarder(boarder);
  };

  const handleSubmitCareLog = async (log: Omit<NightlyCareLog, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingLog) {
      await updateCareLog(editingLog.id, log);
    } else {
      await createCareLog(log);
    }
    setSelectedBoarder(null);
    setEditingLog(undefined);
    if (locationId) {
      fetchTonightsBoarders(locationId);
      fetchCareLogs(undefined, today);
    }
  };

  if (!locationId) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <Moon className="h-16 w-16 text-slate-300 mb-4" />
        <h2 className="text-lg font-medium text-slate-900">No Location Selected</h2>
        <p>Please select a location to manage care logs.</p>
      </div>
    );
  }

  if (selectedBoarder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedBoarder(null);
              setEditingLog(undefined);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Boarders
          </Button>
        </div>
        <Card className="p-6">
          <CareLogForm
            reservationId={selectedBoarder.reservationId}
            petId={selectedBoarder.petId}
            petName={selectedBoarder.petName}
            locationId={locationId}
            existingLog={editingLog}
            requiresMedication={selectedBoarder.requiresMedication}
            onSubmit={handleSubmitCareLog}
            onCancel={() => {
              setSelectedBoarder(null);
              setEditingLog(undefined);
            }}
            isLoading={isLoading}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/overnights')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-orange-600" />
              Care Logs
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Tonight's boarding care records
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <Moon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{totalCount}</p>
              <p className="text-xs text-slate-500">Total Boarders</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{completedCount}</p>
              <p className="text-xs text-slate-500">Logs Completed</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{totalCount - completedCount}</p>
              <p className="text-xs text-slate-500">Logs Outstanding</p>
            </div>
          </div>
        </Card>
      </div>

      {totalCount > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-full rounded-full transition-all"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search boarders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'incomplete', 'complete'] as const).map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(status)}
            >
              {status === 'all' ? 'All' : status === 'complete' ? 'Complete' : 'Incomplete'}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-600">
          {error}
        </div>
      )}

      {filteredBoarders.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p>{searchTerm || filterStatus !== 'all' ? 'No boarders match your filters' : 'No boarders staying tonight'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBoarders.map((boarder) => {
            const existingLog = careLogs.find(
              (cl) => cl.reservationId === boarder.reservationId && cl.logDate === today
            );

            return (
              <div
                key={boarder.reservationId}
                className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors cursor-pointer"
                onClick={() => handleOpenCareLog(boarder)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                      {boarder.petName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900">{boarder.petName}</h4>
                        {boarder.careLogCompleted ? (
                          <Badge className="bg-emerald-500 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                            Incomplete
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{boarder.customerName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {boarder.requiresMedication && (
                      <Badge variant="outline" className="text-xs text-rose-600 border-rose-200">
                        Medication
                      </Badge>
                    )}
                    {boarder.hasBehaviourConcerns && (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                        Behaviour
                      </Badge>
                    )}
                    {boarder.hasAllergies && (
                      <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                        Allergies
                      </Badge>
                    )}
                    <Button variant="outline" size="sm">
                      {existingLog ? 'Edit Log' : 'Create Log'}
                    </Button>
                  </div>
                </div>

                {existingLog && (
                  <div className="mt-3 ml-13 flex gap-4 text-xs text-slate-500">
                    {existingLog.feedingCompleted && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-emerald-500" /> Fed
                      </span>
                    )}
                    {existingLog.medicationAdministered && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-emerald-500" /> Medicated
                      </span>
                    )}
                    {existingLog.toiletBreakCompleted && (
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-emerald-500" /> Toilet
                      </span>
                    )}
                    {existingLog.sleepQuality && (
                      <span className="flex items-center gap-1">
                        <Moon className="h-3 w-3 text-indigo-500" /> Sleep: {existingLog.sleepQuality}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
