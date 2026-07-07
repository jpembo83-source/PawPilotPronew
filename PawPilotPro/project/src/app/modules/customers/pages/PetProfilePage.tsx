import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useCustomerStore } from '../store';
import { 
  ArrowLeft, 
  Dog,
  Warning,
  FileDashed,
  Pulse,
  Syringe,
  Flag as FlagIcon,
  Camera,
  CircleNotch,
  X
} from '@phosphor-icons/react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import {
  Card,
  CardContent,
} from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/skeleton';
import { toast } from 'sonner';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { projectId } from '../../../../../utils/supabase/info';
import { getAuthHeaders } from '@/utils/supabase/authHeaders';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23`;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface PetSummary {
  documentCount: number;
  documentsExpired: number;
  recentVisits: number;
  lastVisit: string | null;
  vaccinationCount: number;
  vaccinationsExpiring: number;
  /** Owner-uploaded certificates for this pet sitting in the review queue. */
  vaccinationsPendingReview: number;
}

const EMPTY_SUMMARY: PetSummary = {
  documentCount: 0,
  documentsExpired: 0,
  recentVisits: 0,
  lastVisit: null,
  vaccinationCount: 0,
  vaccinationsExpiring: 0,
  vaccinationsPendingReview: 0,
};

// Import tab components
import { PetOverviewTab } from '../components/pet-profile/PetOverviewTab';
import { DocumentManager } from '../components/DocumentManager';
import { PetCareProfileTab } from '../components/pet-profile/PetCareProfileTab';
import { PetTimelineTab } from '../components/pet-profile/PetTimelineTab';
import { VaccinationManager } from '../components/pet-profile/VaccinationManager';
import { EditPetModal } from '../components/modals/EditPetModal';

export function PetProfilePage() {
  const { petId } = useParams<{ petId: string }>();
  const navigate = useNavigate();
  const { currentPetProfile, isLoading, fetchPetProfile, updatePet, flags, fetchFlags } = useCustomerStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [summary, setSummary] = useState<PetSummary>(EMPTY_SUMMARY);
  const [summaryLoading, setSummaryLoading] = useState(true);
  // Bumped by the Vaccinations tab after a record change so the stat cards
  // (vaccination count / expiring) re-fetch without a full page reload.
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);

  useEffect(() => {
    if (petId) {
      fetchPetProfile(petId);
    }
  }, [petId]);

  useEffect(() => {
    if (currentPetProfile?.household_id) {
      fetchFlags(currentPetProfile.household_id);
    }
  }, [currentPetProfile?.household_id]);

  // Fetch real summary stats (documents, vaccinations, visits) for this pet
  useEffect(() => {
    const householdId = currentPetProfile?.household_id;
    const id = currentPetProfile?.id;
    if (!householdId || !id) return;

    let cancelled = false;
    const loadSummary = async () => {
      setSummaryLoading(true);
      try {
        const headers = await getAuthHeaders();

        const [docsRes, vaxRes, visitsRes, vaxQueueRes] = await Promise.allSettled([
          fetch(`${API_BASE}/customers/households/${householdId}/documents`, { headers }),
          fetch(`${API_BASE}/pets/${id}/vaccinations`, { headers }),
          fetch(`${API_BASE}/daycare/bookings?pet_id=${id}`, { headers }),
          fetch(`${API_BASE}/portal-admin/vax-queue/pending-count?petId=${encodeURIComponent(id)}`, { headers }),
        ]);

        const now = Date.now();
        const next: PetSummary = { ...EMPTY_SUMMARY };

        // Documents — count this pet's docs plus household-wide docs that apply to it
        if (docsRes.status === 'fulfilled' && docsRes.value.ok) {
          const body = await docsRes.value.json().catch(() => ({}));
          const documents: any[] = body.documents ?? [];
          const petDocs = documents.filter(d => d.pet_id === id || !d.pet_id);
          next.documentCount = petDocs.length;
          next.documentsExpired = petDocs.filter(
            d => d.expiry_date && new Date(d.expiry_date).getTime() < now
          ).length;
        }

        // Vaccinations — count records and those due within 30 days
        if (vaxRes.status === 'fulfilled' && vaxRes.value.ok) {
          const body = await vaxRes.value.json().catch(() => ({}));
          const vaccinations: any[] = body.vaccinations ?? [];
          next.vaccinationCount = vaccinations.length;
          next.vaccinationsExpiring = vaccinations.filter(v => {
            if (!v.next_due_date) return false;
            const due = new Date(v.next_due_date).getTime();
            return due >= now && due <= now + 30 * MS_PER_DAY;
          }).length;
        }

        // Owner-uploaded certificates for this pet awaiting staff review —
        // powers the "awaiting review" chip on the Vaccinations stat card.
        if (vaxQueueRes.status === 'fulfilled' && vaxQueueRes.value.ok) {
          const body = (await vaxQueueRes.value.json().catch(() => ({}))) as { count?: number };
          next.vaccinationsPendingReview = body.count ?? 0;
        }

        // Visits — attended daycare bookings; "recent" = last 90 days
        if (visitsRes.status === 'fulfilled' && visitsRes.value.ok) {
          const bookings: any[] = await visitsRes.value.json().catch(() => []);
          const attended = (Array.isArray(bookings) ? bookings : []).filter(
            b => b.check_in_status === 'checked_out' || b.booking_status === 'completed'
          );
          const visitTime = (b: any) =>
            b.actual_check_in_time
              ? new Date(b.actual_check_in_time).getTime()
              : b.booking_date
              ? new Date(b.booking_date).getTime()
              : 0;
          next.recentVisits = attended.filter(b => visitTime(b) >= now - 90 * MS_PER_DAY).length;
          const mostRecent = attended.reduce<number>((max, b) => Math.max(max, visitTime(b)), 0);
          next.lastVisit = mostRecent > 0 ? new Date(mostRecent).toISOString() : null;
        }

        if (!cancelled) setSummary(next);
      } catch (err) {
        console.error('Failed to load pet summary:', err);
        if (!cancelled) setSummary(EMPTY_SUMMARY);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    };

    loadSummary();
    // summaryRefreshKey is a manual refresh trigger (vaccination edits).
    return () => { cancelled = true; };
  }, [currentPetProfile?.household_id, currentPetProfile?.id, summaryRefreshKey]);
  
  // Update preview when pet profile loads
  useEffect(() => {
    if (currentPetProfile?.photo_url) {
      setPreviewUrl(currentPetProfile.photo_url);
    }
  }, [currentPetProfile?.photo_url]);
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo is too large — maximum size is 5MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image — please choose a JPG, PNG, or similar');
      return;
    }
    
    setUploading(true);
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('petId', currentPetProfile!.id);
      
      // Upload to backend. FormData posts must not send the JSON Content-Type
      // the shared util adds — the browser sets the multipart boundary itself.
      const { 'Content-Type': _ct, ...auth } = await getAuthHeaders();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-fc003b23/pet-photo-upload/upload`,
        {
          method: 'POST',
          headers: auth,
          body: formData,
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload photo');
      }
      
      const data = await response.json();
      
      // Update local preview (backend returns 'url' not 'photoUrl')
      setPreviewUrl(data.url);
      
      // Update pet profile
      await updatePet(currentPetProfile!.id, { photo_url: data.url });
      await fetchPetProfile(currentPetProfile!.id);
      
    } catch (error: any) {
      console.error('Failed to upload photo:', error);
      toast.error(`Failed to upload photo: ${error.message || 'please try again'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    const confirmed = await confirm({
      title: 'Remove this photo?',
      description: "The pet's profile photo will be deleted. You can upload a new one at any time.",
      confirmLabel: 'Remove photo',
      destructive: true,
    });
    if (!confirmed) return;

    setUploading(true);

    try {
      // Update pet to remove photo
      await updatePet(currentPetProfile!.id, { photo_url: null });
      setPreviewUrl(null);
      await fetchPetProfile(currentPetProfile!.id);
    } catch (error: any) {
      console.error('Failed to remove photo:', error);
      toast.error('Failed to remove photo — please try again');
    } finally {
      setUploading(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  
  if (!currentPetProfile) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Warning className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">Pet not found</h3>
            <p className="text-slate-600 mb-4">
              This pet doesn't exist or you don't have permission to view it
            </p>
            <Button onClick={() => navigate('/customers')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Customers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // currentPetProfile is just the Pet object
  const pet = currentPetProfile;
  // Filter flags that belong to this pet specifically, or household-level flags with no pet link
  const petFlags = flags.filter(f => f.is_active && (f.pet_id === pet!.id || !f.pet_id));
  const hasAlerts = petFlags.length > 0 || !pet!.active;

  // Care-profile alert content, surfaced directly in the banner so staff
  // holding the dog never need a second tap to learn WHAT the warning is.
  // Medical/allergy text renders at 16px — the most safety-critical text in
  // the app. Preview = complete first sentence (never chops a substance or
  // medication name mid-way), clamped at two lines.
  const alertPreview = (text: string): string => {
    const trimmed = text.trim();
    const firstSentence = /^[^\n.!?]*[.!?]?/.exec(trimmed)?.[0]?.trim();
    return firstSentence || trimmed;
  };
  const careAlerts: { key: string; label: string; text: string; medical: boolean }[] = [
    pet.medical_notes && { key: 'medical', label: 'Medical', text: pet.medical_notes, medical: true },
    pet.allergies && { key: 'allergies', label: 'Allergies', text: pet.allergies, medical: true },
    pet.behaviour_notes && { key: 'behaviour', label: 'Behaviour', text: pet.behaviour_notes, medical: false },
  ].filter((a): a is { key: string; label: string; text: string; medical: boolean } => Boolean(a));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header — wraps on phones: photo + name stack, Edit drops below,
          nothing pushes the page wider than the screen */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-3 sm:gap-6 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Back to household"
            onClick={() => navigate(`/customers/${pet.household_id}?tab=pets`)}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>

          {/* Profile Picture with Upload */}
          <div className="relative group">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-lg flex-shrink-0">
              {previewUrl ? (
                <>
                  <img
                    src={previewUrl}
                    alt={pet.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Remove button */}
                  <button
                    onClick={handleRemovePhoto}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                  <Dog className="h-12 w-12" />
                </div>
              )}
              
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <CircleNotch className="h-8 w-8 text-white animate-spin" />
                </div>
              )}
              
              {/* Upload overlay on hover */}
              {!uploading && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                  <Camera className="h-8 w-8 mb-1" />
                  <span className="text-xs font-medium">
                    {previewUrl ? 'Change Photo' : 'Upload Photo'}
                  </span>
                </button>
              )}
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold break-words">{pet.name}</h1>
              <Badge variant={pet.active ? 'default' : 'destructive'}>
                {pet.active ? 'active' : 'inactive'}
              </Badge>
              {hasAlerts && (
                <Warning className="h-6 w-6 text-red-500" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
              {pet.breed && <span className="font-medium">{pet.breed}</span>}
              {pet.breed && pet.sex && <span>•</span>}
              {pet.sex && <span className="capitalize">{pet.sex}</span>}
              {pet.date_of_birth && (
                <>
                  <span>•</span>
                  <span>
                    Born {new Date(pet.date_of_birth).toLocaleDateString('en-GB')}
                  </span>
                </>
              )}
            </div>
            
            <p className="text-sm text-slate-500 mt-2">
              <button
                className="text-primary hover:underline"
                onClick={() => navigate(`/customers/${pet.household_id}?tab=pets`)}
              >
                Back to Household
              </button>
            </p>
          </div>
        </div>
        
        <Button variant="outline" onClick={() => setShowEditModal(true)}>Edit Pet</Button>
      </div>
      
      {/* Alert Banner */}
      {hasAlerts && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Warning className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">Active Alerts</h3>
                <div className="space-y-2">
                  {!pet.active && (
                    <div className="text-sm text-red-700">
                      • Pet is inactive
                    </div>
                  )}
                  {petFlags.map(flag => (
                    <div key={flag.id} className="text-sm text-red-700">
                      • {flag.flag_key.replace(/_/g, ' ')}
                      {flag.severity === 'block' && ' (Blocks check-in)'}
                      {flag.reason && ` — ${flag.reason}`}
                    </div>
                  ))}
                  {careAlerts.map(alert => (
                    <p
                      key={alert.key}
                      className={`${alert.medical ? 'text-base' : 'text-sm'} text-red-800 line-clamp-2`}
                    >
                      <span className="font-semibold">{alert.label} — </span>
                      {alertPreview(alert.text)}
                    </p>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTab('care')}
                  className="mt-3 text-sm font-medium text-red-900 underline underline-offset-2 hover:text-red-700 transition-colors"
                >
                  See Care Profile for full details
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Documents</p>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{summary.documentCount}</p>
                    {summary.documentsExpired > 0 && (
                      <p className="text-sm text-red-600 mt-1">
                        {summary.documentsExpired} expired
                      </p>
                    )}
                  </>
                )}
              </div>
              <FileDashed className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Recent Visits</p>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{summary.recentVisits}</p>
                    {summary.lastVisit && (
                      <p className="text-xs text-slate-500 mt-1">
                        Last: {new Date(summary.lastVisit).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </>
                )}
              </div>
              <Pulse className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Active Flags</p>
                <p className="text-2xl font-bold">{petFlags.length}</p>
              </div>
              <FlagIcon className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Vaccinations</p>
                {summaryLoading ? (
                  <Skeleton className="h-8 w-10" />
                ) : (
                  <>
                    <p className="text-2xl font-bold">{summary.vaccinationCount}</p>
                    {summary.vaccinationsExpiring > 0 && (
                      <p className="text-sm text-orange-600 mt-1">
                        {summary.vaccinationsExpiring} expiring soon
                      </p>
                    )}
                    {summary.vaccinationsPendingReview > 0 && (
                      <Link
                        to="/customers/pending-requests?tab=vaccinations"
                        className="inline-flex items-center gap-1 mt-1.5 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200 transition-colors"
                      >
                        <Syringe className="h-3.5 w-3.5" />
                        {summary.vaccinationsPendingReview} awaiting review
                      </Link>
                    )}
                  </>
                )}
              </div>
              <Syringe className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="care">Care Profile</TabsTrigger>
          <TabsTrigger value="vaccinations">Vaccinations</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <PetOverviewTab pet={currentPetProfile} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentManager householdId={currentPetProfile.household_id} petId={currentPetProfile.id} showHouseholdDocs={true} />
        </TabsContent>

        <TabsContent value="care">
          <PetCareProfileTab pet={currentPetProfile} />
        </TabsContent>

        <TabsContent value="vaccinations">
          <VaccinationManager
            petId={currentPetProfile.id}
            onChanged={() => setSummaryRefreshKey((k) => k + 1)}
          />
        </TabsContent>
        
        <TabsContent value="timeline">
          <PetTimelineTab pet={currentPetProfile} />
        </TabsContent>
      </Tabs>
      
      {/* Edit Pet Modal */}
      <EditPetModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        pet={pet}
        onPetUpdated={() => fetchPetProfile(pet.id)}
      />
      {confirmDialog}
    </div>
  );
}