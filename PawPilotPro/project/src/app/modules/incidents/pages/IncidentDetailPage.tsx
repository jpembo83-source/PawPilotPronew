// Incident Detail Page
// View and manage incident details

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useIncidentsStore } from '../store';
import { useAuth } from '../../../context/AuthContext';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import { Separator } from '../../../components/ui/separator';
import { Warning, ArrowLeft, PencilSimple, CheckCircle, ArrowCounterClockwise, UserPlus } from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INCIDENT_MODULES,
} from '../types';
import { IncidentDetailsTab } from '../components/IncidentDetailsTab';
import { IncidentActionsTab } from '../components/IncidentActionsTab';
import { IncidentNotesTab } from '../components/IncidentNotesTab';
import { IncidentAuditTab } from '../components/IncidentAuditTab';
import { AssignIncidentDialog } from '../components/AssignIncidentDialog';
import { CloseIncidentDialog } from '../components/CloseIncidentDialog';
import { ReopenIncidentDialog } from '../components/ReopenIncidentDialog';

import { useBackNavigation } from '../../../components/BackButton';
export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useBackNavigation('/incidents');
  const { user } = useAuth();
  const {
    selectedIncident,
    isLoading,
    error,
    fetchIncidentById,
    clearError,
  } = useIncidentsStore();

  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showReopenDialog, setShowReopenDialog] = useState(false);

  useEffect(() => {
    if (id) {
      loadIncident();
    }
  }, [id]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error]);

  const loadIncident = async () => {
    if (!id) return;
    
    try {
      await fetchIncidentById(id);
    } catch (err) {
      // Error handled by store
    }
  };

  if (isLoading || !selectedIncident) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">Loading incident...</div>
        </div>
      </div>
    );
  }

  const incident = selectedIncident;

  const canAssign = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'assistant_manager';
  const canClose = 
    user?.role === 'admin' || 
    user?.role === 'manager' || 
    (user?.role === 'night_shift' && incident.severity === 'low');
  const canReopen = user?.role === 'admin' || user?.role === 'manager';

  const showCloseButton = canClose && incident.status !== 'closed' && incident.status !== 'resolved';
  const showReopenButton = canReopen && incident.status === 'closed';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={goBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Incidents
        </Button>

        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">
                Incident {incident.id.slice(0, 8)}
              </h1>
              <Badge className={`${INCIDENT_SEVERITIES[incident.severity].bgColor} ${INCIDENT_SEVERITIES[incident.severity].color} border-0`}>
                {INCIDENT_SEVERITIES[incident.severity].label}
              </Badge>
              <Badge className={`${INCIDENT_STATUSES[incident.status].bgColor} ${INCIDENT_STATUSES[incident.status].color} border-0`}>
                {INCIDENT_STATUSES[incident.status].label}
              </Badge>
              {incident.escalated && (
                <Badge className="bg-red-100 text-red-700 border-0">
                  Escalated
                </Badge>
              )}
            </div>
            <p className="text-slate-600">{incident.summary}</p>
          </div>

          <div className="flex items-center gap-2">
            {canAssign && incident.status !== 'closed' && (
              <Button variant="outline" onClick={() => setShowAssignDialog(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign
              </Button>
            )}
            {showCloseButton && (
              <Button onClick={() => setShowCloseDialog(true)}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Close Incident
              </Button>
            )}
            {showReopenButton && (
              <Button variant="outline" onClick={() => setShowReopenDialog(true)}>
                <ArrowCounterClockwise className="h-4 w-4 mr-2" />
                Reopen
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Context Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Incident Context</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-600 mb-1">Location</p>
              <p className="font-medium">{incident.location_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Module</p>
              <p className="font-medium">{INCIDENT_MODULES[incident.module]}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Category</p>
              <p className="font-medium">{INCIDENT_CATEGORIES[incident.category]}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Occurred At</p>
              <p className="font-medium">
                {new Date(incident.occurred_at).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {(incident.pet_name || incident.household_name) && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {incident.pet_name && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Pet</p>
                    <p className="font-medium">{incident.pet_name}</p>
                  </div>
                )}
                {incident.household_name && (
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Household</p>
                    <p className="font-medium">{incident.household_name}</p>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator className="my-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-slate-600 mb-1">Created By</p>
              <p className="font-medium">{incident.created_by_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Created At</p>
              <p className="font-medium">
                {new Date(incident.created_at).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Assigned To</p>
              <p className="font-medium">{incident.assigned_to_name || <span className="text-slate-400">Unassigned</span>}</p>
            </div>
            {incident.due_date && (
              <div>
                <p className="text-sm text-slate-600 mb-1">Due Date</p>
                <p className="font-medium">
                  {new Date(incident.due_date).toLocaleDateString('en-GB')}
                </p>
              </div>
            )}
          </div>

          {incident.closed_at && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-slate-600 mb-1">Closed By</p>
                  <p className="font-medium">{incident.closed_by_name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 mb-1">Closed At</p>
                  <p className="font-medium">
                    {new Date(incident.closed_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="actions">
            Actions {incident.actions?.length ? `(${incident.actions.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="notes">
            Notes {incident.notes?.length ? `(${incident.notes.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <IncidentDetailsTab incident={incident} onUpdate={loadIncident} />
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <IncidentActionsTab incident={incident} onUpdate={loadIncident} />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <IncidentNotesTab incident={incident} onUpdate={loadIncident} />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <IncidentAuditTab incident={incident} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AssignIncidentDialog
        open={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        incident={incident}
        onSuccess={() => {
          setShowAssignDialog(false);
          loadIncident();
        }}
      />

      <CloseIncidentDialog
        open={showCloseDialog}
        onClose={() => setShowCloseDialog(false)}
        incident={incident}
        onSuccess={() => {
          setShowCloseDialog(false);
          loadIncident();
        }}
      />

      <ReopenIncidentDialog
        open={showReopenDialog}
        onClose={() => setShowReopenDialog(false)}
        incident={incident}
        onSuccess={() => {
          setShowReopenDialog(false);
          loadIncident();
        }}
      />
    </div>
  );
}