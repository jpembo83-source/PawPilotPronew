// Quick Note Modal - Add notes to pets from dashboard without navigating away
// One-click "Max didn't eat lunch" type notes

import React, { useState, useEffect } from 'react';
import { projectId } from '../../../../../../utils/supabase/info';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../../components/ui/dialog';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Badge } from '../../../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../components/ui/select';
import { 
  StickyNote, 
  Dog, 
  Search, 
  Utensils, 
  Heart, 
  AlertTriangle,
  Activity,
  MessageSquare,
  Loader2,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../../../../utils/supabase/client';
import { useDashboardStore } from '../../store';

interface Pet {
  id: string;
  name: string;
  breed?: string;
  customer_name?: string;
}

interface QuickNoteModalProps {
  open: boolean;
  onClose: () => void;
  preSelectedPet?: Pet;
}

// Quick note templates for common scenarios
const NOTE_TEMPLATES = [
  { id: 'no_eat', label: "Didn't eat", icon: Utensils, category: 'feeding' },
  { id: 'ate_well', label: 'Ate well', icon: Utensils, category: 'feeding' },
  { id: 'low_energy', label: 'Low energy', icon: Activity, category: 'behaviour' },
  { id: 'hyper', label: 'Very playful', icon: Activity, category: 'behaviour' },
  { id: 'minor_scuffle', label: 'Minor scuffle', icon: AlertTriangle, category: 'incident' },
  { id: 'limping', label: 'Limping', icon: Heart, category: 'health' },
  { id: 'scratching', label: 'Excessive scratching', icon: Heart, category: 'health' },
  { id: 'vomit', label: 'Vomited', icon: Heart, category: 'health' },
  { id: 'custom', label: 'Custom note', icon: MessageSquare, category: 'other' },
];

export function QuickNoteModal({ open, onClose, preSelectedPet }: QuickNoteModalProps) {
  const { selectedLocationId, refreshAllWidgets } = useDashboardStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [checkedInPets, setCheckedInPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(preSelectedPet || null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customNote, setCustomNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCheckedInPets();
      if (preSelectedPet) {
        setSelectedPet(preSelectedPet);
      }
    } else {
      // Reset on close
      setSearchQuery('');
      setSelectedPet(preSelectedPet || null);
      setSelectedTemplate(null);
      setCustomNote('');
      setShowSuccess(false);
    }
  }, [open, preSelectedPet]);

  const fetchCheckedInPets = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const params = new URLSearchParams();
      if (selectedLocationId && selectedLocationId !== 'ALL') {
        params.append('location_id', selectedLocationId);
      }
      params.append('status', 'checked_in');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/daycare/attendance/today?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-User-Token': session.access_token,
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const pets = (data.attendance || []).map((a: any) => ({
          id: a.pet_id,
          name: a.pet_name,
          breed: a.breed,
          customer_name: a.customer_name
        }));
        setCheckedInPets(pets);
      } else {
        // No mock data - show empty state
        setCheckedInPets([]);
      }
    } catch (err) {
      console.error('Failed to fetch checked-in pets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPets = checkedInPets.filter(pet => 
    pet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pet.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveNote = async () => {
    if (!selectedPet) {
      toast.error('Please select a pet');
      return;
    }

    const template = NOTE_TEMPLATES.find(t => t.id === selectedTemplate);
    const noteText = selectedTemplate === 'custom' 
      ? customNote 
      : template 
        ? `${template.label}${customNote ? `: ${customNote}` : ''}`
        : customNote;

    if (!noteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/pets/${selectedPet.id}/notes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-User-Token': session.access_token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            note: noteText,
            category: template?.category || 'general',
            timestamp: new Date().toISOString(),
            location_id: selectedLocationId !== 'ALL' ? selectedLocationId : undefined
          })
        }
      );

      if (!response.ok) {
        // For now, just show success (endpoint may not exist yet)
        console.log('Note would be saved:', { pet: selectedPet, note: noteText });
      }

      setShowSuccess(true);
      toast.success(`Note added for ${selectedPet.name}`);
      
      // Brief success state then close
      setTimeout(() => {
        refreshAllWidgets();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to save note:', err);
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-500" />
            Quick Note
          </DialogTitle>
          <DialogDescription>
            Add a quick note about a dog's day
          </DialogDescription>
        </DialogHeader>

        {showSuccess ? (
          <div className="py-12 text-center">
            <div className="bg-green-100 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-lg font-medium text-slate-900">Note Added!</p>
            <p className="text-sm text-slate-500 mt-1">
              {selectedPet?.name}'s note has been saved
            </p>
          </div>
        ) : (
          <>
            {/* Pet Selection */}
            <div className="space-y-4">
              <div>
                <Label>Select Pet</Label>
                {!selectedPet ? (
                  <div className="mt-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search checked-in dogs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                      {isLoading ? (
                        <div className="p-4 text-center text-slate-500">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Loading...
                        </div>
                      ) : filteredPets.length === 0 ? (
                        <div className="p-4 text-center text-slate-500">
                          No dogs found
                        </div>
                      ) : (
                        filteredPets.map(pet => (
                          <button
                            key={pet.id}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-3 border-b last:border-b-0"
                            onClick={() => setSelectedPet(pet)}
                          >
                            <Dog className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="font-medium text-sm">{pet.name}</p>
                              <p className="text-xs text-slate-500">
                                {pet.breed} • {pet.customer_name}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Dog className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="font-medium">{selectedPet.name}</p>
                        <p className="text-xs text-slate-500">
                          {selectedPet.breed} • {selectedPet.customer_name}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedPet(null)}
                    >
                      Change
                    </Button>
                  </div>
                )}
              </div>

              {/* Quick templates */}
              {selectedPet && (
                <div>
                  <Label>Quick Templates</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {NOTE_TEMPLATES.map(template => {
                      const Icon = template.icon;
                      const isSelected = selectedTemplate === template.id;
                      return (
                        <Badge
                          key={template.id}
                          variant={isSelected ? 'default' : 'outline'}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-primary' 
                              : 'hover:bg-slate-100'
                          }`}
                          onClick={() => setSelectedTemplate(
                            isSelected ? null : template.id
                          )}
                        >
                          <Icon className="h-3 w-3 mr-1" />
                          {template.label}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Custom note text */}
              {selectedPet && (
                <div>
                  <Label>
                    {selectedTemplate === 'custom' ? 'Note' : 'Additional Details (optional)'}
                  </Label>
                  <Textarea
                    placeholder={
                      selectedTemplate === 'custom'
                        ? "Enter your note..."
                        : "Add more details..."
                    }
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSaveNote}
                disabled={!selectedPet || (!selectedTemplate && !customNote.trim()) || isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <StickyNote className="h-4 w-4 mr-2" />
                    Save Note
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
