import React, { useState, useEffect } from 'react';
import { Household, HouseholdContact, Pet, PetDocument, HouseholdNote, HouseholdFlag, NoteCategory, FlagKey, FlagSeverity } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Plus, FileText, PushPin, Warning, Flag, ShieldWarning, Star, Truck, Scissors, House, PencilSimple, Trash, X } from '@phosphor-icons/react';
import { useAuth } from '../../../../context/AuthContext';
import { useCustomerStore } from '../../store';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../../components/ui/dialog';
import { Label } from '../../../../components/ui/label';
import { Textarea } from '../../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Input } from '../../../../components/ui/input';
import { Switch } from '../../../../components/ui/switch';
import { toast } from 'sonner';
import { useConfirmDialog } from '../../../../hooks/useConfirmDialog';
import { useUnsavedChangesGuard, formIsDirty } from '../../../../hooks/useUnsavedChangesGuard';

interface NotesTabProps {
  household: Household & { 
    contacts?: HouseholdContact[]; 
    pets?: Pet[]; 
    documents?: PetDocument[] 
  } | null;
}

export function NotesTab({ household }: NotesTabProps) {
  const { user } = useAuth();
  const { notes, flags, fetchNotes, fetchFlags, createNote, deleteNote, updateNote, createFlag, updateFlag, deleteFlag } = useCustomerStore();
  
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddFlag, setShowAddFlag] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Load notes and flags when household changes
  useEffect(() => {
    if (household?.id) {
      fetchNotes(household.id);
      fetchFlags(household.id);
    }
  }, [household?.id, fetchNotes, fetchFlags]);
  
  if (!household) {
    return <div>Loading...</div>;
  }
  
  const activeFlags = flags.filter(f => f.is_active);
  const inactiveFlags = flags.filter(f => !f.is_active);
  
  return (
    <div className="space-y-6">
      {/* Active Flags */}
      {activeFlags.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Flag className="h-5 w-5" />
                Active Flags
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeFlags.map(flag => (
                <FlagCard key={flag.id} flag={flag} household={household} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Add Flag Button */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Operational Flags</CardTitle>
            <Button onClick={() => setShowAddFlag(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Flag
            </Button>
          </div>
        </CardHeader>
        {inactiveFlags.length > 0 && (
          <CardContent>
            <div className="text-sm text-muted-foreground mb-2">Inactive Flags</div>
            <div className="space-y-2">
              {inactiveFlags.map(flag => (
                <FlagCard key={flag.id} flag={flag} household={household} />
              ))}
            </div>
          </CardContent>
        )}
      </Card>
      
      {/* Notes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Internal Notes</CardTitle>
            <Button onClick={() => setShowAddNote(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {notes.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-2 text-slate-300" />
              <p>No internal notes</p>
            </div>
          )}
          
          {notes.map(note => (
            <NoteCard key={note.id} note={note} household={household} />
          ))}
        </CardContent>
      </Card>
      
      {/* Add Note Modal */}
      <AddNoteModal
        open={showAddNote}
        onClose={() => setShowAddNote(false)}
        household={household}
      />
      
      {/* Add Flag Modal */}
      <AddFlagModal
        open={showAddFlag}
        onClose={() => setShowAddFlag(false)}
        household={household}
      />
    </div>
  );
}

// Note Card Component
function NoteCard({ note, household }: { note: HouseholdNote; household: Household & { pets?: Pet[] } }) {
  const { deleteNote, updateNote } = useCustomerStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete this note?',
      description: 'This note will be permanently deleted.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteNote(note.id);
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note — please try again');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTogglePin = async () => {
    try {
      await updateNote(note.id, { is_pinned: !note.is_pinned });
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      toast.error('Failed to update note — please try again');
    }
  };
  
  const linkedPets = household.pets?.filter(p => note.pet_ids?.includes(p.id)) || [];
  
  return (
    <>
      <div className={`p-4 border rounded-lg hover:bg-slate-50 transition-colors ${note.is_pinned ? 'border-amber-300 bg-amber-50/50' : ''}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="capitalize">
                {note.category}
              </Badge>
              {note.visibility === 'customer' && (
                <Badge variant="secondary">Customer-visible</Badge>
              )}
              {note.is_pinned && (
                <Badge variant="default" className="bg-amber-500">
                  <PushPin className="h-3 w-3 mr-1" />
                  Pinned
                </Badge>
              )}
              {linkedPets.length > 0 && (
                <Badge variant="secondary">
                  {linkedPets.map(p => p.name).join(', ')}
                </Badge>
              )}
            </div>
            {note.title && (
              <h4 className="font-semibold text-slate-900 mb-1">{note.title}</h4>
            )}
            <p className="text-slate-700 whitespace-pre-wrap">{note.content}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
          <span>
            {note.created_by_name} • {' '}
            {new Date(note.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleTogglePin}
              title={note.is_pinned ? 'Unpin' : 'PushPin'}
            >
              <PushPin className={`h-4 w-4 ${note.is_pinned ? 'fill-current' : ''}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setShowEdit(true)}
            >
              <PencilSimple className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {showEdit && (
        <EditNoteModal
          open={showEdit}
          onClose={() => setShowEdit(false)}
          note={note}
          household={household}
        />
      )}
      {confirmDialog}
    </>
  );
}

// Flag Card Component
function FlagCard({ flag, household }: { flag: HouseholdFlag; household: Household & { pets?: Pet[] } }) {
  const { deleteFlag, updateFlag } = useCustomerStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Remove this flag?',
      description: 'This flag will be permanently removed.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteFlag(flag.id);
    } catch (error) {
      console.error('Failed to delete flag:', error);
      toast.error('Failed to delete flag — please try again');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      await updateFlag(flag.id, { is_active: !flag.is_active });
    } catch (error) {
      console.error('Failed to toggle flag:', error);
      toast.error('Failed to update flag — please try again');
    }
  };
  
  const linkedPet = household.pets?.find(p => p.id === flag.pet_id);
  
  const getFlagIcon = (key: FlagKey) => {
    switch (key) {
      case 'vip': return Star;
      case 'behaviour_caution': return Warning;
      case 'medical_caution': return ShieldWarning;
      case 'payment_hold': return Warning;
      case 'transport_instructions': return Truck;
      case 'grooming_restrictions': return Scissors;
      case 'overnight_restrictions': return House;
      default: return Flag;
    }
  };
  
  const getFlagLabel = (key: FlagKey) => {
    return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };
  
  const getSeverityColor = (severity: FlagSeverity) => {
    switch (severity) {
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'warn': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'block': return 'bg-red-100 text-red-800 border-red-300';
    }
  };
  
  const Icon = getFlagIcon(flag.flag_key);
  
  return (
    <div className={`p-3 border rounded-lg flex items-start justify-between ${getSeverityColor(flag.severity)} ${!flag.is_active ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3 flex-1">
        <Icon className="h-5 w-5 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold">{getFlagLabel(flag.flag_key)}</span>
            {linkedPet && (
              <Badge variant="outline" className="text-xs">
                {linkedPet.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs capitalize">
              {flag.severity}
            </Badge>
          </div>
          {flag.reason && (
            <p className="text-sm">{flag.reason}</p>
          )}
          <p className="text-xs mt-1 opacity-75">
            {flag.created_by_name} • {new Date(flag.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleActive}
          title={flag.is_active ? 'Deactivate' : 'Activate'}
        >
          {flag.is_active ? <X className="h-4 w-4" /> : <Warning className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>
      {confirmDialog}
    </div>
  );
}

// Add Note Modal
const initialNoteFormData = {
  title: '',
  content: '',
  category: 'general' as NoteCategory,
  visibility: 'internal' as 'internal' | 'customer',
  is_pinned: false,
  pet_ids: [] as string[],
};

function AddNoteModal({ open, onClose, household }: { open: boolean; onClose: () => void; household: Household & { pets?: Pet[] } }) {
  const { createNote } = useCustomerStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(initialNoteFormData);

  // Every dismissal path (Cancel button, overlay click, Escape) funnels
  // through requestClose, so a dirty form is always guarded.
  const { requestClose, guardDialog } = useUnsavedChangesGuard({
    isDirty: () => formIsDirty(formData, initialNoteFormData),
    onClose: () => {
      setFormData(initialNoteFormData);
      onClose();
    },
    description: "This note hasn't been saved yet. Closing now will lose what you've written.",
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      toast.error('Please enter note content');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createNote(household.id, formData);
      onClose();
      // Reset form
      setFormData(initialNoteFormData);
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to create note — please try again');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) void requestClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
          <DialogDescription>
            Create an internal note for this household
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value as NoteCategory })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="behaviour">Behaviour</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="transport">Transport</SelectItem>
                <SelectItem value="grooming">Grooming</SelectItem>
                <SelectItem value="overnight">Overnight</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter note title..."
            />
          </div>
          
          <div>
            <Label htmlFor="content">Note Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter note content..."
              rows={6}
              required
            />
          </div>
          
          {household.pets && household.pets.length > 0 && (
            <div>
              <Label>Link to Pets (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {household.pets.map(pet => (
                  <label key={pet.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={formData.pet_ids.includes(pet.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, pet_ids: [...formData.pet_ids, pet.id] });
                        } else {
                          setFormData({ ...formData, pet_ids: formData.pet_ids.filter(id => id !== pet.id) });
                        }
                      }}
                    />
                    <span className="text-sm">{pet.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
            <Label htmlFor="pinned" className="cursor-pointer">PushPin this note</Label>
            <Switch
              id="pinned"
              checked={formData.is_pinned}
              onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {guardDialog}
    </Dialog>
  );
}

// Edit Note Modal
function EditNoteModal({ open, onClose, note, household }: { open: boolean; onClose: () => void; note: HouseholdNote; household: Household & { pets?: Pet[] } }) {
  const { updateNote } = useCustomerStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialFormData = {
    title: note.title || '',
    content: note.content,
    category: note.category,
    visibility: note.visibility,
    is_pinned: note.is_pinned,
    pet_ids: note.pet_ids || [],
  };
  const [formData, setFormData] = useState(initialFormData);

  // Every dismissal path (Cancel button, overlay click, Escape) funnels
  // through requestClose, so a dirty form is always guarded.
  const { requestClose, guardDialog } = useUnsavedChangesGuard({
    isDirty: () => formIsDirty(formData, initialFormData),
    onClose: () => {
      setFormData(initialFormData);
      onClose();
    },
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      toast.error('Please enter note content');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await updateNote(note.id, formData);
      onClose();
    } catch (error) {
      console.error('Failed to update note:', error);
      toast.error('Failed to update note — please try again');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) void requestClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Note</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value as NoteCategory })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="behaviour">Behaviour</SelectItem>
                <SelectItem value="medical">Medical</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="transport">Transport</SelectItem>
                <SelectItem value="grooming">Grooming</SelectItem>
                <SelectItem value="overnight">Overnight</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter note title..."
            />
          </div>
          
          <div>
            <Label htmlFor="content">Note Content *</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Enter note content..."
              rows={6}
              required
            />
          </div>
          
          {household.pets && household.pets.length > 0 && (
            <div>
              <Label>Link to Pets (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {household.pets.map(pet => (
                  <label key={pet.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={formData.pet_ids.includes(pet.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, pet_ids: [...formData.pet_ids, pet.id] });
                        } else {
                          setFormData({ ...formData, pet_ids: formData.pet_ids.filter(id => id !== pet.id) });
                        }
                      }}
                    />
                    <span className="text-sm">{pet.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded">
            <Label htmlFor="pinned" className="cursor-pointer">PushPin this note</Label>
            <Switch
              id="pinned"
              checked={formData.is_pinned}
              onCheckedChange={(checked) => setFormData({ ...formData, is_pinned: checked })}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Update Note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {guardDialog}
    </Dialog>
  );
}

// Add Flag Modal
function AddFlagModal({ open, onClose, household }: { open: boolean; onClose: () => void; household: Household & { pets?: Pet[] } }) {
  const { createFlag } = useCustomerStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialFlagFormData = {
    flag_key: 'behaviour_caution' as FlagKey,
    severity: 'warn' as FlagSeverity,
    is_active: true,
    reason: '',
    pet_id: null as string | null,
  };
  const [formData, setFormData] = useState(initialFlagFormData);

  // Every dismissal path (Cancel button, overlay click, Escape) funnels
  // through requestClose, so a dirty form is always guarded.
  const { requestClose, guardDialog } = useUnsavedChangesGuard({
    isDirty: () => formIsDirty(formData, initialFlagFormData),
    onClose: () => {
      setFormData(initialFlagFormData);
      onClose();
    },
    description: "This flag hasn't been created yet. Closing now will lose what you've entered.",
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    try {
      const data: any = {
        flag_key: formData.flag_key,
        severity: formData.severity,
        is_active: formData.is_active,
      };
      
      if (formData.reason.trim()) {
        data.reason = formData.reason;
      }
      
      // Only include pet_id if it's a valid pet UUID (not null)
      if (formData.pet_id) {
        // Verify the pet exists in the household before sending
        const petExists = household.pets?.some(p => p.id === formData.pet_id);

        if (petExists) {
          data.pet_id = formData.pet_id;
        } else {
          console.error('Pet ID not found in household pets list');
          toast.error('Selected pet not found in household');
          setIsSubmitting(false);
          return;
        }
      }
      
      await createFlag(household.id, data);
      toast.success('Flag created successfully');
      onClose();
      // Reset form
      setFormData({
        flag_key: 'behaviour_caution',
        severity: 'warn',
        is_active: true,
        reason: '',
        pet_id: null,
      });
    } catch (error) {
      console.error('Failed to create flag:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create flag');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) void requestClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Operational Flag</DialogTitle>
          <DialogDescription>
            Create a flag to mark important operational information
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="flag_key">Flag Type *</Label>
            <Select
              value={formData.flag_key}
              onValueChange={(value) => setFormData({ ...formData, flag_key: value as FlagKey })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vip">VIP</SelectItem>
                <SelectItem value="behaviour_caution">Behaviour Caution</SelectItem>
                <SelectItem value="medical_caution">Medical Caution</SelectItem>
                <SelectItem value="payment_hold">Payment Hold</SelectItem>
                <SelectItem value="transport_instructions">Transport Instructions</SelectItem>
                <SelectItem value="grooming_restrictions">Grooming Restrictions</SelectItem>
                <SelectItem value="overnight_restrictions">Overnight Restrictions</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="severity">Severity *</Label>
            <Select
              value={formData.severity}
              onValueChange={(value) => setFormData({ ...formData, severity: value as FlagSeverity })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info - For reference only</SelectItem>
                <SelectItem value="warn">Warn - Requires attention</SelectItem>
                <SelectItem value="block">Block - Prevents action</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {household.pets && household.pets.length > 0 && (
            <div>
              <Label htmlFor="pet_id">Link to Pet (optional)</Label>
              <div className="text-xs text-muted-foreground mb-2">
                Select a pet or leave as household-wide
              </div>
              <Select
                value={formData.pet_id || 'household-wide'}
                onValueChange={(value) => setFormData({ ...formData, pet_id: value === 'household-wide' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="household-wide">Household-wide (all pets)</SelectItem>
                  {household.pets.map(pet => (
                    <SelectItem key={pet.id} value={pet.id}>{pet.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div>
            <Label htmlFor="reason">Reason / Details</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Enter details about this flag..."
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void requestClose()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Flag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      {guardDialog}
    </Dialog>
  );
}