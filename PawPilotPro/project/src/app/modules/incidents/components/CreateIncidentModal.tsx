// Create Incident Modal - Quick incident reporting form

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import { AlertTriangle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useIncidentsStore } from '../store';
import { useAuth } from '../../../context/AuthContext';
import { useDashboardStore } from '../../dashboard/store';
import { useSettingsStore } from '../../settings/store';
import { useCustomerStore } from '../../customers/store';
import {
  INCIDENT_CATEGORIES,
  INCIDENT_MODULES,
  type IncidentCategory,
  type IncidentSeverity,
  type IncidentModule,
} from '../types';

interface CreateIncidentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  prefilledData?: {
    pet_id?: string;
    pet_name?: string;
    household_id?: string;
    household_name?: string;
    booking_id?: string;
    transport_id?: string;
    overnight_id?: string;
    module?: IncidentModule;
  };
}

export function CreateIncidentModal({ open, onClose, onSuccess, prefilledData }: CreateIncidentModalProps) {
  const { user } = useAuth();
  const { selectedLocationId } = useDashboardStore();
  const { locations } = useSettingsStore();
  const { createIncident, isLoading } = useIncidentsStore();
  const { households, pets, fetchHouseholds, fetchPets } = useCustomerStore();

  const [locationId, setLocationId] = useState('');
  const [module, setModule] = useState<IncidentModule>('daycare');
  const [category, setCategory] = useState<IncidentCategory>('other');
  const [severity, setSeverity] = useState<IncidentSeverity>('low');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [immediateActions, setImmediateActions] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [petSearch, setPetSearch] = useState('');
  const [selectedPetId, setSelectedPetId] = useState('');
  const [selectedPetName, setSelectedPetName] = useState('');
  const [selectedHouseholdId, setSelectedHouseholdId] = useState('');
  const [selectedHouseholdName, setSelectedHouseholdName] = useState('');
  const [needsFollowUp, setNeedsFollowUp] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset form
      setLocationId(selectedLocationId === 'ALL' ? '' : selectedLocationId);
      setModule(prefilledData?.module || 'daycare');
      setCategory('other');
      setSeverity('low');
      setSummary('');
      setDescription('');
      setImmediateActions('');
      setOccurredAt(new Date().toISOString().slice(0, 16));
      setPetSearch('');
      setSelectedPetId(prefilledData?.pet_id || '');
      setSelectedPetName(prefilledData?.pet_name || '');
      setSelectedHouseholdId(prefilledData?.household_id || '');
      setSelectedHouseholdName(prefilledData?.household_name || '');
      setNeedsFollowUp(false);

      // Load customers and pets if needed
      if (!households.length) {
        fetchHouseholds().catch(() => {});
      }
      if (!pets.length) {
        fetchPets().catch(() => {});
      }
    }
  }, [open, prefilledData]);

  useEffect(() => {
    // Auto-set needs follow-up for medium+ severity
    if (severity === 'medium' || severity === 'high' || severity === 'critical') {
      setNeedsFollowUp(true);
    }
  }, [severity]);

  const handleSubmit = async () => {
    // Validation
    if (!locationId) {
      toast.error('Please select a location');
      return;
    }

    if (!summary.trim()) {
      toast.error('Please provide a summary');
      return;
    }

    if ((severity === 'medium' || severity === 'high' || severity === 'critical') && !description.trim()) {
      toast.error('Description required for Medium+ severity incidents');
      return;
    }

    if ((severity === 'medium' || severity === 'high' || severity === 'critical') && !immediateActions.trim()) {
      toast.error('Immediate actions required for Medium+ severity incidents');
      return;
    }

    try {
      const location = locations.find(l => l?.id === locationId);

      await createIncident({
        location_id: locationId,
        location_name: location?.name || 'Unknown',
        module,
        category,
        severity,
        summary: summary.trim(),
        description: description.trim() || undefined,
        immediate_actions: immediateActions.trim() || undefined,
        occurred_at: occurredAt || new Date().toISOString(),
        pet_id: selectedPetId || prefilledData?.pet_id || undefined,
        pet_name: selectedPetName || prefilledData?.pet_name || undefined,
        household_id: selectedHouseholdId || prefilledData?.household_id || undefined,
        household_name: selectedHouseholdName || prefilledData?.household_name || undefined,
        booking_id: prefilledData?.booking_id || undefined,
        transport_id: prefilledData?.transport_id || undefined,
        overnight_id: prefilledData?.overnight_id || undefined,
        needs_follow_up: needsFollowUp,
      });

      if (severity === 'high' || severity === 'critical') {
        toast.warning('High-severity incident created. Manager has been notified.');
      } else {
        toast.success('Incident reported successfully');
      }

      onSuccess?.();
    } catch (error: any) {
      // Error already shown by store
    }
  };

  const handlePetSelect = (petId: string) => {
    const pet = pets.find(p => p.id === petId);
    if (pet) {
      setSelectedPetId(pet.id);
      setSelectedPetName(pet.name);
      setSelectedHouseholdId(pet.household_id);
      
      const household = households.find(h => h.id === pet.household_id);
      if (household) {
        setSelectedHouseholdName(household.name);
      }
    }
  };

  const filteredPets = petSearch
    ? pets.filter(p =>
        p.name.toLowerCase().includes(petSearch.toLowerCase()) ||
        households.find(h => h.id === p.household_id)?.name.toLowerCase().includes(petSearch.toLowerCase())
      )
    : pets;

  const requiresExtendedFields = severity === 'medium' || severity === 'high' || severity === 'critical';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Incident</DialogTitle>
          <DialogDescription>
            Quickly report an operational incident. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Location */}
          <div>
            <Label>Location *</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.filter(l => l && l.isActive).map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Module & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Module *</Label>
              <Select value={module} onValueChange={(v) => setModule(v as IncidentModule)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INCIDENT_MODULES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as IncidentCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(INCIDENT_CATEGORIES).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Severity */}
          <div>
            <Label>Severity *</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - Minor issue</SelectItem>
                <SelectItem value="medium">Medium - Needs attention</SelectItem>
                <SelectItem value="high">High - Urgent action required</SelectItem>
                <SelectItem value="critical">Critical - Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* High Severity Warning */}
          {(severity === 'high' || severity === 'critical') && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">High-severity incident</p>
                <p>This will trigger immediate escalation to management and create an urgent alert.</p>
              </div>
            </div>
          )}

          {/* Date/Time */}
          <div>
            <Label>Date & Time of Incident *</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Pet/Household */}
          {!prefilledData?.pet_id && (
            <div>
              <Label>Pet (Optional but Recommended)</Label>
              <Select value={selectedPetId} onValueChange={handlePetSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Search for pet..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Search pets..."
                      value={petSearch}
                      onChange={(e) => setPetSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {filteredPets.slice(0, 20).map(pet => {
                    const household = households.find(h => h.id === pet.household_id);
                    return (
                      <SelectItem key={pet.id} value={pet.id}>
                        {pet.name} ({household?.name || 'Unknown'})
                      </SelectItem>
                    );
                  })}
                  {filteredPets.length === 0 && (
                    <div className="p-2 text-sm text-slate-500">No pets found</div>
                  )}
                </SelectContent>
              </Select>
              {selectedPetName && (
                <p className="text-sm text-slate-600 mt-1">
                  Selected: {selectedPetName} - {selectedHouseholdName}
                </p>
              )}
            </div>
          )}

          {/* Summary */}
          <div>
            <Label>Summary *</Label>
            <Input
              placeholder="Brief description of what happened..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={200}
            />
            <p className="text-xs text-slate-500 mt-1">{summary.length}/200 characters</p>
          </div>

          {/* Description - Required for Medium+ */}
          <div>
            <Label>Detailed Description {requiresExtendedFields && '*'}</Label>
            <Textarea
              placeholder="Provide detailed information about the incident..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Immediate Actions - Required for Medium+ */}
          <div>
            <Label>Immediate Actions Taken {requiresExtendedFields && '*'}</Label>
            <Textarea
              placeholder="What actions were taken immediately after the incident..."
              value={immediateActions}
              onChange={(e) => setImmediateActions(e.target.value)}
              rows={3}
            />
          </div>

          {/* Needs Follow-up */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label>Needs Follow-up</Label>
              <p className="text-sm text-slate-600">
                {requiresExtendedFields 
                  ? 'Automatically required for Medium+ severity' 
                  : 'Mark if this incident requires further action'}
              </p>
            </div>
            <Switch
              checked={needsFollowUp}
              onCheckedChange={setNeedsFollowUp}
              disabled={requiresExtendedFields}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Reporting...' : 'Report Incident'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}